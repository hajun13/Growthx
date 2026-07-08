'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import { QuestionCard } from './QuestionCard';
import { SubmitPanel } from './SubmitPanel';
import { useCompetencyForm } from './useCompetencyForm';
import { useCompetencyQuestions, useCompetencyResponses } from '../hooks';

function CompetencySkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </PageContainer>
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

  // role에 따라 targetGroup 자동 결정: hr_admin은 전체, 직책자는 manager, 일반직원은 non_manager
  const targetGroup = useMemo(() => {
    if (!user) return undefined;
    if (user.role === 'hr_admin') return undefined;
    if (user.role === 'team_lead' || user.role === 'division_head') return 'manager';
    return 'non_manager';
  }, [user?.role]);

  const targetGroupDisplay = useMemo(() => {
    if (targetGroup === 'manager') return '직책자';
    if (targetGroup === 'non_manager') return '비직책자';
    return null;
  }, [targetGroup]);

  const { data: questionsRaw, loading: qLoading, error, reload: reloadQuestions } = useCompetencyQuestions(cycleId, { enabled: !!user, targetGroup });
  const questions = useMemo(() => questionsRaw.filter((q) => q.isActive), [questionsRaw]);

  const { data: responses, loading: rLoading, reload: reloadResponses } = useCompetencyResponses(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  const [activeCat, setActiveCat] = useState<string>('전체');

  const form = useCompetencyForm({ cycleId, questions, responses, reloadResponses });
  const { isSubmitted, answers, openMap, setAnswer, toggleOpen, answeredCount, allAnswered, progressPct, avg, saving, submitting, hasDirty, handleSave, handleSubmit } = form;

  // 미저장 응답이 있으면 페이지 이탈(새로고침/닫기) 경고 — DeptHeadEvalView 패턴.
  useEffect(() => {
    if (!hasDirty || isSubmitted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirty, isSubmitted]);

  // 주기 전환도 폼 상태를 초기화하므로 미저장 변경이 있으면 확인 후 진행.
  function handleSelectCycle(id: string) {
    if (
      hasDirty &&
      !isSubmitted &&
      !window.confirm('작성 중인 응답이 저장되지 않았어요. 주기를 바꾸면 사라져요. 계속할까요?')
    ) {
      return;
    }
    setSelectedId(id);
  }

  const dynamicCategories = useMemo(
    () => Array.from(new Set(questions.map((q) => q.categoryName ?? q.categoryId).filter(Boolean))) as string[],
    [questions],
  );

  const isMidterm = current?.cycleType === 'MIDTERM';

  if (cyclesLoading || (qLoading && questions.length === 0) || (rLoading && responses.length === 0)) {
    return <CompetencySkeleton />;
  }
  if (error) return <ErrorState onRetry={reloadQuestions} />;
  if (!current) {
    return (
      <PageContainer>
        <EmptyState title="진행 중인 평가 주기가 없어요." description="HR 관리자에게 문의하세요." />
      </PageContainer>
    );
  }

  if (isMidterm) {
    return (
      <PageContainer>
        <PageHeader title="역량평가" subtitle="역량 항목별로 평가를 진행합니다. (연봉 미반영 · 참고용)" />
        <EmptyState
          title="지금은 역량평가 기간이 아니에요."
          description="역량평가는 12월 최종평가 주기에만 진행돼요."
        />
      </PageContainer>
    );
  }

  const visibleQuestions = questions.filter(
    (q) => activeCat === '전체' || (q.categoryName ?? q.categoryId) === activeCat,
  );

  const catFilterOptions = [
    { value: '전체', label: '전체' },
    ...dynamicCategories.map((c) => ({ value: c, label: c })),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="역량평가"
        subtitle={`역량 항목별로 평가를 진행합니다. (연봉 미반영 · 참고용)${targetGroupDisplay ? ` — ${targetGroupDisplay} 문항` : ''}`}
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={handleSelectCycle}
        hideCycleBadge
        right={
          avg > 0 ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
              평균 점수
              <span className="tabular-nums font-bold">{avg.toFixed(1)}</span>
            </span>
          ) : undefined
        }
      />

      {questions.length === 0 ? (
        <EmptyState
          title="진행 중인 역량평가 문항이 없어요."
          description="관리자가 문항을 등록하면 여기에 표시돼요."
        />
      ) : (
        <>
          <HeaderMetrics
            items={[
              { label: '전체 문항', value: `${questions.length}개` },
              { label: '응답 완료', value: `${answeredCount}개`, accent: 'text-primary' },
              { label: '평균 점수', value: avg > 0 ? avg.toFixed(1) : '-' },
              { label: '제출 상태', value: isSubmitted ? '제출 완료' : allAnswered ? '제출 가능' : '작성 중' },
            ]}
          />

          {/* 카테고리 필터 칩 */}
          <div className="gx-toolbar">
            <FilterChipBar
              options={catFilterOptions}
              value={activeCat}
              onChange={setActiveCat}
            />
            <span className="ml-auto inline-flex h-8 items-center rounded-[4px] bg-muted px-3 text-[12px] font-bold text-muted-foreground">
              {visibleQuestions.length}개
            </span>
          </div>

          {/* 문항 카드 목록 — 문항별 독립 카드(그림자) + 카테고리 아이콘·색 + 접기/펼치기.
              제출 패널이 sticky(문서 흐름 유지)라 하단 여백 보정(paddingBottom)은 불필요. */}
          <div className="flex flex-col gap-4">
            {visibleQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                score={answers[q.id]?.score ?? 0}
                comment={answers[q.id]?.comment ?? ''}
                isOpen={openMap[q.id] ?? true}
                onToggle={() => toggleOpen(q.id)}
                onScore={(s) => setAnswer(q.id, { score: s })}
                onComment={(c) => setAnswer(q.id, { comment: c })}
                readOnly={isSubmitted}
              />
            ))}
          </div>
        </>
      )}

      {/* 제출 액션 */}
      {!isSubmitted && questions.length > 0 && (
        <SubmitPanel
          answeredCount={answeredCount}
          totalCount={questions.length}
          progressPct={progressPct}
          allAnswered={allAnswered}
          saving={saving}
          submitting={submitting}
          onSave={() => void handleSave()}
          onSubmit={() => void handleSubmit()}
        />
      )}
    </PageContainer>
  );
}
