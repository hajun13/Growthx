'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutTemplate, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpiTemplates } from '@/hooks/useKpiTemplates';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useKpiSnapshots, useKpiSnapshotDiff } from '@/hooks/useKpiSnapshots';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoBanner } from '@/components/InfoBanner';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import type { KpiGroup } from '@/lib/types';
import { useKpisData } from '../hooks';
import { kpiCommands, fetchKpisByStatus } from '../api';
import { KpiDraftCard } from './KpiDraftCard';
import { KpiDiffPanel } from './KpiDiffPanel';
import { EmptyState, ErrorState } from './KpiStates';
import {
  BottomActionBar,
  ChecklistItem,
  KpiBalancePanel,
  LockedKpiSection,
} from './KpiWriteParts';
import {
  CATEGORY_BY_GROUP,
  EMPTY_GRADING,
  KPI_GROUP_BASE,
  KPI_GROUP_MAX_EXTRA,
  draftToCreatePayload,
  draftToPayload,
  emptyDraft,
  toDraft,
} from './draft';
import type { DraftKpi } from './types';

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function KpiWriteView() {
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });
  const isLocked = phase?.isLocked ?? false;

  const { data: templateRes } = useKpiTemplates(
    { cycleId, jobLevel: user?.jobLevel },
    { enabled: !!cycleId && !!user?.jobLevel },
  );
  const template = templateRes?.data?.[0] ?? null;

  const { data, loading: kpiLoading, error, reload } = useKpisData(cycleId, user?.id);
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const { data: snapshotsRes } = useKpiSnapshots(
    cycleId,
    { userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const latestSnapshot = snapshotsRes?.data?.[0] ?? null;
  const { data: snapshotDiff } = useKpiSnapshotDiff(
    cycleId,
    latestSnapshot?.id,
    { enabled: !!cycleId && !!latestSnapshot },
  );

  const serverKpis = data?.data ?? [];
  const editableServer = serverKpis.filter((k) => k.status === 'draft');
  const lockedServer = serverKpis.filter((k) => k.status !== 'draft');

  const [drafts, setDrafts] = useState<DraftKpi[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 미저장 편집 여부 — 이탈(beforeunload) 경고용. 저장/제출 전량 성공 시 해제.
  const [dirty, setDirty] = useState(false);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);

  useEffect(() => {
    if (!dirty || isLocked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, isLocked]);

  // BUG-B(저장 직후 stale): 저장 성공 시 drafts 를 즉시 null 로 비우면 reload 응답 전까지
  // effectiveDrafts 가 저장 전 스냅샷(editableServer)으로 파생돼 방금 저장한 값이 사라져
  // 보이고, 그 창에서 재저장하면 stale draft 로 구값을 덮어쓴다. 저장본을 유지하다가
  // reload 응답(data 갱신)이 도착한 시점에, 그 사이 사용자가 편집하지 않았을 때만 정리한다.
  const clearDraftsOnReloadRef = useRef<DraftKpi[] | null>(null);
  useEffect(() => {
    const pending = clearDraftsOnReloadRef.current;
    if (!pending || !data) return;
    clearDraftsOnReloadRef.current = null;
    // reload 대기 중 편집이 있었으면(drafts 참조가 바뀜) 사용자 편집을 보존한다.
    setDrafts((prev) => (prev === pending ? null : prev));
  }, [data]);
  // 완료 KPI 펼침 상태 — 기본값 {} → 모두 접힘(collapsed). key = kpi.id
  const [expandedLocked, setExpandedLocked] = useState<Record<string, boolean>>({});

  function toggleLocked(id: string) {
    setExpandedLocked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const effectiveDrafts = useMemo(
    () => drafts ?? editableServer.map(toDraft),
    [drafts, editableServer],
  );

  const groupCount = useMemo<Record<KpiGroup, number>>(
    () => ({
      performance_core:
        effectiveDrafts.filter((d) => d.group === 'performance_core').length +
        lockedServer.filter((k) => k.group === 'performance_core').length,
      collaboration_growth:
        effectiveDrafts.filter((d) => d.group === 'collaboration_growth').length +
        lockedServer.filter((k) => k.group === 'collaboration_growth').length,
    }),
    [effectiveDrafts, lockedServer],
  );

  function canAddToGroup(g: KpiGroup): boolean {
    return groupCount[g] < KPI_GROUP_BASE[g] + KPI_GROUP_MAX_EXTRA;
  }

  const submissionComplete = lockedServer.length > 0 && effectiveDrafts.length === 0;

  const kpiDeadline = phase?.schedules?.find(
    (s) => s.phase === 'kpi_selection' || s.phase === 'self' || s.phase === 'kpi',
  )?.dueDate;
  const deadlineStr = kpiDeadline
    ? new Date(kpiDeadline).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '미설정';
  // 기한 임박(D-3 이내 또는 경과) 시 danger 강조.
  const deadlineImminent =
    !!kpiDeadline && new Date(kpiDeadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const overallStatus =
    serverKpis.length === 0
      ? '작성중'
      : serverKpis.every((k) => k.status === 'confirmed')
        ? '확정'
        : serverKpis.some((k) => k.status === 'submitted' || k.status === 'approved')
          ? '결재 진행중'
          : // 백엔드 reject 는 status 를 'draft' + rejectReason 으로 되돌린다('rejected' 상태 없음).
            serverKpis.some(
              (k) => k.status === 'rejected' || (k.status === 'draft' && k.rejectReason != null),
            )
            ? '반려'
            : '작성중';

  const weightTotal = effectiveDrafts.reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const coreTotal = effectiveDrafts.filter((d) => d.group === 'performance_core').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const growthTotal = effectiveDrafts.filter((d) => d.group === 'collaboration_growth').reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const qualitativeTotal = effectiveDrafts.filter((d) => d.isQualitative).reduce((acc, d) => acc + (Number(d.weight) || 0), 0);
  const lockedWeightTotal = lockedServer.reduce((acc, k) => acc + (k.weight ?? 0), 0);
  // 제출 게이트 = 확정(locked) + 작성중(draft) 가중치 합 — 백엔드 검증(siblings 전체 합산)과 정합.
  const combinedTotal = weightTotal + lockedWeightTotal;

  function updateDraft(idx: number, patch: Partial<DraftKpi>) {
    const base = drafts ?? editableServer.map(toDraft);
    if (patch.group && patch.group !== base[idx].group) {
      const targetCountExcludingSelf =
        base.filter((d, i) => i !== idx && d.group === patch.group).length +
        lockedServer.filter((k) => k.group === patch.group).length;
      if (targetCountExcludingSelf >= KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA) {
        toast.error(
          `${patch.group === 'performance_core' ? '성과중심' : '협업·성장'} 그룹은 최대 ${KPI_GROUP_BASE[patch.group] + KPI_GROUP_MAX_EXTRA}개까지 작성할 수 있어요.`,
          { duration: 8000 },
        );
        return;
      }
    }
    const next = base.map((d, i) => {
      if (i !== idx) return d;
      const merged = { ...d, ...patch };
      if (patch.group && !CATEGORY_BY_GROUP[patch.group].includes(merged.category)) {
        merged.category = CATEGORY_BY_GROUP[patch.group][0];
      }
      return merged;
    });
    setDrafts(next);
    setDirty(true);
  }

  function addDraftForGroup(g: KpiGroup) {
    if (!canAddToGroup(g)) return;
    const base = drafts ?? editableServer.map(toDraft);
    const draft = { ...emptyDraft(user?.role), group: g, category: CATEGORY_BY_GROUP[g][0] };
    setDrafts([...base, draft]);
    setDirty(true);
  }

  // 양식 적용 — 그룹별 잔여 슬롯만큼만 추가(중복 적재로 상한 초과 방지), 초과분은 토스트 안내.
  function applyTemplate() {
    if (!template) return;
    setTemplateConfirmOpen(false);
    const base = drafts ?? editableServer.map(toDraft);
    const remaining: Record<KpiGroup, number> = {
      performance_core: Math.max(0, KPI_GROUP_BASE.performance_core + KPI_GROUP_MAX_EXTRA - groupCount.performance_core),
      collaboration_growth: Math.max(0, KPI_GROUP_BASE.collaboration_growth + KPI_GROUP_MAX_EXTRA - groupCount.collaboration_growth),
    };
    const accepted: DraftKpi[] = [];
    let skipped = 0;
    for (const it of template.items) {
      if (remaining[it.group] <= 0) {
        skipped++;
        continue;
      }
      remaining[it.group]--;
      accepted.push({
        group: it.group,
        category: it.category,
        coreStrategy: '',
        csf: it.sampleStrategy ?? '',
        title: '',
        targetText: '',
        measureMethod: '',
        weight: it.defaultWeight ? String(it.defaultWeight) : '',
        isQualitative: it.isQualitative ?? false,
        gradingCriteria: { ...EMPTY_GRADING },
      });
    }
    if (accepted.length === 0) {
      toast.error(
        skipped > 0 ? '그룹별 작성 상한이 이미 가득 차 양식을 추가할 수 없어요.' : '적용 가능한 양식 항목이 없어요.',
        { duration: 8000 },
      );
      return;
    }
    setDrafts([...base, ...accepted]);
    setDirty(true);
    toast.success(
      skipped > 0
        ? `양식 ${accepted.length}개 항목을 불러왔어요. 그룹 상한 초과 ${skipped}개는 제외했어요.`
        : `양식 ${accepted.length}개 항목을 불러왔어요. 지표·목표를 입력해 주세요.`,
    );
  }

  function loadTemplate() {
    if (!template) return;
    // 이미 작성 중인 드래프트가 있으면 확인 후 추가(무심코 중복 적재 방지).
    if (effectiveDrafts.length > 0) {
      setTemplateConfirmOpen(true);
      return;
    }
    applyTemplate();
  }

  function guardLocked(): boolean {
    if (isLocked) {
      toast.error('현재 KPI 작성 기간이 아닙니다.', { duration: 8000 });
      return true;
    }
    return false;
  }

  async function handleSaveAll(): Promise<boolean> {
    if (!cycleId || guardLocked()) return false;
    setSavingAll(true);
    // create 성공분의 서버 id 를 즉시 반영 — 부분 실패 후 재시도해도 중복 생성되지 않는다.
    const base = effectiveDrafts.map((d) => ({ ...d }));
    const untitledCount = base.filter((d) => !d.title.trim()).length;
    let allOk = true;
    try {
      for (let i = 0; i < base.length; i++) {
        const d = base[i];
        if (!d.title.trim()) continue; // 미제목은 저장 skip — 화면에는 보존한다.
        if (d.id) {
          await kpiCommands.update(d.id, draftToPayload(d));
        } else {
          const created = await kpiCommands.create(draftToCreatePayload(cycleId, d));
          if (created?.id) base[i] = { ...d, id: created.id };
        }
      }
    } catch (err) {
      allOk = false;
      toast.error(err instanceof ApiError ? err.message : '저장 실패', { duration: 8000 });
    } finally {
      setSavingAll(false);
    }
    // 실패분·미제목(미저장) 드래프트를 화면에 보존 + 생성된 id 유지(재시도 시 update 경로).
    // BUG-B: 전량 성공 시에도 즉시 null 로 비우지 않고 저장본(base)을 유지 — reload 응답이
    // 도착하면 위 useEffect 가 정리한다(응답 전 재저장이 구값을 덮어쓰는 창 제거).
    setDrafts(base);
    if (allOk && untitledCount === 0) {
      clearDraftsOnReloadRef.current = base;
      setDirty(false);
    }
    if (allOk) {
      toast.success(
        untitledCount > 0
          ? `임시저장 완료 — 제목 없는 ${untitledCount}개는 제목을 입력해야 저장돼요.`
          : '임시저장 완료',
      );
    }
    reload();
    return allOk;
  }

  async function confirmDelete() {
    if (deleteTarget === null) return;
    const d = effectiveDrafts[deleteTarget];
    try {
      if (d.id) await kpiCommands.remove(d.id);
      const base = drafts ?? editableServer.map(toDraft);
      setDrafts(base.filter((_, i) => i !== deleteTarget));
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSubmitAll() {
    if (!cycleId || guardLocked()) return;
    setSubmitting(true);
    // create 성공분의 서버 id 를 즉시 반영 — 중간 실패 후 재시도 시 중복 생성 방지.
    const base = effectiveDrafts.map((d) => ({ ...d }));
    try {
      for (let i = 0; i < base.length; i++) {
        const d = base[i];
        if (d.id) {
          await kpiCommands.update(d.id, draftToPayload(d));
        } else {
          const created = await kpiCommands.create(draftToCreatePayload(cycleId, d));
          if (created?.id) base[i] = { ...d, id: created.id };
        }
      }
      const draftKpis = await fetchKpisByStatus(cycleId, user!.id, 'draft');
      for (const k of draftKpis) await kpiCommands.submit(k.id);
      toast.success('KPI를 제출했어요.');
      // BUG-B: 즉시 null 로 비우면 reload 전까지 저장 전 스냅샷이 보인다 — 제출본을 유지하고
      // reload 응답 도착 시 useEffect 가 정리(제출완료 모드로 전환)한다.
      setDrafts(base);
      clearDraftsOnReloadRef.current = base;
      setDirty(false);
      reload();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message || '가중치 합이 100%인지 확인해 주세요.'
            : err.code === 'PERIOD_LOCKED'
              ? '현재 KPI 작성 기간이 아닙니다.'
              : err.message
          : '제출에 실패했어요.';
      toast.error(msg, { duration: 8000 });
      setDrafts(base); // 이미 생성된 KPI 의 id 를 보존해 재시도 시 재생성을 막는다.
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !isLocked &&
    overallStatus !== '확정' &&
    effectiveDrafts.length > 0 &&
    // 확정(locked) 가중치 포함 합산 100% — draft 만 100% 요구하면 부분 반려 후 재제출 불가.
    combinedTotal === 100 &&
    effectiveDrafts.every((d) => d.title.trim().length > 0);

  if (cyclesLoading || (kpiLoading && !data)) return <KpiSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const isStatusFinalized = overallStatus === '확정';
  const isStatusSubmitted = overallStatus === '결재 진행중';
  const completionStatusAccent = isStatusFinalized
    ? 'text-success-600'
    : isStatusSubmitted
      ? 'text-info-600'
      : undefined;

  return (
    <PageContainer>
      <PageHeader
        title="KPI 작성"
        subtitle={`${current.name} · 2026 목표·측정방식을 서술형으로 작성하고, 각 KPI를 정성/정량으로 구분하세요. 가중치 합 100%는 필수, 정성 비중은 30% 이하를 권장해요.`}
        right={
          submissionComplete ? (
            <HeaderMetrics
              items={[
                { label: '평가 대상자', value: user?.name ?? '나' },
                { label: '평가 기간', value: current.name },
                { label: '제출 기한', value: deadlineStr },
                { label: '현재 상태', value: overallStatus, accent: completionStatusAccent },
              ]}
            />
          ) : (
            <>
              <HeaderMetrics
                items={[
                  { label: '평가 대상자', value: user?.name ?? '나' },
                  { label: '평가 기간', value: current.name },
                  {
                    label: '제출 기한',
                    value: deadlineStr,
                    accent: deadlineImminent ? 'text-danger-600' : undefined,
                  },
                ]}
              />
              {template && !isLocked && overallStatus !== '확정' && (
                <Button variant="outline" size="sm" onClick={loadTemplate}>
                  <LayoutTemplate aria-hidden />
                  양식 불러오기
                </Button>
              )}
            </>
          )
        }
      />

      {/* 잠금 안내 */}
      {isLocked && (
        <InfoBanner tone="tip" title="작성 기간이 아닙니다">
          현재 KPI 작성 기간이 아닙니다. 작성 기간이 열리면 다시 수정할 수 있어요.
        </InfoBanner>
      )}

      {/* 컨텍스트 카드 행 */}
      {!submissionComplete && (
        <>
          <KpiBalancePanel
            weightTotal={weightTotal}
            lockedWeightTotal={lockedWeightTotal}
            coreTotal={coreTotal}
            growthTotal={growthTotal}
            qualitativeTotal={qualitativeTotal}
            draftCount={effectiveDrafts.length}
            lockedCount={lockedServer.length}
          />
        </>
      )}

      {/* 제출 완료 모드: 확정 과제 섹션 */}
      {submissionComplete && (
        <LockedKpiSection
          kpis={lockedServer}
          weightTotal={lockedWeightTotal}
          scales={ruleSet?.gradingScales}
          expanded={expandedLocked}
          onToggle={toggleLocked}
        />
      )}

      {/* 편집 모드: KPI 카드 목록 */}
      {!submissionComplete && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-14 font-bold text-foreground">작성한 KPI</h3>
              <span className="text-12 text-muted-foreground">{effectiveDrafts.length}개 항목</span>
            </div>
            <div className="flex items-center gap-3 text-11h">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-sm bg-primary" />
                <span className="text-muted-foreground">성과중심</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-sm bg-foreground" />
                <span className="text-muted-foreground">협업·성장</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-4">
            {effectiveDrafts.length === 0 ? (
              <EmptyState
                title="아직 작성한 KPI가 없어요."
                description={`아래 '항목 추가'로 첫 KPI를 만들어 보세요${template ? '. 또는 상단 양식 불러오기로 시작할 수 있어요' : ''}.`}
              />
            ) : (
              effectiveDrafts.map((d, idx) => (
                <KpiDraftCard
                  key={d.id ?? `new-${idx}`}
                  index={idx}
                  draft={d}
                  onChange={(patch) => updateDraft(idx, patch)}
                  onDelete={() => setDeleteTarget(idx)}
                />
              ))
            )}

            {/* 그룹별 추가 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((g) => {
                const cnt = groupCount[g];
                const maxCnt = KPI_GROUP_BASE[g] + KPI_GROUP_MAX_EXTRA;
                const label = g === 'performance_core' ? '성과중심' : '협업·성장';
                const blocked = isLocked || overallStatus === '확정' || !canAddToGroup(g);
                return (
                  <Button
                    key={g}
                    variant="dashed"
                    size="dashed"
                    onClick={() => addDraftForGroup(g)}
                    disabled={blocked}
                  >
                    <PlusCircle aria-hidden />
                    <span>{label} 추가</span>
                    <span className="text-11 text-muted-foreground">{cnt} / {maxCnt}개</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 제출·확정된 과제 — 편집 모드에서도 접힌 카드로 상시 노출(전체 구성·가중치 파악용) */}
          {lockedServer.length > 0 && (
            <LockedKpiSection
              kpis={lockedServer}
              weightTotal={lockedWeightTotal}
              scales={ruleSet?.gradingScales}
              expanded={expandedLocked}
              onToggle={toggleLocked}
            />
          )}

          {/* 하단 고정 액션 바 */}
          <BottomActionBar
            weightTotal={weightTotal}
            lockedWeightTotal={lockedWeightTotal}
            qualitativeTotal={qualitativeTotal}
            canSubmit={canSubmit}
            savingAll={savingAll}
            submitting={submitting}
            draftsEmpty={effectiveDrafts.length === 0}
            isLocked={isLocked}
            onSave={() => void handleSaveAll()}
            onSubmit={() => void handleSubmitAll()}
          />

          {/* 참고 체크리스트 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-12 pb-16">
            <ChecklistItem ok={combinedTotal === 100}>
              가중치 합 {lockedWeightTotal > 0 ? `${weightTotal}% + 확정 ${lockedWeightTotal}% = ${combinedTotal}%` : `${weightTotal}%`} (100%)
            </ChecklistItem>
            <span className="text-muted-foreground">· 참고: 성과중심 {coreTotal}% · 협업·성장 {growthTotal}%</span>
            <span className={qualitativeTotal > 30 ? 'text-warning-600' : 'text-muted-foreground'}>
              · 정성 비중 {qualitativeTotal}% (권장 ≤30%)
            </span>
          </div>
        </>
      )}

      {/* 스냅샷 diff 패널 */}
      {latestSnapshot && snapshotDiff && (
        <KpiDiffPanel
          label={snapshotDiff.label}
          createdAt={snapshotDiff.createdAt}
          added={snapshotDiff.added}
          removed={snapshotDiff.removed}
          changed={snapshotDiff.changed}
          unchangedCount={snapshotDiff.unchangedCount}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>과제를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제하면 작성한 내용이 사라져요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 양식 불러오기 확인 — 드래프트 존재 시 중복 적재 방지 */}
      <Dialog open={templateConfirmOpen} onOpenChange={(o) => !o && setTemplateConfirmOpen(false)}>
        <DialogContent layout="scroll-footer">
          <DialogHeader>
            <DialogTitle>양식을 추가로 불러올까요?</DialogTitle>
          </DialogHeader>
          <p className="min-h-0 overflow-y-auto text-13 leading-relaxed text-muted-foreground">
            작성 중인 KPI {effectiveDrafts.length}개는 그대로 두고 양식 항목을 뒤에 추가해요.
            그룹별 작성 상한을 넘는 항목은 제외돼요.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateConfirmOpen(false)}>
              취소
            </Button>
            <Button onClick={applyTemplate}>불러오기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function KpiSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </PageContainer>
  );
}
