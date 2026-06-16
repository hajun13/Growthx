'use client';

// 평가 운영(HR) — 평가 기간 설정 + 일정·대상자 + 과거결과 임포트(YoY).
// 서브 컴포넌트: CycleSelectorBar / LegacyReportCard / CycleOpsModals
import { useEffect, useState } from 'react';
import {
  Calendar, CalendarDays, History,
  Save, Plus, Trash2, Camera, Bell, UserCheck, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { cycleCommands } from '../hooks';
import { evaluationCommands } from '@/hooks/useEvaluations';
import { useSchedules, scheduleCommands } from '@/hooks/useSchedules';
import { kpiSnapshotCommands } from '@/hooks/useKpiSnapshots';
import { notificationCommands } from '@/hooks/useNotifications';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { FileDropzone } from '@/components/FileDropzone';
import { ScheduleEditor, type PhaseDraft } from '@/components/ScheduleEditor';
import { Forbidden, Skeleton, EmptyState } from '@/components/States';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { isHrAdmin } from '@/lib/nav';
import { schedulePhaseText, cycleStatusText } from '@/lib/ui';
import type { ScheduleItemInput, LegacyImportReport, EvaluationCycle, CycleStatus } from '@/lib/types';
import { CycleSelectorBar } from './CycleSelectorBar';
import { LegacyReportCard } from './LegacyReportCard';
import {
  ReopenModal, ReassignModal, TransitionModal, DeleteCycleModal,
} from './CycleOpsModals';

type TabKey = 'period' | 'schedule' | 'legacy';
const MENU: { key: TabKey; label: string; Icon: typeof Calendar }[] = [
  { key: 'period',   label: '평가 기간 설정',       Icon: Calendar },
  { key: 'schedule', label: '일정·대상자',          Icon: CalendarDays },
  { key: 'legacy',   label: '과거결과 임포트(YoY)', Icon: History },
];

const DEFAULT_PHASES = ['kpi_selection', 'execution_h1', 'mid_review', 'execution_h2', 'final_review'];

const CYCLE_NEXT: Partial<Record<CycleStatus, CycleStatus>> = {
  draft: 'active', active: 'mid_review', mid_review: 'calibration', calibration: 'closed',
};
const CYCLE_NEXT_LABEL: Partial<Record<CycleStatus, string>> = {
  draft: '평가 시작', active: '중간 점검 시작', mid_review: '최종 조정 단계로', calibration: '평가 마감',
};

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

  // ── 평가 기간 ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState({ name: '', startDate: '', endDate: '', hireCutoffDate: '' });
  const [busy, setBusy] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const isCreateMode = !cycleId || creatingNew;

  useEffect(() => {
    if (creatingNew) return;
    setDraft({
      name: current?.name ?? '',
      startDate: current?.startDate ? current.startDate.slice(0, 10) : '',
      endDate: current?.endDate ? current.endDate.slice(0, 10) : '',
      hireCutoffDate: current?.hireCutoffDate ? current.hireCutoffDate.slice(0, 10) : '',
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNewCycle() {
    setCreatingNew(true);
    setDraft({ name: '', startDate: '', endDate: '', hireCutoffDate: '' });
    setActiveTab('period');
  }
  function cancelNewCycle() {
    setCreatingNew(false);
    setDraft({
      name: current?.name ?? '',
      startDate: current?.startDate ? current.startDate.slice(0, 10) : '',
      endDate: current?.endDate ? current.endDate.slice(0, 10) : '',
      hireCutoffDate: current?.hireCutoffDate ? current.hireCutoffDate.slice(0, 10) : '',
    });
  }

  async function handleSavePeriod() {
    if (!draft.name) return;
    setBusy(true);
    try {
      const year = draft.startDate ? new Date(draft.startDate).getFullYear() : undefined;
      const startISO = draft.startDate ? new Date(draft.startDate).toISOString() : undefined;
      const endISO = draft.endDate ? new Date(draft.endDate).toISOString() : undefined;
      const hireCutoffISO = draft.hireCutoffDate ? new Date(draft.hireCutoffDate).toISOString() : null;
      if (!isCreateMode) {
        await cycleCommands.update(cycleId!, { name: draft.name, startDate: startISO, endDate: endISO, year, hireCutoffDate: hireCutoffISO });
        toast.show({ variant: 'success', message: '평가 기간을 저장했어요.' });
        reloadCycles();
      } else {
        if (!draft.startDate || !draft.endDate) {
          toast.show({ variant: 'danger', message: '시작일과 종료일을 입력해 주세요.' });
          setBusy(false); return;
        }
        const created = await cycleCommands.create({ name: draft.name, year: year!, startDate: startISO!, endDate: endISO!, hireCutoffDate: hireCutoffISO });
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

  // ── 단계 전환 ───────────────────────────────────────────────────────────────
  const [confirmTransition, setConfirmTransition] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const nextStatus = current ? CYCLE_NEXT[current.status] : undefined;
  const nextLabel = current ? CYCLE_NEXT_LABEL[current.status] : undefined;

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

  // ── 주기 삭제 ───────────────────────────────────────────────────────────────
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

  // ── 일정·대상자 ─────────────────────────────────────────────────────────────
  const { data: schedData, loading: schedLoading, reload: reloadSched } = useSchedules(cycleId, { enabled: allowed && !!cycleId });
  const [phases, setPhases] = useState<PhaseDraft[]>([]);
  const [channels, setChannels] = useState({ inApp: true, email: true });
  const [schedBusy, setSchedBusy] = useState(false);

  useEffect(() => {
    const existing = schedData?.data ?? [];
    const byPhase = new Map(existing.map((s) => [s.phase, s]));
    setPhases(DEFAULT_PHASES.map((phase) => {
      const s = byPhase.get(phase);
      return { phase, startDate: s?.startDate ? s.startDate.slice(0, 10) : '', dueDate: s?.dueDate ? s.dueDate.slice(0, 10) : '', notifyOffsets: s?.notifyOffsets ?? [7, 3, 1], notifyEnabled: s?.notifyEnabled ?? true, isLocked: s?.isLocked ?? false };
    }));
  }, [schedData]);

  async function saveSchedule() {
    if (!cycleId) return;
    setSchedBusy(true);
    const payload: ScheduleItemInput[] = phases
      .filter((p) => p.dueDate)
      .map((p) => ({ phase: p.phase, startDate: p.startDate ? new Date(p.startDate).toISOString() : null, dueDate: new Date(p.dueDate).toISOString(), notifyOffsets: p.notifyOffsets, notifyEnabled: p.notifyEnabled }));
    if (payload.length === 0) {
      toast.show({ variant: 'danger', message: '마감일을 하나 이상 입력해 주세요.' });
      setSchedBusy(false); return;
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

  // ── 단계 잠금 토글 ─────────────────────────────────────────────────────────
  const [lockBusyPhase, setLockBusyPhase] = useState<string | null>(null);
  const [reopenPhase, setReopenPhase] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenBusy, setReopenBusy] = useState(false);

  function handleToggleLock(phase: string, nextLocked: boolean) {
    if (!nextLocked) { setReopenPhase(phase); setReopenReason(''); return; }
    void doSetLock(phase, true);
  }
  async function doSetLock(phase: string, isLocked: boolean, reason?: string) {
    if (!cycleId) return;
    setLockBusyPhase(phase);
    try {
      await scheduleCommands.setLock(cycleId, phase, isLocked, reason);
      toast.show({ variant: 'success', message: isLocked ? `${schedulePhaseText(phase)} 단계를 잠갔어요.` : `${schedulePhaseText(phase)} 단계를 다시 열었어요.` });
      reloadSched();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '처리에 실패했어요.' });
    } finally {
      setLockBusyPhase(null);
    }
  }
  async function submitReopen() {
    if (!reopenPhase) return;
    const reason = reopenReason.trim();
    if (!reason) { toast.show({ variant: 'danger', message: '재오픈 사유를 입력해 주세요.' }); return; }
    setReopenBusy(true);
    try { await doSetLock(reopenPhase, false, reason); setReopenPhase(null); setReopenReason(''); }
    finally { setReopenBusy(false); }
  }

  // ── KPI 스냅샷 ─────────────────────────────────────────────────────────────
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

  // ── 부서장 평가 재배정 ─────────────────────────────────────────────────────
  const [reassignBusy, setReassignBusy] = useState(false);
  const [confirmReassign, setConfirmReassign] = useState(false);
  async function handleReassign() {
    if (!cycleId) return;
    setReassignBusy(true);
    try {
      const res = await evaluationCommands.autoAssignDownward(cycleId, true);
      toast.show({ variant: 'success', message: `부서장 평가를 재배정했어요. 새 배정 ${res.created}건${res.deleted ? ` · 초기화 ${res.deleted}건` : ''} (대상 ${res.evaluatees}명).` });
      setConfirmReassign(false);
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '재배정에 실패했어요.' });
    } finally {
      setReassignBusy(false);
    }
  }

  // ── 마감 리마인더 ───────────────────────────────────────────────────────────
  const [remindBusy, setRemindBusy] = useState(false);
  async function handleRunReminders() {
    setRemindBusy(true);
    try {
      const res = await notificationCommands.runReminders();
      if (res.batches === 0) {
        toast.show({ variant: 'info', message: '지금 보낼 마감 리마인더가 없어요.' });
      } else {
        toast.show({ variant: 'success', message: `마감 리마인더 ${res.batches}건 발송 — 총 ${res.recipients}명.` });
      }
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '리마인더 발송에 실패했어요.' });
    } finally {
      setRemindBusy(false);
    }
  }

  // ── 과거 결과 임포트(YoY) ──────────────────────────────────────────────────
  const closedCycles = cycles.filter((c) => c.status === 'closed').sort((a, b) => b.year - a.year);
  const [legacyCycleId, setLegacyCycleId] = useState<string>('');
  const [legacyImporting, setLegacyImporting] = useState(false);
  const [legacyReport, setLegacyReport] = useState<LegacyImportReport | null>(null);

  useEffect(() => {
    if (!legacyCycleId && closedCycles.length > 0) setLegacyCycleId(closedCycles[0].id);
  }, [closedCycles, legacyCycleId]);

  async function handleLegacyImport(file: File) {
    if (!legacyCycleId) { toast.show({ variant: 'danger', message: '대상 평가 주기를 먼저 선택해 주세요.' }); return; }
    setLegacyImporting(true);
    setLegacyReport(null);
    try {
      const report = await uploadExcel<LegacyImportReport>('/excel/import/legacy-results', file, { cycleId: legacyCycleId });
      setLegacyReport(report);
      if (report.ok) { toast.show({ variant: 'success', message: `과거결과 ${report.imported}건을 적재했어요.` }); }
      else { toast.show({ variant: 'info', message: `${report.imported}건 적재 — 오류·검토 행이 있어요.` }); }
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '업로드에 실패했어요.' });
    } finally {
      setLegacyImporting(false);
    }
  }

  // ── 가드 ────────────────────────────────────────────────────────────────────
  if (!allowed) return <Forbidden message="평가 운영 설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  const dateError = draft.startDate && draft.endDate && draft.startDate > draft.endDate;

  return (
    <PageContainer>
      <PageHeader
        title="평가 운영"
        subtitle="평가 기간과 단계별 일정·잠금·알림을 관리합니다."
      />

      {/* 주기 선택 바 */}
      <CycleSelectorBar
        cycles={cycles}
        current={current ?? undefined}
        selectedId={selectedId}
        onSelect={setSelectedId}
        creatingNew={creatingNew}
        onStartNew={startNewCycle}
        nextStatus={nextStatus}
        nextLabel={nextLabel}
        transitionBusy={transitionBusy}
        onTransitionClick={() => setConfirmTransition(true)}
      />

      {/* 본문 2단 레이아웃 */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '220px 1fr' }}>
        {/* 좌측 메뉴 */}
        <Card className="self-start overflow-hidden p-0">
          {MENU.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 transition-colors ${
                  isActive ? 'bg-muted border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-transparent hover:bg-accent'
                }`}
              >
                <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-primary' : 'bg-muted-foreground/60'}`}>
                  <Icon size={14} className="text-white" aria-hidden />
                </span>
                <span className={`text-[12.5px] ${isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </Card>

        {/* 우측 콘텐츠 */}
        <Card className="overflow-hidden p-0">
          {/* ── 평가 기간 탭 ── */}
          {activeTab === 'period' && (
            <>
              <div className="flex items-center gap-2.5 border-b border-border bg-muted px-6 py-4">
                <Calendar size={17} className="text-primary" aria-hidden />
                <div>
                  <h3 className="text-[14px] font-bold text-foreground">
                    {isCreateMode ? '새 평가 주기' : '평가 기간 설정'}
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {creatingNew ? '새 주기를 추가합니다. 기존 주기는 그대로 보존돼요.'
                      : cycleId ? '선택한 평가 주기의 명칭과 기간을 수정합니다.'
                      : '평가 주기가 없어요. 아래에 입력해 새 주기를 시작하세요.'}
                  </p>
                </div>
              </div>
              <div className="space-y-5 p-6">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cycle-name" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    평가 명칭 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cycle-name"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="예: 2026년 상반기 인사평가"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="start-date" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">평가 시작일</Label>
                    <Input id="start-date" type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="end-date" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">평가 종료일</Label>
                    <Input id="end-date" type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hire-cutoff" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">평가 대상 제외 기준일 (입사일)</Label>
                  <Input id="hire-cutoff" type="date" value={draft.hireCutoffDate} onChange={(e) => setDraft((p) => ({ ...p, hireCutoffDate: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">이 날짜 이후 입사자는 평가 대상에서 제외됩니다. 비워두면 모든 재직자가 대상이에요.</p>
                </div>

                {dateError && (
                  <InfoBanner tone="warning">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={12} aria-hidden /> 시작일이 종료일보다 늦어요.
                    </span>
                  </InfoBanner>
                )}

                <div className="flex items-center justify-between gap-2">
                  {canDelete && (
                    <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} disabled={busy || deleteBusy} onClick={() => setConfirmDelete(true)}>
                      주기 삭제
                    </Button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {creatingNew && (
                      <Button variant="secondary" disabled={busy} onClick={cancelNewCycle}>취소</Button>
                    )}
                    <Button
                      variant="primary"
                      leftIcon={<Save size={14} />}
                      loading={busy}
                      disabled={busy || !draft.name || !!dateError}
                      onClick={() => void handleSavePeriod()}
                    >
                      {isCreateMode ? '주기 만들기' : '저장'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 일정·대상자 탭 ── */}
          {activeTab === 'schedule' && (
            <>
              <div className="flex items-center gap-2.5 border-b border-border bg-muted px-6 py-4">
                <CalendarDays size={17} className="text-primary" aria-hidden />
                <div>
                  <h3 className="text-[14px] font-bold text-foreground">일정·대상자</h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">단계별 마감일·잠금과 대상자 알림을 관리합니다.</p>
                </div>
              </div>
              {!current ? (
                <div className="p-6">
                  <EmptyState
                    title="평가 주기가 없어요."
                    description="평가 기간 설정에서 주기를 먼저 만들어 주세요."
                    action={<Button variant="secondary" onClick={() => setActiveTab('period')}>평가 기간 설정으로 이동</Button>}
                  />
                </div>
              ) : schedLoading ? (
                <div className="space-y-3 p-6">
                  {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : (
                <div className="space-y-6 p-6">
                  <ScheduleEditor
                    phases={phases}
                    onPhaseChange={(phase, patch) => setPhases((prev) => prev.map((p) => p.phase === phase ? { ...p, ...patch } : p))}
                    channels={channels}
                    onChannelsChange={setChannels}
                    onToggleLock={handleToggleLock}
                    lockBusyPhase={lockBusyPhase}
                  />
                  <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-muted p-4">
                    <Button variant="secondary" size="sm" leftIcon={<UserCheck size={14} />} loading={reassignBusy} onClick={() => setConfirmReassign(true)}>
                      부서장 평가 재배정
                    </Button>
                    <Button variant="secondary" size="sm" leftIcon={<Bell size={14} />} loading={remindBusy} onClick={() => void handleRunReminders()}>
                      마감 리마인더 보내기
                    </Button>
                    <Button variant="secondary" size="sm" leftIcon={<Camera size={14} />} loading={snapBusy} onClick={() => void handleCreateSnapshot()}>
                      1차 KPI 스냅샷 생성
                    </Button>
                    <Button variant="primary" size="sm" leftIcon={<Save size={14} />} loading={schedBusy} onClick={() => void saveSchedule()}>
                      일정 저장
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── 과거결과 임포트 탭 ── */}
          {activeTab === 'legacy' && (
            <>
              <div className="flex items-center gap-2.5 border-b border-border bg-muted px-6 py-4">
                <History size={17} className="text-primary" aria-hidden />
                <div>
                  <h3 className="text-[14px] font-bold text-foreground">과거 평가결과 임포트(YoY)</h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">과거 연도 평가결과 엑셀을 올려 연도 비교용으로 적재합니다.</p>
                </div>
              </div>
              <div className="space-y-5 p-6">
                {closedCycles.length === 0 ? (
                  <EmptyState
                    title="완료된 과거 평가 주기가 없어요."
                    description="먼저 과거 연도 주기를 만들고 완료 상태로 전환한 뒤 결과를 임포트해 주세요."
                    action={<Button variant="secondary" onClick={() => setActiveTab('period')}>평가 기간 설정으로 이동</Button>}
                  />
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">대상 평가 주기</Label>
                      <Select value={legacyCycleId} onValueChange={(v) => { setLegacyCycleId(v); setLegacyReport(null); }}>
                        <SelectTrigger className="max-w-[360px]">
                          <SelectValue placeholder="주기 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {closedCycles.map((c: EvaluationCycle) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.year} · {cycleStatusText(c.status)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-muted-foreground">선택한 주기에 결과가 적재돼요. 매년 새 연도가 끝나면 같은 방식으로 셀프서비스 업로드할 수 있어요.</p>
                    </div>

                    <Card title="결과 엑셀 업로드" padding="sm">
                      <p className="mb-3 text-[11.5px] text-muted-foreground">
                        원본 고정 레이아웃(평가자정리 시트)이라 양식 다운로드는 없어요. 이름으로 재직자를 매칭하고, 매칭 안 되는 퇴사자는 자동 생성돼요.
                      </p>
                      <FileDropzone
                        uploading={legacyImporting}
                        result={null}
                        showCommit={false}
                        onSelect={(file) => void handleLegacyImport(file)}
                        onClear={() => setLegacyReport(null)}
                      />
                    </Card>

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
        </Card>
      </div>

      {/* ── 모달 ─────────────────────────────────────────────────────────────── */}
      <ReopenModal
        open={reopenPhase !== null}
        phase={reopenPhase}
        reason={reopenReason}
        busy={reopenBusy}
        phaseLabel={schedulePhaseText}
        onReasonChange={setReopenReason}
        onConfirm={() => void submitReopen()}
        onClose={() => { setReopenPhase(null); setReopenReason(''); }}
      />
      <ReassignModal
        open={confirmReassign}
        busy={reassignBusy}
        cycle={current ?? undefined}
        onConfirm={() => void handleReassign()}
        onClose={() => setConfirmReassign(false)}
      />
      <TransitionModal
        open={confirmTransition}
        busy={transitionBusy}
        current={current ?? undefined}
        nextStatus={nextStatus}
        nextLabel={nextLabel}
        onConfirm={() => void handleTransition()}
        onClose={() => setConfirmTransition(false)}
      />
      <DeleteCycleModal
        open={confirmDelete}
        busy={deleteBusy}
        cycle={current ?? undefined}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
