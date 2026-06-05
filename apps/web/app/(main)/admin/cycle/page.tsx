'use client';

// 평가 운영(HR) — 평가 기간 설정 + 일정·대상자. 설정에서 분리해 사이드바 독립 메뉴로.
// 별도 '새 평가 주기' 버튼은 제거 — 주기가 없으면 평가 기간 폼이 곧 생성 폼이 된다.
import { useEffect, useState } from 'react';
import { Calendar, CalendarDays, ChevronRight, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { cycleCommands } from '@/hooks/useCycles';
import { useSchedules, scheduleCommands } from '@/hooks/useSchedules';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { FileDropzone } from '@/components/FileDropzone';
import { ScheduleEditor, type PhaseDraft } from '@/components/ScheduleEditor';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import type { ImportResult, ScheduleItemInput } from '@/lib/types';
import { T } from '@/lib/toss';

type TabKey = 'period' | 'schedule';
const MENU: { key: TabKey; label: string; Icon: typeof Calendar; bg: string }[] = [
  { key: 'period',   label: '평가 기간 설정', Icon: Calendar,     bg: T.blue500 },
  { key: 'schedule', label: '일정·대상자',    Icon: CalendarDays, bg: T.grey800 },
];
const DEFAULT_PHASES = ['prep', 'self', 'downward1', 'downward2', 'result'];

const inputStyle: React.CSSProperties = {
  width: '100%', border: `1px solid ${T.grey200}`, padding: '10px 12px',
  fontSize: 13, color: T.grey900, background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: T.grey800, marginBottom: 6,
};

function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{title}</h3>
      {desc && <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{desc}</p>}
    </div>
  );
}

export default function CycleOpsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles, current, selectedId, setSelectedId,
    loading: cyclesLoading, reload: reloadCycles,
  } = useCurrentCycle();
  const cycleId = current?.id;
  const allowed = !!user && isHrAdmin(user.role);
  const [activeTab, setActiveTab] = useState<TabKey>('period');

  // ── 평가 기간: 주기 편집(없으면 생성) ──
  const [draft, setDraft] = useState({ name: '', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft({
      name: current?.name ?? '',
      startDate: current?.startDate ? current.startDate.slice(0, 10) : '',
      endDate: current?.endDate ? current.endDate.slice(0, 10) : '',
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSavePeriod() {
    if (!draft.name) return;
    setBusy(true);
    try {
      const year = draft.startDate ? new Date(draft.startDate).getFullYear() : undefined;
      const startISO = draft.startDate ? new Date(draft.startDate).toISOString() : undefined;
      const endISO = draft.endDate ? new Date(draft.endDate).toISOString() : undefined;
      if (cycleId) {
        await cycleCommands.update(cycleId, { name: draft.name, startDate: startISO, endDate: endISO, year });
        toast.show({ variant: 'success', message: '평가 기간을 저장했어요.' });
        reloadCycles();
      } else {
        if (!draft.startDate || !draft.endDate) {
          toast.show({ variant: 'danger', message: '시작일과 종료일을 입력해 주세요.' });
          setBusy(false);
          return;
        }
        const created = await cycleCommands.create({ name: draft.name, year: year!, startDate: startISO!, endDate: endISO! });
        toast.show({ variant: 'success', message: '평가 주기를 만들었어요.' });
        reloadCycles();
        setSelectedId(created.id);
      }
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setBusy(false);
    }
  }

  // ── 일정·대상자 ──
  const { data: schedData, loading: schedLoading, reload: reloadSched } = useSchedules(cycleId, { enabled: allowed && !!cycleId });
  const [phases, setPhases] = useState<PhaseDraft[]>([]);
  const [channels, setChannels] = useState({ inApp: true, email: true });
  const [schedBusy, setSchedBusy] = useState(false);
  useEffect(() => {
    const existing = schedData?.data ?? [];
    const byPhase = new Map(existing.map((s) => [s.phase, s]));
    setPhases(DEFAULT_PHASES.map((phase) => {
      const s = byPhase.get(phase);
      return {
        phase,
        startDate: s?.startDate ? s.startDate.slice(0, 10) : '',
        dueDate: s?.dueDate ? s.dueDate.slice(0, 10) : '',
        notifyOffsets: s?.notifyOffsets ?? [7, 3, 1],
        notifyEnabled: s?.notifyEnabled ?? true,
        isLocked: s?.isLocked ?? false,
      };
    }));
  }, [schedData]);

  async function saveSchedule() {
    if (!cycleId) return;
    setSchedBusy(true);
    const payload: ScheduleItemInput[] = phases
      .filter((p) => p.dueDate)
      .map((p) => ({
        phase: p.phase,
        startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
        dueDate: new Date(p.dueDate).toISOString(),
        notifyOffsets: p.notifyOffsets,
        notifyEnabled: p.notifyEnabled,
        isLocked: p.isLocked ?? false,
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

  // ── 조직·대상자 엑셀 임포트 ──
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

  if (!allowed) return <Forbidden message="평가 운영 설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="p-6 space-y-5" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>평가 운영</h1>
        <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>평가 기간과 단계별 일정·대상자를 관리합니다.</p>
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
            {cycles.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          {current && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px',
              color: current.status === 'active' ? T.green500 : T.grey600,
              background: current.status === 'active' ? '#e6f9f2' : T.grey100,
            }}>
              {current.status === 'active' ? '활성' : current.status === 'closed' ? '완료' : current.status}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* 좌측 메뉴 */}
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff', alignSelf: 'start' }}>
          {MENU.map(({ key, label, Icon, bg }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-all last:border-b-0"
                style={{
                  background: isActive ? T.grey100 : '#fff',
                  borderColor: T.grey200,
                  borderLeft: `3px solid ${isActive ? bg : 'transparent'}`,
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
          {/* 평가 기간 */}
          {activeTab === 'period' && (
            <>
              <ContentHeader
                title="평가 기간 설정"
                desc={cycleId ? '평가 주기 명칭과 기간을 설정합니다.' : '평가 주기가 없어요. 아래에 입력해 새 주기를 시작하세요.'}
              />
              <div style={{ padding: 24 }} className="space-y-5">
                <div>
                  <label style={labelStyle}>평가 명칭</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="예: 2026년 상반기 인사평가"
                    style={inputStyle}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>평가 시작일</label>
                    <input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>평가 종료일</label>
                    <input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void handleSavePeriod()}
                    disabled={busy || !draft.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                      fontSize: 13, fontWeight: 600, color: '#fff',
                      background: busy || !draft.name ? T.grey400 : T.blue500,
                      border: 'none', cursor: busy || !draft.name ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Save size={14} /> {busy ? '저장 중…' : cycleId ? '저장' : '주기 만들기'}
                  </button>
                </div>

                {cycles.length > 1 && (
                  <div style={{ marginTop: 8, borderTop: `1px solid ${T.grey200}`, paddingTop: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.grey700, marginBottom: 10 }}>전체 평가 주기</p>
                    <ul>
                      {cycles.map((c) => (
                        <li
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', marginBottom: 4,
                            border: `1px solid ${c.id === selectedId ? T.blue500 : T.grey200}`,
                            background: c.id === selectedId ? '#f0f6ff' : '#fff', cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 13, color: T.grey900 }}>{c.name}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px',
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
            </>
          )}

          {/* 일정·대상자 */}
          {activeTab === 'schedule' && (
            <>
              <ContentHeader title="일정·대상자" desc="단계별 마감일과 조직·대상자를 관리합니다." />
              {!current ? (
                <div style={{ padding: 48, textAlign: 'center', color: T.grey600, fontSize: 13 }}>
                  평가 기간 설정에서 주기를 먼저 만들어 주세요.
                </div>
              ) : schedLoading ? (
                <div style={{ padding: 48, textAlign: 'center', color: T.grey400, fontSize: 13 }}>불러오는 중…</div>
              ) : (
                <div style={{ padding: 24 }} className="space-y-6">
                  <ScheduleEditor
                    phases={phases}
                    onPhaseChange={(phase, patch) => setPhases((prev) => prev.map((p) => p.phase === phase ? { ...p, ...patch } : p))}
                    channels={channels}
                    onChannelsChange={setChannels}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => void saveSchedule()}
                      disabled={schedBusy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                        fontSize: 13, fontWeight: 600, color: '#fff',
                        background: schedBusy ? T.grey400 : T.blue500, border: 'none',
                        cursor: schedBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Save size={14} /> {schedBusy ? '저장 중…' : '일정 저장'}
                    </button>
                  </div>

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
        </div>
      </div>
    </div>
  );
}
