'use client';

// 평가 운영(HR) — 평가 기간 설정 + 일정·대상자. 설정에서 분리해 사이드바 독립 메뉴로.
// 별도 '새 평가 주기' 버튼은 제거 — 주기가 없으면 평가 기간 폼이 곧 생성 폼이 된다.
// 주기 CRUD 데이터 소스는 생성 클라이언트(@growthx/contracts) 기반 features/admin-cycle/hooks 로 이관.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar, CalendarDays, ChevronRight, Save, Camera, Plus, Trash2, History,
  ArrowRight, Bell, UserCheck, ChevronsRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { cycleCommands } from '../hooks';
import { evaluationCommands } from '@/hooks/useEvaluations';
import { useSchedules, scheduleCommands } from '@/hooks/useSchedules';
import { kpiSnapshotCommands } from '@/hooks/useKpiSnapshots';
import { notificationCommands } from '@/hooks/useNotifications';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { FileDropzone } from '@/components/FileDropzone';
import { ScheduleEditor, type PhaseDraft } from '@/components/ScheduleEditor';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { schedulePhaseText, cycleStatusText, isCycleOngoing } from '@/lib/ui';
import type { ScheduleItemInput, LegacyImportReport, EvaluationCycle, CycleStatus } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const K = {
  primary:   '#3f2c80',
  secondary: '#0054ca',
  tertiary:  '#0e9aa0',
  surface:   '#f8f9fd',
} as const;

const T = {
  grey900: '#191c1f',
  grey600: '#484551',
  grey500: '#797582',
  grey400: '#b0b8c1',
  grey200: '#e5e8eb',
  grey100: '#f2f4f6',
  red500:  '#f04452',
  orange500: '#fe9800',
} as const;

type TabKey = 'period' | 'schedule' | 'legacy';
const MENU: { key: TabKey; label: string; Icon: typeof Calendar; bg: string }[] = [
  { key: 'period',   label: '평가 기간 설정',       Icon: Calendar,     bg: K.secondary },
  { key: 'schedule', label: '일정·대상자',          Icon: CalendarDays, bg: '#484551' },
  { key: 'legacy',   label: '과거결과 임포트(YoY)', Icon: History,      bg: '#605d67' },
];
// Cycle Ops §1: KPI 라이프사이클 정규 키 5개.
const DEFAULT_PHASES = [
  'kpi_selection',
  'execution_h1',
  'mid_review',
  'execution_h2',
  'final_review',
];

// 단계 전환 선형 매핑
const CYCLE_NEXT: Partial<Record<CycleStatus, CycleStatus>> = {
  draft:       'active',
  active:      'mid_review',
  mid_review:  'calibration',
  calibration: 'closed',
};
const CYCLE_NEXT_LABEL: Partial<Record<CycleStatus, string>> = {
  draft:       '평가 시작',
  active:      '중간 점검 시작',
  mid_review:  '최종 조정 단계로',
  calibration: '평가 마감',
};
const CYCLE_TRANSITION_DESC: Partial<Record<CycleStatus, { title: string; body: string; variant?: 'warning' | 'danger' }>> = {
  active: {
    title: '평가를 시작할까요?',
    body: '평가를 시작합니다(진행중). 구성원 KPI 작성·본인평가가 열립니다.',
  },
  mid_review: {
    title: '중간 점검 단계를 열까요?',
    body: '중간 점검 단계를 엽니다. 구성원 진척 점검·자가평가·부서장 피드백·보완 조치·목표 재조정이 가능해집니다. (등급·연봉 미반영)',
  },
  calibration: {
    title: '최종 조정 단계로 진행할까요?',
    body: '최종 조정 단계입니다. 등급·보상 산정이 활성화됩니다. 신중히 진행하세요.',
    variant: 'warning',
  },
  closed: {
    title: '평가를 마감할까요?',
    body: '평가를 마감합니다. 이후 단계 진행·되돌리기가 불가합니다.',
    variant: 'danger',
  },
};

// 입력 공통 스타일
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid rgba(202,196,210,0.6)', borderRadius: 8, padding: '10px 12px',
  fontSize: 13, color: T.grey900, background: '#fff', outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: T.grey600,
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
};

// §2-3 카드 섹션 헤더
function ContentHeader({ title, desc, icon: Icon }: { title: string; desc?: string; icon?: React.ElementType }) {
  return (
    <div
      className="px-6 py-4 border-b border-[#e7e8ec] flex items-center gap-2.5"
      style={{ background: '#f2f3f7' }}
    >
      {Icon && <Icon size={17} color={K.secondary} />}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{title}</h3>
        {desc && <p style={{ fontSize: 11.5, color: T.grey500, marginTop: 1 }}>{desc}</p>}
      </div>
    </div>
  );
}

// 단계 상태 배지
function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const isOngoing = isCycleOngoing(status);
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      color: isOngoing ? K.tertiary : T.grey500,
      background: isOngoing ? 'rgba(14,154,160,0.1)' : T.grey100,
      border: `1px solid ${isOngoing ? 'rgba(14,154,160,0.25)' : 'rgba(202,196,210,0.5)'}`,
    }}>
      {cycleStatusText(status)}
    </span>
  );
}

// 다음 단계 전환 버튼 색 — 위험도별
function nextStatusColor(status?: CycleStatus): string {
  if (status === 'closed') return '#ba1a1a';
  if (status === 'calibration') return '#b45309';
  return K.secondary;
}

// YoY 과거결과 임포트 리포트 카드
function LegacyReportCard({ report, cycleName }: { report: LegacyImportReport; cycleName?: string }) {
  const summary: { label: string; value: number; tone?: 'ok' | 'warn' | 'err' }[] = [
    { label: '적재(imported)',          value: report.imported,          tone: 'ok' },
    { label: '재직 매칭(matched)',      value: report.matched },
    { label: '퇴사자 생성(createdResigned)', value: report.createdResigned },
    { label: '법인 갱신(legalEntityUpdated)', value: report.legalEntityUpdated },
    { label: '검토 필요(reviewQueue)',  value: report.reviewQueue,       tone: report.reviewQueue > 0 ? 'warn' : undefined },
    { label: '오류행(errors)',          value: report.errors.length,     tone: report.errors.length > 0 ? 'err' : undefined },
  ];
  const toneColor = (tone?: 'ok' | 'warn' | 'err') =>
    tone === 'ok' ? K.tertiary : tone === 'warn' ? '#b45309' : tone === 'err' ? '#ba1a1a' : T.grey900;

  return (
    <div style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, marginTop: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}>
      <div style={{
        padding: '12px 16px', background: report.ok ? 'rgba(14,154,160,0.08)' : '#f2f3f7',
        borderBottom: '1px solid #e7e8ec', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
          임포트 리포트 — {cycleName ?? '대상 주기'} (총 {report.total}행)
        </h4>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
          color: report.ok ? K.tertiary : '#b45309',
          background: report.ok ? 'rgba(14,154,160,0.12)' : '#fef3c7',
          border: `1px solid ${report.ok ? 'rgba(14,154,160,0.25)' : '#fed7aa'}`,
        }}>
          {report.ok ? '전건 정상 적재' : '부분 적재 — 확인 필요'}
        </span>
      </div>

      {/* 요약 수치 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {summary.map((s, i) => (
          <div key={s.label} style={{
            padding: '12px 16px',
            borderRight: (i % 3 !== 2) ? '1px solid rgba(202,196,210,0.2)' : 'none',
            borderBottom: i < 3 ? '1px solid rgba(202,196,210,0.2)' : 'none',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.grey500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: toneColor(s.tone), marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 검토큐 */}
      {report.review.length > 0 && (
        <details style={{ borderTop: '1px solid rgba(202,196,210,0.3)' }}>
          <summary style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: '#b45309', cursor: 'pointer', background: '#fffbeb' }}>
            검토 필요 {report.review.length}행 펼쳐보기
          </summary>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f2f3f7', color: T.grey500, position: 'sticky', top: 0 }}>
                  <th style={{ textAlign: 'right', padding: '6px 12px', width: 56 }}>행</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px', width: 120 }}>성명</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px' }}>사유</th>
                </tr>
              </thead>
              <tbody>
                {report.review.map((r, i) => (
                  <tr key={`${r.row}-${i}`} style={{ borderTop: '1px solid rgba(202,196,210,0.2)' }}>
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: T.grey600 }}>{r.row}</td>
                    <td style={{ padding: '6px 12px', color: T.grey900, fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '6px 12px', color: T.grey600 }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* 오류행 */}
      {report.errors.length > 0 && (
        <details style={{ borderTop: '1px solid rgba(202,196,210,0.3)' }}>
          <summary style={{ padding: '10px 16px', fontSize: 12.5, fontWeight: 600, color: '#ba1a1a', cursor: 'pointer', background: 'rgba(186,26,26,0.05)' }}>
            오류 {report.errors.length}행 펼쳐보기 (적재 제외)
          </summary>
          <div style={{ maxHeight: 220, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f2f3f7', color: T.grey500, position: 'sticky', top: 0 }}>
                  <th style={{ textAlign: 'right', padding: '6px 12px', width: 56 }}>행</th>
                  <th style={{ textAlign: 'left', padding: '6px 12px' }}>오류 메시지</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((e, i) => (
                  <tr key={`${e.row}-${i}`} style={{ borderTop: '1px solid rgba(202,196,210,0.2)' }}>
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: T.grey600 }}>{e.row}</td>
                    <td style={{ padding: '6px 12px', color: T.grey600 }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* 푸터 */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(202,196,210,0.3)', background: K.surface,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <p style={{ fontSize: 11.5, color: T.grey500, flex: 1, minWidth: 200 }}>
          재실행해도 안전해요 — 같은 행은 (사용자·주기)로 갱신되어 중복 적재되지 않아요.
        </p>
        <Link
          href="/reports/yoy"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: '#fff', background: K.secondary,
            padding: '8px 14px', textDecoration: 'none', borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,84,202,0.2)',
          }}
        >
          연도 비교 보기 <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

export function CycleOpsView() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles, current, selectedId, setSelectedId,
    loading: cyclesLoading, reload: reloadCycles,
  } = useCurrentCycle();
  const cycleId = current?.id;
  const allowed = !!user && isHrAdmin(user.role);
  const [activeTab, setActiveTab] = useState<TabKey>('period');

  // ── 평가 기간 ──
  const [draft, setDraft] = useState({ name: '', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const isCreateMode = !cycleId || creatingNew;
  useEffect(() => {
    if (creatingNew) return;
    setDraft({
      name: current?.name ?? '',
      startDate: current?.startDate ? current.startDate.slice(0, 10) : '',
      endDate: current?.endDate ? current.endDate.slice(0, 10) : '',
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNewCycle() {
    setCreatingNew(true);
    setDraft({ name: '', startDate: '', endDate: '' });
    setActiveTab('period');
  }
  function cancelNewCycle() {
    setCreatingNew(false);
    setDraft({
      name: current?.name ?? '',
      startDate: current?.startDate ? current.startDate.slice(0, 10) : '',
      endDate: current?.endDate ? current.endDate.slice(0, 10) : '',
    });
  }

  // ── 주기 단계 전환 ──
  const [confirmTransition, setConfirmTransition] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const nextStatus = current ? CYCLE_NEXT[current.status] : undefined;
  const nextLabel = current ? CYCLE_NEXT_LABEL[current.status] : undefined;
  const transitionDesc = nextStatus ? CYCLE_TRANSITION_DESC[nextStatus] : undefined;

  async function handleTransition() {
    if (!cycleId || !nextStatus) return;
    setTransitionBusy(true);
    try {
      await cycleCommands.updateStatus(cycleId, nextStatus);
      toast.show({ variant: 'success', message: `평가 주기를 "${cycleStatusText(nextStatus)}" 단계로 전환했어요.` });
      setConfirmTransition(false);
      reloadCycles();
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.code === 'INVALID_STATE_TRANSITION' ? '지금 단계에서 진행할 수 없어요.' : err.message)
        : '단계 전환에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setTransitionBusy(false);
    }
  }

  // ── 주기 삭제 ──
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const canDelete = !isCreateMode && !!current && current.status !== 'closed';

  async function handleDelete() {
    if (!cycleId) return;
    setDeleteBusy(true);
    try {
      await cycleCommands.remove(cycleId);
      toast.show({ variant: 'success', message: '평가 주기를 삭제했어요.' });
      setConfirmDelete(false);
      setSelectedId(null);
      reloadCycles();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' });
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleSavePeriod() {
    if (!draft.name) return;
    setBusy(true);
    try {
      const year = draft.startDate ? new Date(draft.startDate).getFullYear() : undefined;
      const startISO = draft.startDate ? new Date(draft.startDate).toISOString() : undefined;
      const endISO = draft.endDate ? new Date(draft.endDate).toISOString() : undefined;
      if (!isCreateMode) {
        await cycleCommands.update(cycleId!, { name: draft.name, startDate: startISO, endDate: endISO, year });
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
        setCreatingNew(false);
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

  // ── 단건 잠금 토글 ──
  const [lockBusyPhase, setLockBusyPhase] = useState<string | null>(null);
  const [reopenPhase, setReopenPhase] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenBusy, setReopenBusy] = useState(false);

  function handleToggleLock(phase: string, nextLocked: boolean) {
    if (!nextLocked) {
      setReopenPhase(phase);
      setReopenReason('');
      return;
    }
    void doSetLock(phase, true);
  }

  async function doSetLock(phase: string, isLocked: boolean, reason?: string) {
    if (!cycleId) return;
    setLockBusyPhase(phase);
    try {
      await scheduleCommands.setLock(cycleId, phase, isLocked, reason);
      toast.show({
        variant: 'success',
        message: isLocked
          ? `${schedulePhaseText(phase)} 단계를 잠갔어요.`
          : `${schedulePhaseText(phase)} 단계를 다시 열었어요.`,
      });
      reloadSched();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setLockBusyPhase(null);
    }
  }

  async function submitReopen() {
    if (!reopenPhase) return;
    const reason = reopenReason.trim();
    if (!reason) {
      toast.show({ variant: 'danger', message: '재오픈 사유를 입력해 주세요.' });
      return;
    }
    setReopenBusy(true);
    try {
      await doSetLock(reopenPhase, false, reason);
      setReopenPhase(null);
      setReopenReason('');
    } finally {
      setReopenBusy(false);
    }
  }

  // ── KPI 스냅샷 ──
  const [snapBusy, setSnapBusy] = useState(false);
  async function handleCreateSnapshot() {
    if (!cycleId) return;
    setSnapBusy(true);
    try {
      const res = await kpiSnapshotCommands.create(cycleId, '1차 확정');
      toast.show({ variant: 'success', message: `1차 KPI 스냅샷을 생성했어요. (${res.count}명)` });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '스냅샷 생성에 실패했어요.' });
    } finally {
      setSnapBusy(false);
    }
  }

  // ── 부서장 평가 재배정 ──
  const [reassignBusy, setReassignBusy] = useState(false);
  const [confirmReassign, setConfirmReassign] = useState(false);
  async function handleReassign() {
    if (!cycleId) return;
    setReassignBusy(true);
    try {
      const res = await evaluationCommands.autoAssignDownward(cycleId, true);
      toast.show({
        variant: 'success',
        message: `부서장 평가를 재배정했어요. 새 배정 ${res.created}건${res.deleted ? ` · 초기화 ${res.deleted}건` : ''} (대상 ${res.evaluatees}명).`,
      });
      setConfirmReassign(false);
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '재배정에 실패했어요.' });
    } finally {
      setReassignBusy(false);
    }
  }

  // ── 마감 리마인더 ──
  const [remindBusy, setRemindBusy] = useState(false);
  async function handleRunReminders() {
    setRemindBusy(true);
    try {
      const res = await notificationCommands.runReminders();
      if (res.batches === 0) {
        toast.show({ variant: 'info', message: '지금 보낼 마감 리마인더가 없어요. (오늘 도래한 D-N 없음)' });
      } else {
        toast.show({
          variant: 'success',
          message: `마감 리마인더 ${res.batches}건 발송 — 총 ${res.recipients}명 (${res.emailMode === 'smtp' ? '이메일+인앱' : '인앱(이메일 콘솔 폴백)'}).`,
        });
      }
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '리마인더 발송에 실패했어요.' });
    } finally {
      setRemindBusy(false);
    }
  }

  // ── 과거 결과 임포트(YoY) ──
  const closedCycles = cycles
    .filter((c) => c.status === 'closed')
    .sort((a, b) => b.year - a.year);
  const [legacyCycleId, setLegacyCycleId] = useState<string>('');
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyReport, setLegacyReport] = useState<LegacyImportReport | null>(null);
  useEffect(() => {
    if (!legacyCycleId && closedCycles.length > 0) {
      setLegacyCycleId(closedCycles[0].id);
    }
  }, [closedCycles, legacyCycleId]);

  async function handleLegacyImport(file: File) {
    if (!legacyCycleId) {
      toast.show({ variant: 'danger', message: '대상 평가 주기를 먼저 선택해 주세요.' });
      return;
    }
    setLegacyImporting(true);
    setLegacyReport(null);
    try {
      const report = await uploadExcel<LegacyImportReport>(
        '/excel/import/legacy-results',
        file,
        { cycleId: legacyCycleId },
      );
      setLegacyReport(report);
      if (report.ok) {
        toast.show({ variant: 'success', message: `과거결과 ${report.imported}건을 적재했어요.` });
      } else {
        toast.show({ variant: 'info', message: `${report.imported}건 적재 — 오류·검토 행이 있어요. 리포트를 확인해 주세요.` });
      }
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '업로드에 실패했어요.' });
    } finally {
      setLegacyImporting(false);
    }
  }

  if (!allowed) return <Forbidden message="평가 운영 설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <PageContainer>
      <PageHeader
        title="평가 운영"
        subtitle="평가 기간과 단계별 일정·잠금·알림을 관리합니다."
      />

      {/* 주기 선택 바 */}
      {cycles.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2.5 rounded-xl px-4 py-3"
          style={{
            background: '#fff',
            border: '1px solid rgba(202,196,210,0.5)',
            boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: T.grey500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            평가 주기
          </span>
          <div className="relative">
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={creatingNew}
              className="appearance-none px-3 py-1.5 pr-7 bg-white border border-[#cac4d2]/60 rounded-lg text-[13px] font-semibold text-[#191c1f] transition-colors cursor-pointer"
              style={{ opacity: creatingNew ? 0.5 : 1, minWidth: 200 }}
            >
              {cycles.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          {current && !creatingNew && (
            <CycleStatusBadge status={current.status} />
          )}

          {/* 단계 전환 버튼 */}
          {current && !creatingNew && nextStatus && nextLabel && (
            <button
              type="button"
              onClick={() => setConfirmTransition(true)}
              disabled={transitionBusy}
              title={`현재: ${cycleStatusText(current.status)} → 다음: ${cycleStatusText(nextStatus)}`}
              className="flex items-center gap-1.5 transition-opacity"
              style={{
                fontSize: 12.5, fontWeight: 700, borderRadius: 8,
                color: nextStatusColor(nextStatus),
                background: '#fff',
                border: `1.5px solid ${nextStatusColor(nextStatus)}`,
                padding: '6px 14px', cursor: transitionBusy ? 'not-allowed' : 'pointer',
                opacity: transitionBusy ? 0.6 : 1,
                boxShadow: `0 2px 6px ${nextStatus === 'closed' ? 'rgba(186,26,26,0.15)' : nextStatus === 'calibration' ? 'rgba(180,83,9,0.15)' : 'rgba(0,84,202,0.15)'}`,
              }}
            >
              <ChevronsRight size={14} />
              {nextLabel}
            </button>
          )}

          {!creatingNew && (
            <button
              type="button"
              onClick={startNewCycle}
              className="flex items-center gap-1.5 ml-auto"
              style={{
                fontSize: 12, fontWeight: 600, color: K.secondary, borderRadius: 8,
                background: '#fff', border: '1px solid rgba(0,84,202,0.4)', padding: '6px 12px', cursor: 'pointer',
              }}
            >
              <Plus size={13} /> 새 평가 주기
            </button>
          )}
          {creatingNew && (
            <span
              className="ml-auto"
              style={{
                fontSize: 11.5, fontWeight: 700, color: K.secondary,
                background: 'rgba(0,84,202,0.08)', border: '1px solid rgba(0,84,202,0.3)',
                padding: '4px 12px', borderRadius: 999,
              }}
            >
              새 평가 주기 작성 중
            </span>
          )}
        </div>
      )}

      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* 좌측 메뉴 */}
        <div
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            borderRadius: 12,
            background: '#fff',
            alignSelf: 'start',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
          }}
        >
          {MENU.map(({ key, label, Icon, bg }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-all last:border-b-0"
                style={{
                  background: isActive ? '#f2f3f7' : '#fff',
                  borderColor: 'rgba(202,196,210,0.3)',
                  borderLeft: `3px solid ${isActive ? bg : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f8f9fd'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = '#fff'; }}
              >
                <span className="flex items-center justify-center" style={{ width: 30, height: 30, background: bg, borderRadius: 6 }}>
                  <Icon size={14} color="#fff" />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? T.grey900 : T.grey600 }}>
                  {label}
                </span>
                <ChevronRight size={13} color={isActive ? T.grey900 : T.grey400} className="ml-auto" />
              </button>
            );
          })}
        </div>

        {/* 우측 콘텐츠 */}
        <div
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
          }}
        >
          {/* 평가 기간 */}
          {activeTab === 'period' && (
            <>
              <ContentHeader
                icon={Calendar}
                title={isCreateMode ? '새 평가 주기' : '평가 기간 설정'}
                desc={
                  creatingNew
                    ? '새 주기를 추가합니다. 기존 주기는 그대로 보존돼요.'
                    : cycleId
                      ? '선택한 평가 주기의 명칭과 기간을 수정합니다.'
                      : '평가 주기가 없어요. 아래에 입력해 새 주기를 시작하세요.'
                }
              />
              <div style={{ padding: 24 }} className="space-y-5">
                {/* 폼 필드 */}
                <div>
                  <label style={labelStyle}>평가 명칭 <span style={{ color: T.red500 }}>*</span></label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="예: 2026년 상반기 인사평가"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>평가 시작일</label>
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))}
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>평가 종료일</label>
                    <input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))}
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* 시작일 > 종료일 인라인 에러 */}
                {draft.startDate && draft.endDate && draft.startDate > draft.endDate && (
                  <p style={{ fontSize: 11, color: T.red500, marginTop: -8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> 시작일이 종료일보다 늦어요.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={busy || deleteBusy}
                        className="flex items-center gap-1.5"
                        style={{
                          padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#ba1a1a', borderRadius: 8,
                          background: '#fff', border: '1px solid #ba1a1a',
                          cursor: busy || deleteBusy ? 'not-allowed' : 'pointer',
                          opacity: busy || deleteBusy ? 0.6 : 1,
                        }}
                      >
                        <Trash2 size={14} /> 주기 삭제
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {creatingNew && (
                      <button
                        type="button"
                        onClick={cancelNewCycle}
                        disabled={busy}
                        style={{
                          padding: '10px 20px', fontSize: 13, fontWeight: 600, color: T.grey600, borderRadius: 8,
                          background: '#fff', border: '1px solid rgba(202,196,210,0.7)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                        }}
                      >
                        취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSavePeriod()}
                      disabled={busy || !draft.name || (!!draft.startDate && !!draft.endDate && draft.startDate > draft.endDate)}
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#fff',
                        background: (busy || !draft.name) ? 'rgba(202,196,210,0.6)' : K.primary,
                        borderRadius: 8, border: 'none',
                        cursor: (busy || !draft.name) ? 'not-allowed' : 'pointer',
                        boxShadow: (!busy && draft.name) ? '0 4px 12px rgba(63,44,128,0.25)' : 'none',
                      }}
                    >
                      <Save size={14} /> {busy ? '저장 중…' : isCreateMode ? '주기 만들기' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 일정·대상자 */}
          {activeTab === 'schedule' && (
            <>
              <ContentHeader icon={CalendarDays} title="일정·대상자" desc="단계별 마감일·잠금과 대상자 알림을 관리합니다." />
              {!current ? (
                <div className="flex flex-col items-center justify-center py-16" style={{ color: T.grey500 }}>
                  <CalendarDays size={32} color={T.grey200} strokeWidth={1.5} />
                  <p style={{ fontSize: 13, marginTop: 10 }}>평가 기간 설정에서 주기를 먼저 만들어 주세요.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('period')}
                    style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: K.secondary, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    평가 기간 설정으로 이동 →
                  </button>
                </div>
              ) : schedLoading ? (
                <div className="space-y-3 p-6">
                  {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : (
                <div style={{ padding: 24 }} className="space-y-6">
                  <ScheduleEditor
                    phases={phases}
                    onPhaseChange={(phase, patch) => setPhases((prev) => prev.map((p) => p.phase === phase ? { ...p, ...patch } : p))}
                    channels={channels}
                    onChannelsChange={setChannels}
                    onToggleLock={handleToggleLock}
                    lockBusyPhase={lockBusyPhase}
                  />
                  {/* 액션 버튼 그룹 */}
                  <div
                    className="flex flex-wrap justify-end gap-2 rounded-xl p-4"
                    style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.4)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setConfirmReassign(true)}
                      disabled={reassignBusy}
                      className="flex items-center gap-1.5 transition-colors"
                      title="아직 시작하지 않은 부서장 평가 배정을 초기화하고, 현재 팀장·본부장 권한 기준으로 다시 배정합니다."
                      style={{
                        padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: T.grey600, borderRadius: 8,
                        background: '#fff', border: '1px solid rgba(202,196,210,0.6)',
                        cursor: reassignBusy ? 'not-allowed' : 'pointer', opacity: reassignBusy ? 0.6 : 1,
                      }}
                    >
                      <UserCheck size={14} /> {reassignBusy ? '재배정 중…' : '부서장 평가 재배정'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRunReminders()}
                      disabled={remindBusy}
                      className="flex items-center gap-1.5"
                      title="단계별 알림 설정(D-7/D-3/D-1)과 마감일 기준으로 지금 리마인더를 보냅니다."
                      style={{
                        padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: T.grey600, borderRadius: 8,
                        background: '#fff', border: '1px solid rgba(202,196,210,0.6)',
                        cursor: remindBusy ? 'not-allowed' : 'pointer', opacity: remindBusy ? 0.6 : 1,
                      }}
                    >
                      <Bell size={14} /> {remindBusy ? '발송 중…' : '마감 리마인더 보내기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreateSnapshot()}
                      disabled={snapBusy}
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '9px 16px', fontSize: 12.5, fontWeight: 600, color: T.grey600, borderRadius: 8,
                        background: '#fff', border: '1px solid rgba(202,196,210,0.6)',
                        cursor: snapBusy ? 'not-allowed' : 'pointer', opacity: snapBusy ? 0.6 : 1,
                      }}
                    >
                      <Camera size={14} /> {snapBusy ? '생성 중…' : '1차 KPI 스냅샷 생성'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveSchedule()}
                      disabled={schedBusy}
                      className="flex items-center gap-1.5"
                      style={{
                        padding: '9px 20px', fontSize: 12.5, fontWeight: 700, color: '#fff',
                        background: schedBusy ? 'rgba(202,196,210,0.6)' : K.primary, borderRadius: 8, border: 'none',
                        cursor: schedBusy ? 'not-allowed' : 'pointer',
                        boxShadow: schedBusy ? 'none' : '0 4px 12px rgba(63,44,128,0.25)',
                      }}
                    >
                      <Save size={14} /> {schedBusy ? '저장 중…' : '일정 저장'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 과거 평가결과 임포트(YoY) */}
          {activeTab === 'legacy' && (
            <>
              <ContentHeader
                icon={History}
                title="과거 평가결과 임포트(YoY)"
                desc="과거 연도(예 2025) 평가결과 엑셀을 올려 연도 비교용으로 적재합니다."
              />
              <div style={{ padding: 24 }} className="space-y-5">
                {closedCycles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12" style={{ color: T.grey500 }}>
                    <History size={32} color={T.grey200} strokeWidth={1.5} />
                    <p style={{ fontSize: 13, marginTop: 10, textAlign: 'center', maxWidth: 320 }}>
                      완료(closed)된 과거 평가 주기가 없어요.
                    </p>
                    <p style={{ fontSize: 12, color: T.grey400, marginTop: 4, textAlign: 'center', maxWidth: 320 }}>
                      먼저 과거 연도 주기를 만들고 완료 상태로 전환한 뒤 결과를 임포트해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('period')}
                      style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: K.secondary, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      평가 기간 설정으로 이동 →
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>대상 평가 주기</label>
                      <select
                        value={legacyCycleId}
                        onChange={(e) => { setLegacyCycleId(e.target.value); setLegacyReport(null); }}
                        style={{ ...inputStyle, maxWidth: 360 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        {closedCycles.map((c: EvaluationCycle) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.year} · {cycleStatusText(c.status)})
                          </option>
                        ))}
                      </select>
                      <p style={{ fontSize: 11.5, color: T.grey500, marginTop: 6 }}>
                        선택한 주기에 결과가 적재돼요. 매년 새 연도가 끝나면 같은 방식으로 셀프서비스 업로드할 수 있어요.
                      </p>
                    </div>

                    <div
                      style={{
                        border: '1px solid rgba(202,196,210,0.5)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
                      }}
                    >
                      <div
                        className="px-4 py-3.5 border-b border-[#e7e8ec] flex items-center gap-2"
                        style={{ background: '#f2f3f7' }}
                      >
                        <History size={16} color={K.secondary} />
                        <div>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>결과 엑셀 업로드</h4>
                          <p style={{ fontSize: 11.5, color: T.grey500, marginTop: 1 }}>
                            원본 고정 레이아웃(평가자정리 시트)이라 양식 다운로드는 없어요. 이름으로 재직자를 매칭하고, 매칭 안 되는 퇴사자는 자동 생성돼요.
                          </p>
                        </div>
                      </div>
                      <div style={{ padding: 16 }}>
                        <FileDropzone
                          uploading={legacyImporting}
                          result={null}
                          showCommit={false}
                          onSelect={(file) => void handleLegacyImport(file)}
                          onClear={() => setLegacyReport(null)}
                        />
                      </div>
                    </div>

                    {legacyReport && (
                      <LegacyReportCard
                        report={legacyReport}
                        cycleName={closedCycles.find((c) => c.id === legacyReport.cycleId)?.name}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 재오픈 사유 입력 모달 */}
      <Modal
        open={reopenPhase !== null}
        onClose={() => { if (!reopenBusy) { setReopenPhase(null); setReopenReason(''); } }}
        title={`${reopenPhase ? schedulePhaseText(reopenPhase) : ''} 단계를 다시 열까요?`}
        primaryAction={{
          label: '다시 열기',
          onClick: () => void submitReopen(),
          loading: reopenBusy,
          disabled: reopenReason.trim().length === 0 || reopenBusy,
        }}
        secondaryAction={{ label: '취소', onClick: () => { setReopenPhase(null); setReopenReason(''); } }}
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: T.grey600, lineHeight: 1.6 }}>
            잠긴 단계를 다시 열면 해당 기간 동안 KPI 작성·수정이 허용돼요. 재오픈 사유는 감사 로그에 기록돼요.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="재오픈 사유를 입력해 주세요. (예: 중간평가 목표 조정 반영)"
            rows={3}
            style={{
              width: '100%', border: '1px solid rgba(202,196,210,0.7)', borderRadius: 8,
              padding: '9px 11px', fontSize: 13, color: T.grey900, background: K.surface,
              outline: 'none', resize: 'vertical',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = K.secondary; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.7)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {reopenReason.trim().length === 0 && reopenReason.length > 0 && (
            <p style={{ fontSize: 11, color: T.red500, marginTop: -8 }}>사유를 입력해 주세요.</p>
          )}
          <Link
            href="/admin/midterm/rebaseline"
            className="inline-flex items-center gap-1"
            style={{ fontSize: 12.5, color: K.secondary, fontWeight: 600 }}
          >
            KPI 목표를 조정하려면 → 목표 재조정 화면
            <ArrowRight size={13} />
          </Link>
        </div>
      </Modal>

      {/* 부서장 평가 재배정 확인 모달 */}
      <Modal
        open={confirmReassign}
        onClose={() => { if (!reassignBusy) setConfirmReassign(false); }}
        title="부서장 평가를 재배정할까요?"
        primaryAction={{
          label: '재배정',
          onClick: () => void handleReassign(),
          loading: reassignBusy,
          disabled: reassignBusy,
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmReassign(false) }}
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: T.grey600, lineHeight: 1.6 }}>
            <b style={{ color: T.grey900 }}>{current?.name}</b> 주기에서 아직 시작하지 않은 부서장 평가 배정을 초기화하고,{' '}
            <b style={{ color: T.grey900 }}>현재 팀장·본부장 권한</b> 기준으로 다시 배정해요.
            팀장·소속을 바꾼 뒤에 사용하세요.
          </p>
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5"
            style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.4)' }}
          >
            <CheckCircle2 size={14} color={K.tertiary} className="mt-0.5 shrink-0" />
            <p style={{ fontSize: 12, color: T.grey600 }}>
              이미 진행중이거나 제출·확정된 평가는 <b style={{ color: T.grey900 }}>그대로 보존</b>돼요.
            </p>
          </div>
        </div>
      </Modal>

      {/* 주기 단계 전환 확인 모달 */}
      <Modal
        open={confirmTransition}
        onClose={() => { if (!transitionBusy) setConfirmTransition(false); }}
        title={transitionDesc?.title ?? '단계를 전환할까요?'}
        primaryAction={{
          label: nextLabel ?? '전환',
          variant: transitionDesc?.variant === 'danger' ? 'danger' : undefined,
          onClick: () => void handleTransition(),
          loading: transitionBusy,
          disabled: transitionBusy,
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmTransition(false) }}
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: T.grey600, lineHeight: 1.6 }}>
            {transitionDesc?.body}
          </p>
          {/* 현재 → 다음 상태 시각화 */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.4)' }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: T.grey500 }}>현재</span>
            <span style={{ padding: '3px 10px', background: '#fff', border: '1px solid rgba(202,196,210,0.5)', borderRadius: 6, fontWeight: 600, color: T.grey600, fontSize: 12 }}>
              {current ? cycleStatusText(current.status) : ''}
            </span>
            <ChevronsRight size={14} color={T.grey400} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.grey500 }}>이후</span>
            <span style={{
              padding: '3px 10px', fontWeight: 700, borderRadius: 6, fontSize: 12,
              color: nextStatusColor(nextStatus),
              background: nextStatus === 'closed' ? 'rgba(186,26,26,0.08)' : nextStatus === 'calibration' ? '#fffbeb' : 'rgba(0,84,202,0.08)',
              border: `1px solid ${nextStatus === 'closed' ? 'rgba(186,26,26,0.2)' : nextStatus === 'calibration' ? '#fed7aa' : 'rgba(0,84,202,0.2)'}`,
            }}>
              {nextStatus ? cycleStatusText(nextStatus) : ''}
            </span>
          </div>
          {(transitionDesc?.variant === 'warning' || transitionDesc?.variant === 'danger') && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{
                background: transitionDesc.variant === 'danger' ? 'rgba(186,26,26,0.06)' : '#fffbeb',
                border: `1px solid ${transitionDesc.variant === 'danger' ? 'rgba(186,26,26,0.2)' : '#fed7aa'}`,
              }}
            >
              <AlertTriangle
                size={14}
                color={transitionDesc.variant === 'danger' ? '#ba1a1a' : '#b45309'}
                className="shrink-0"
              />
              <p style={{
                fontSize: 12, fontWeight: 700,
                color: transitionDesc.variant === 'danger' ? '#ba1a1a' : '#b45309',
              }}>
                이 작업은 되돌릴 수 없어요.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* 주기 삭제 확인 모달 */}
      <Modal
        open={confirmDelete}
        onClose={() => { if (!deleteBusy) setConfirmDelete(false); }}
        title="평가 주기를 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          onClick: () => void handleDelete(),
          loading: deleteBusy,
          disabled: deleteBusy,
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmDelete(false) }}
      >
        <div className="space-y-3">
          <p style={{ fontSize: 13, color: T.grey600, lineHeight: 1.6 }}>
            <b style={{ color: T.grey900 }}>{current?.name}</b> 주기와 이 주기에 속한 모든 데이터(일정·KPI·평가·결과·보상 등)가 영구 삭제돼요.
          </p>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.2)' }}
          >
            <AlertTriangle size={14} color="#ba1a1a" className="shrink-0" />
            <p style={{ fontSize: 12, fontWeight: 700, color: '#ba1a1a' }}>
              이 작업은 되돌릴 수 없어요.
            </p>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
