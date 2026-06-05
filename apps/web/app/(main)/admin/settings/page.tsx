'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  Bell,
  Palette,
  CalendarDays,
  ChevronRight,
  Save,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { cycleCommands } from '@/hooks/useCycles';
import { useSchedules, scheduleCommands } from '@/hooks/useSchedules';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { Modal } from '@/components/Modal';
import { FileDropzone } from '@/components/FileDropzone';
import { ScheduleEditor, type PhaseDraft } from '@/components/ScheduleEditor';
import { Forbidden, Skeleton } from '@/components/States';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { isHrAdmin } from '@/lib/nav';
import type { ImportResult, ScheduleItemInput } from '@/lib/types';
import { T } from '@/lib/toss';

// ── 타입 ───────────────────────────────────────────────────────
type TabKey = 'evaluation' | 'schedule' | 'notification' | 'display';

const SETTINGS_MENU: { key: TabKey; label: string; Icon: typeof Calendar; bg: string }[] = [
  { key: 'evaluation',   label: '평가 기간 설정', Icon: Calendar,     bg: T.blue500 },
  { key: 'schedule',     label: '일정·대상자',    Icon: CalendarDays, bg: T.grey800 },
  { key: 'notification', label: '알림 설정',      Icon: Bell,         bg: T.grey800 },
  { key: 'display',      label: '표시 설정',      Icon: Palette,      bg: T.grey800 },
];

const DEFAULT_PHASES = ['prep', 'self', 'downward1', 'downward2', 'result'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${T.grey200}`,
  padding: '10px 12px',
  fontSize: 13,
  color: T.grey900,
  background: '#fff',
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: T.grey800,
  marginBottom: 6,
};

// ── 알림 토글 설정(localStorage) ───────────────────────────────
const NOTIF_KEY = 'energyx:notif-settings';
type NotifSettings = { email: boolean; system: boolean; deadline: boolean; approval: boolean };
const NOTIF_DEFAULTS: NotifSettings = { email: true, system: true, deadline: true, approval: false };
function loadNotifSettings(): NotifSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(NOTIF_KEY) : null;
    return raw ? { ...NOTIF_DEFAULTS, ...(JSON.parse(raw) as Partial<NotifSettings>) } : NOTIF_DEFAULTS;
  } catch {
    return NOTIF_DEFAULTS;
  }
}
function saveNotifSettings(s: NotifSettings) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Toggle 컴포넌트 ────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        background: on ? T.blue500 : T.grey400,
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

// ── ContentHeader ──────────────────────────────────────────────
function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${T.grey200}`,
        background: T.grey50,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{title}</h3>
      {desc && <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{desc}</p>}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
    reload: reloadCycles,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && isHrAdmin(user.role);
  const [activeTab, setActiveTab] = useState<TabKey>('evaluation');

  // ── 평가 기간 탭: 주기 편집 드래프트 ──────────────────────────
  const [evalDraft, setEvalDraft] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });
  const [evalBusy, setEvalBusy] = useState(false);

  useEffect(() => {
    if (current) {
      setEvalDraft({
        name:      current.name,
        startDate: current.startDate ? current.startDate.slice(0, 10) : '',
        endDate:   current.endDate   ? current.endDate.slice(0, 10)   : '',
      });
    }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveEval() {
    if (!cycleId) return;
    setEvalBusy(true);
    try {
      await cycleCommands.update(cycleId, {
        name:      evalDraft.name,
        startDate: evalDraft.startDate ? new Date(evalDraft.startDate).toISOString() : undefined,
        endDate:   evalDraft.endDate   ? new Date(evalDraft.endDate).toISOString()   : undefined,
        year:      evalDraft.startDate ? new Date(evalDraft.startDate).getFullYear() : undefined,
      });
      toast.show({ variant: 'success', message: '평가 기간을 저장했어요.' });
      reloadCycles();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setEvalBusy(false);
    }
  }

  // ── 새 주기 생성 모달 ──────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: '', startDate: '', endDate: '' });

  async function handleCreateCycle() {
    if (!newDraft.name || !newDraft.startDate || !newDraft.endDate) return;
    setCreateBusy(true);
    try {
      const created = await cycleCommands.create({
        name:      newDraft.name,
        year:      new Date(newDraft.startDate).getFullYear(),
        startDate: new Date(newDraft.startDate).toISOString(),
        endDate:   new Date(newDraft.endDate).toISOString(),
      });
      toast.show({ variant: 'success', message: '새 평가 주기를 만들었어요.' });
      setCreateOpen(false);
      setNewDraft({ name: '', startDate: '', endDate: '' });
      reloadCycles();
      setSelectedId(created.id);
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '생성에 실패했어요.' });
    } finally {
      setCreateBusy(false);
    }
  }

  // ── 일정·대상자 탭 ─────────────────────────────────────────────
  const { data: schedData, loading: schedLoading, reload: reloadSched } = useSchedules(cycleId, { enabled: allowed && !!cycleId });
  const [phases, setPhases] = useState<PhaseDraft[]>([]);
  const [channels, setChannels] = useState({ inApp: true, email: true });
  const [schedBusy, setSchedBusy] = useState(false);

  useEffect(() => {
    const existing = schedData?.data ?? [];
    const byPhase = new Map(existing.map((s) => [s.phase, s]));
    const merged: PhaseDraft[] = DEFAULT_PHASES.map((phase) => {
      const s = byPhase.get(phase);
      return {
        phase,
        startDate:     s?.startDate  ? s.startDate.slice(0, 10)  : '',
        dueDate:       s?.dueDate    ? s.dueDate.slice(0, 10)    : '',
        notifyOffsets: s?.notifyOffsets ?? [7, 3, 1],
        notifyEnabled: s?.notifyEnabled ?? true,
        isLocked:      s?.isLocked ?? false,
      };
    });
    setPhases(merged);
  }, [schedData]);

  async function saveSchedule() {
    if (!cycleId) return;
    setSchedBusy(true);
    const payload: ScheduleItemInput[] = phases
      .filter((p) => p.dueDate)
      .map((p) => ({
        phase:         p.phase,
        startDate:     p.startDate ? new Date(p.startDate).toISOString() : null,
        dueDate:       new Date(p.dueDate).toISOString(),
        notifyOffsets: p.notifyOffsets,
        notifyEnabled: p.notifyEnabled,
        isLocked:      p.isLocked ?? false,
      }));
    if (payload.length === 0) {
      toast.show({ variant: 'danger', message: '마감일을 하나 이상 입력해 주세요.' });
      setSchedBusy(false);
      return;
    }
    try {
      await scheduleCommands.upsert(cycleId, payload);
      toast.show({ variant: 'success', message: '일정을 저장했어요.' });
      reloadSched();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setSchedBusy(false);
    }
  }

  // ── 조직·대상자 엑셀 임포트 ────────────────────────────────────
  const [orgImporting, setOrgImporting] = useState(false);
  const [orgResult, setOrgResult] = useState<ImportResult | null>(null);

  async function handleOrgImport(file: File) {
    setOrgImporting(true);
    setOrgResult(null);
    try {
      const res = await uploadExcel('/excel/import/org', file);
      setOrgResult(res);
      if (res.ok) toast.show({ variant: 'success', message: `조직·대상자 ${res.imported}건을 반영했어요.` });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '업로드에 실패했어요.' });
    } finally {
      setOrgImporting(false);
    }
  }

  // ── 알림 설정 탭 (localStorage) ────────────────────────────────
  const [notifs, setNotifs] = useState<NotifSettings>(NOTIF_DEFAULTS);
  useEffect(() => { setNotifs(loadNotifSettings()); }, []);

  function toggleNotif(key: keyof NotifSettings) {
    setNotifs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifSettings(next);
      return next;
    });
  }

  // ── Primary Action ─────────────────────────────────────────────
  const primaryAction =
    !allowed ? null
    : activeTab === 'evaluation' && cycleId
      ? { label: '저장', onClick: () => void handleSaveEval(), disabled: evalBusy || !evalDraft.name, loading: evalBusy }
    : activeTab === 'schedule' && cycleId
      ? { label: '일정 저장', onClick: () => void saveSchedule(), disabled: schedBusy, loading: schedBusy }
    : null;

  useSetPrimaryAction(primaryAction, [allowed, activeTab, cycleId, evalDraft, evalBusy, schedBusy, phases]);

  // ── 가드 ──────────────────────────────────────────────────────
  if (!allowed) return <Forbidden message="설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="p-6 space-y-5" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>설정</h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>인사평가 시스템 환경을 설정합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            color: T.blue500,
            border: `1px solid ${T.blue500}`,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} /> 새 평가 주기
        </button>
      </div>

      {/* 주기 선택 */}
      {cycles.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: T.grey600 }}>평가 주기</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {current && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                color: current.status === 'active' ? T.green500 : T.grey600,
                background: current.status === 'active' ? '#e6f9f2' : T.grey100,
              }}
            >
              {current.status === 'active' ? '활성' : current.status === 'closed' ? '완료' : current.status}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* 좌측 메뉴 */}
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff', alignSelf: 'start' }}>
          {SETTINGS_MENU.map(({ key, label, Icon, bg }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-all last:border-b-0"
                style={{
                  background:  isActive ? T.grey100 : '#fff',
                  borderColor: T.grey200,
                  borderLeft:  `3px solid ${isActive ? bg : 'transparent'}`,
                }}
              >
                <span className="flex items-center justify-center" style={{ width: 30, height: 30, background: bg }}>
                  <Icon size={14} color="#fff" />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? T.grey900 : T.grey700 }}>
                  {label}
                </span>
                <ChevronRight size={13} color={isActive ? T.grey900 : T.grey400} className="ml-auto" />
              </button>
            );
          })}
        </div>

        {/* 우측 콘텐츠 */}
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff', overflow: 'hidden' }}>

          {/* ── 평가 기간 설정 ── */}
          {activeTab === 'evaluation' && (
            <>
              <ContentHeader title="평가 기간 설정" desc="평가 주기 명칭과 기간을 설정합니다." />
              {!current ? (
                <div style={{ padding: 48, textAlign: 'center', color: T.grey600, fontSize: 13 }}>
                  평가 주기가 없어요. 우측 상단 &apos;새 평가 주기&apos;를 눌러 시작하세요.
                </div>
              ) : (
                <div style={{ padding: 24 }} className="space-y-5">
                  <div>
                    <label style={labelStyle}>평가 명칭</label>
                    <input
                      value={evalDraft.name}
                      onChange={(e) => setEvalDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="예: 2026년 상반기 인사평가"
                      style={inputStyle}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>평가 시작일</label>
                      <input type="date" value={evalDraft.startDate} onChange={(e) => setEvalDraft((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>평가 종료일</label>
                      <input type="date" value={evalDraft.endDate} onChange={(e) => setEvalDraft((p) => ({ ...p, endDate: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => void handleSaveEval()}
                      disabled={evalBusy || !evalDraft.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 20px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fff',
                        background: evalBusy || !evalDraft.name ? T.grey400 : T.blue500,
                        border: 'none',
                        cursor: evalBusy || !evalDraft.name ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Save size={14} /> {evalBusy ? '저장 중…' : '저장'}
                    </button>
                  </div>

                  {/* 전체 주기 목록 */}
                  {cycles.length > 1 && (
                    <div style={{ marginTop: 8, borderTop: `1px solid ${T.grey200}`, paddingTop: 20 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.grey700, marginBottom: 10 }}>전체 평가 주기</p>
                      <ul>
                        {cycles.map((c) => (
                          <li
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              marginBottom: 4,
                              border: `1px solid ${c.id === selectedId ? T.blue500 : T.grey200}`,
                              background: c.id === selectedId ? '#f0f6ff' : '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontSize: 13, color: T.grey900 }}>{c.name}</span>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              color: c.status === 'active' ? T.green500 : T.grey600,
                              background: c.status === 'active' ? '#e6f9f2' : T.grey100,
                            }}>
                              {c.status === 'active' ? '활성' : c.status === 'closed' ? '완료' : c.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── 일정·대상자 ── */}
          {activeTab === 'schedule' && (
            <>
              <ContentHeader title="일정·대상자" desc="단계별 마감일과 조직·대상자를 관리합니다." />
              {!current ? (
                <div style={{ padding: 48, textAlign: 'center', color: T.grey600, fontSize: 13 }}>평가 주기를 먼저 선택해 주세요.</div>
              ) : schedLoading ? (
                <div style={{ padding: 48, textAlign: 'center', color: T.grey400, fontSize: 13 }}>불러오는 중…</div>
              ) : (
                <div style={{ padding: 24 }} className="space-y-6">
                  <ScheduleEditor
                    phases={phases}
                    onPhaseChange={(phase, patch) =>
                      setPhases((prev) => prev.map((p) => p.phase === phase ? { ...p, ...patch } : p))
                    }
                    channels={channels}
                    onChannelsChange={setChannels}
                  />

                  {/* 조직·대상자 엑셀 임포트 */}
                  <div style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: T.grey50, borderBottom: `1px solid ${T.grey200}` }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>조직·대상자 엑셀 임포트</h4>
                      <p style={{ fontSize: 12, color: T.grey600, marginTop: 2 }}>
                        양식을 내려받아 본부·팀·임직원과 평가 대상자를 한 번에 등록해요.
                      </p>
                    </div>
                    <div style={{ padding: 16 }}>
                      <FileDropzone
                        uploading={orgImporting}
                        result={orgResult}
                        showCommit={false}
                        templateHref="/excel/template/org"
                        templateLabel="조직 양식 받기"
                        onSelect={(file) => void handleOrgImport(file)}
                        onClear={() => setOrgResult(null)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 알림 설정 ── */}
          {activeTab === 'notification' && (
            <>
              <ContentHeader title="알림 설정" desc="평가 관련 알림 수신 여부를 설정합니다." />
              <div style={{ padding: 24 }} className="space-y-3">
                {([
                  { key: 'email'    as const, label: '이메일 알림',  desc: '평가 관련 주요 이벤트를 이메일로 수신합니다.' },
                  { key: 'system'   as const, label: '시스템 알림',  desc: '시스템 내 알림을 표시합니다.' },
                  { key: 'deadline' as const, label: '마감 알림',    desc: '평가 마감 D-7/D-3/D-1 알림을 발송합니다.' },
                  { key: 'approval' as const, label: '승인 알림',    desc: 'KPI 및 평가 승인·반려 시 알림을 발송합니다.' },
                ] as { key: keyof NotifSettings; label: string; desc: string }[]).map((n) => (
                  <div
                    key={n.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: `1px solid ${T.grey200}`,
                      padding: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{n.label}</div>
                      <div style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <Toggle on={notifs[n.key]} onChange={() => toggleNotif(n.key)} />
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: T.grey400, paddingTop: 4 }}>
                  SMTP 미설정 시 이메일은 콘솔/DB로 안전하게 폴백됩니다.
                </p>
              </div>
            </>
          )}

          {/* ── 표시 설정 ── */}
          {activeTab === 'display' && (
            <>
              <ContentHeader title="표시 설정" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.grey600, fontSize: 13 }}>
                해당 설정 영역은 준비 중입니다.
              </div>
            </>
          )}
        </div>
      </div>

      {/* 새 평가 주기 모달 */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="새 평가 주기 만들기"
        secondaryAction={{ label: '취소', onClick: () => setCreateOpen(false) }}
        primaryAction={{
          label: '만들기',
          onClick: () => void handleCreateCycle(),
          loading: createBusy,
          disabled: !newDraft.name || !newDraft.startDate || !newDraft.endDate || createBusy,
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">주기 이름</label>
            <input
              type="text"
              value={newDraft.name}
              onChange={(e) => setNewDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="예: 2026년 상반기 평가"
              className="border border-border px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">시작일</label>
              <input
                type="date"
                value={newDraft.startDate}
                onChange={(e) => setNewDraft((p) => ({ ...p, startDate: e.target.value }))}
                className="border border-border px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">종료일</label>
              <input
                type="date"
                value={newDraft.endDate}
                onChange={(e) => setNewDraft((p) => ({ ...p, endDate: e.target.value }))}
                className="border border-border px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
