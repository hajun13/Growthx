'use client';

// 역량평가서 — 엑셀 양식 재현(본인·1차·2차·최종 4열 + [종합의견] + 평가점수 환산).
// 부서장 평가와 동일한 master-detail 레이아웃: 좌측 대상 목록(검색·상태필터), 우측 평가서.
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, PenLine } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import {
  EvaluationSubjectPanel,
  type EvaluationSubjectItem,
} from '@/components/EvaluationSubjectPanel';
import { SheetTable, STAGE_LABELS, DEFAULT_SCORE_LABELS } from './SheetTable';
import { OpinionSection } from './OpinionSection';
import { SubmitPanel } from './SubmitPanel';
import { useCompetencyForm } from './useCompetencyForm';
import { useCompetencySheet, useCompetencyTargets } from '../hooks';
import type { CompetencyStage, CompetencyTarget } from '../api';

function CompetencySkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </PageContainer>
  );
}

type StatusFilter = 'all' | 'waiting' | 'inprog' | 'done';
const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'waiting', label: '미작성' },
  { value: 'inprog', label: '작성중' },
  { value: 'done', label: '제출완료' },
];

function targetStatus(t: CompetencyTarget): StatusFilter {
  if (t.submitted) return 'done';
  if (t.answeredCount > 0) return 'inprog';
  return 'waiting';
}

function StatusChip({ status, progress }: { status: StatusFilter; progress?: string }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F7EC] px-2 py-0.5 text-[11px] font-semibold text-[#0B7A47]">
        <CheckCircle2 size={11} aria-hidden /> 제출완료
      </span>
    );
  }
  if (status === 'inprog') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF2FE] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#0257CE]">
        <PenLine size={11} aria-hidden /> 작성중{progress ? ` ${progress}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <CircleDashed size={11} aria-hidden /> 미작성
    </span>
  );
}

export function CompetencyEvalView() {
  return (
    <Suspense fallback={<CompetencySkeleton />}>
      <CompetencyEvalViewInner />
    </Suspense>
  );
}

function CompetencyEvalViewInner() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const cycleId = current?.id;

  // 평가 대상 선택 — null=본인 시트.
  const [targetId, setTargetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: targets, reload: reloadTargets } = useCompetencyTargets(cycleId, { enabled: !!user });
  const isSelf = !targetId || targetId === user?.id;

  const { data: sheet, loading: sheetLoading, error, reload: reloadSheet } = useCompetencySheet(
    { cycleId, userId: targetId ?? undefined },
    { enabled: !!user },
  );
  // 저장/제출 후 시트 + 대상 목록(진행·제출 상태) 동시 갱신.
  const reload = () => {
    void reloadSheet();
    void reloadTargets();
  };

  const myStage = (sheet?.myStage ?? null) as CompetencyStage | null;
  const questions = sheet?.questions ?? [];
  const responses = sheet?.responses ?? [];
  const myResponses = useMemo(
    () => (myStage ? responses.filter((r) => r.stage === myStage) : []),
    [responses, myStage],
  );
  const chainNames = useMemo(() => {
    const map: Partial<Record<CompetencyStage, string | null>> = {};
    for (const slot of sheet?.chain ?? []) map[slot.stage as CompetencyStage] = slot.name;
    return map;
  }, [sheet?.chain]);
  const savedOpinion = useMemo(
    () => sheet?.opinions.find((o) => o.stage === myStage)?.comment ?? '',
    [sheet?.opinions, myStage],
  );

  // 제출 후 다음 미제출 대상으로 자동 이동(부서장 평가와 동일 흐름).
  function advanceToNext() {
    const idx = targets.findIndex((t) => t.userId === targetId);
    const pool = [...targets.slice(idx + 1), ...targets.slice(0, Math.max(idx, 0))];
    const next = pool.find((t) => !t.submitted && t.userId !== targetId);
    if (next) setTargetId(next.userId);
  }

  const form = useCompetencyForm({
    cycleId,
    targetUserId: sheet?.evaluatee.id,
    isSelf,
    myStage,
    myUserId: user?.id,
    questions,
    myResponses,
    savedOpinion,
    reload,
    onSubmitted: advanceToNext,
  });
  const editable = !!sheet?.canEdit && !form.isSubmitted;

  // [평가가이드] 라벨 — 전 문항이 같은 5지 보기를 쓰면 그 보기, 아니면 기본 가이드라인.
  const guideLabels = useMemo(() => {
    const first = questions.find((q) => q.options?.length === 5)?.options;
    if (
      first &&
      questions.every((q) => !q.options?.length || q.options.join('|') === first.join('|'))
    ) {
      return first;
    }
    return DEFAULT_SCORE_LABELS;
  }, [questions]);

  // 미저장 응답이 있으면 페이지 이탈(새로고침/닫기) 경고.
  useEffect(() => {
    if (!form.hasDirty || form.isSubmitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [form.hasDirty, form.isSubmitted]);

  // 주기·대상 전환은 폼 상태를 초기화 — 미저장 변경이 있으면 확인 후 진행.
  const confirmDiscard = () =>
    !form.hasDirty ||
    form.isSubmitted ||
    window.confirm('작성 중인 내용이 저장되지 않았어요. 이동하면 사라져요. 계속할까요?');

  function handleSelectCycle(id: string) {
    if (!confirmDiscard()) return;
    setTargetId(null);
    setSelectedId(id);
  }
  function handleSelectTarget(id: string | null) {
    if (id === (isSelf ? null : targetId)) return;
    if (!confirmDiscard()) return;
    setTargetId(id);
  }

  if (cyclesLoading || (sheetLoading && !sheet)) return <CompetencySkeleton />;
  if (error) return <ErrorState onRetry={() => void reloadSheet()} />;
  if (!current) {
    return (
      <PageContainer>
        <EmptyState title="진행 중인 평가 주기가 없어요." description="HR 관리자에게 문의하세요." />
      </PageContainer>
    );
  }

  const isFinalStage = sheet?.cycleStatus === 'calibration' || sheet?.cycleStatus === 'closed';

  // ── 좌측 대상 목록: 본인(항상 상단 고정) + 구성원(검색·상태 필터). ──
  const filteredTargets = targets.filter((t) => {
    if (statusFilter !== 'all' && targetStatus(t) !== statusFilter) return false;
    if (!search) return true;
    return t.name.includes(search) || (t.departmentName ?? '').includes(search);
  });
  const selfStatus: StatusFilter = isSelf
    ? form.isSubmitted
      ? 'done'
      : form.answeredCount > 0
        ? 'inprog'
        : 'waiting'
    : 'all';
  const subjectItems: EvaluationSubjectItem[] = [
    {
      id: '__self',
      name: user?.name ?? '본인',
      meta: '본인 평가표',
      description: '본인평가 열 작성',
      active: isSelf,
      onSelect: () => handleSelectTarget(null),
      accessory: isSelf ? (
        <StatusChip status={selfStatus} progress={`${form.answeredCount}/${questions.length}`} />
      ) : undefined,
    },
    ...filteredTargets.map((t) => ({
      id: t.userId,
      name: t.name,
      meta: `내가 ${STAGE_LABELS[t.myStage as CompetencyStage]}`,
      description: [t.departmentName, t.position].filter(Boolean).join(' · ') || null,
      active: !isSelf && targetId === t.userId,
      onSelect: () => handleSelectTarget(t.userId),
      accessory: (
        <StatusChip status={targetStatus(t)} progress={`${t.answeredCount}/${t.questionCount}`} />
      ),
    })),
  ];
  const doneCount = targets.filter((t) => t.submitted).length;

  // ── 우측 평가서(시트) ──
  const sheetContent = sheet && (
    <div className="space-y-4">
      <HeaderMetrics
        items={[
          {
            label: '피평가자',
            value: `${sheet.evaluatee.name}${sheet.evaluatee.departmentName ? ` · ${sheet.evaluatee.departmentName}` : ''}`,
          },
          { label: '1차평가자', value: chainNames.round1 ?? '—' },
          { label: '2차평가자', value: chainNames.round2 ?? '—' },
          { label: '최종평가자', value: chainNames.round3 ?? '—' },
          ...(myStage
            ? [{ label: '내 작성 열', value: STAGE_LABELS[myStage], accent: 'text-primary' }]
            : []),
        ]}
      />

      {!sheet.scoresVisible && (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground">
          1차·2차·최종 평가자의 점수와 종합의견, 평가점수 환산은 평가가 완료되면 공개돼요.
        </div>
      )}

      {questions.length === 0 ? (
        <EmptyState
          title="진행 중인 역량평가 문항이 없어요."
          description="관리자가 문항을 등록하면 여기에 표시돼요."
        />
      ) : (
        <>
          {/* [평가가이드] — 엑셀 우측 가이드 블록. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 shadow-elev-1">
            <span className="text-[12px] font-bold text-foreground">[평가가이드]</span>
            {[5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="text-[12px] text-muted-foreground">
                <span className="mr-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-muted text-[11px] font-bold tabular-nums text-foreground">
                  {n}
                </span>
                {guideLabels[n - 1]}
              </span>
            ))}
          </div>

          <SheetTable
            questions={questions}
            responses={responses}
            chainNames={chainNames}
            evaluateeName={sheet.evaluatee.name}
            myStage={myStage}
            editable={editable}
            scoresVisible={sheet.scoresVisible}
            answers={form.answers}
            setAnswer={form.setAnswer}
          />

          <OpinionSection
            opinions={sheet.opinions}
            chainNames={chainNames}
            myStage={myStage}
            editable={editable}
            opinionDraft={form.opinion}
            setOpinionText={form.setOpinionText}
            conversion={sheet.conversion}
            scoresVisible={sheet.scoresVisible}
          />

          {editable && (
            <SubmitPanel
              answeredCount={form.answeredCount}
              totalCount={questions.length}
              progressPct={form.progressPct}
              allAnswered={form.allAnswered}
              saving={form.saving}
              submitting={form.submitting}
              onSave={() => void form.handleSave()}
              onSubmit={() => void form.handleSubmit()}
            />
          )}
        </>
      )}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="역량평가서"
        subtitle="본인평가와 1차·2차·최종 평가자 평가를 한 평가표에서 진행합니다. (연봉 미반영 · 참고용)"
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={handleSelectCycle}
        hideCycleBadge
        right={
          targets.length > 0 ? (
            <span className="inline-flex h-9 items-center rounded-[4px] bg-muted px-3.5 text-[12.5px] font-bold tabular-nums text-muted-foreground">
              구성원 제출 {doneCount}/{targets.length}
            </span>
          ) : undefined
        }
      />

      {!isFinalStage ? (
        <EmptyState
          title="지금은 역량평가 기간이 아니에요."
          description="역량평가는 12월 최종평가(조정/완료) 단계에만 진행돼요."
        />
      ) : targets.length > 0 ? (
        <div className="gx-master-detail">
          {/* ── 대상 목록(본인 + 구성원, 검색·상태 필터) — 부서장 평가와 동일 패턴. ── */}
          <div className="space-y-2.5 self-start">
            <FilterChipBar
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
            />
            <EvaluationSubjectPanel
              title="평가 대상"
              count={targets.length}
              search={search}
              onSearch={setSearch}
              searchPlaceholder="이름 검색"
              emptyMessage="검색 결과가 없어요."
              items={subjectItems}
            />
          </div>
          {sheetContent}
        </div>
      ) : (
        sheetContent
      )}
    </PageContainer>
  );
}
