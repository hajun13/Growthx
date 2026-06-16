'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Send } from 'lucide-react';
import { ApiError } from '@growthx/contracts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Collapsible } from '@/components/Collapsible';
import { Textarea } from '@/components/ui/textarea';
import {
  useCompetencyQuestions,
  useCompetencyResponses,
  competencyResponseCommands,
} from '../hooks';
import type { CompetencyResponseItem } from '../api';

// 점수(1~5) ↔ 등급(D~S) 매핑.
const scoreToGrade = (score: number): string => {
  const map: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
  return map[score] ?? 'B';
};
const gradeToScore = (grade: string): number => {
  const map: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  return map[grade] ?? 0;
};

const SCORE_LABELS = ['매우미흡', '미흡', '보통', '우수', '매우우수'];

// 카테고리 색 — DS 토큰 Tailwind 클래스로 표현(4종 + fallback).
const CAT_CLASSES: Record<string, { bg: string; fg: string }> = {
  리더십: { bg: 'bg-primary', fg: 'text-white' },
  협업:   { bg: 'bg-info-500', fg: 'text-white' },
  전문성: { bg: 'bg-warning-500', fg: 'text-white' },
  혁신:   { bg: 'bg-primary', fg: 'text-white' },
};
const FALLBACK_CAT = { bg: 'bg-neutral-500', fg: 'text-white' };
const catCls = (name: string | null | undefined) =>
  name ? (CAT_CLASSES[name] ?? FALLBACK_CAT) : FALLBACK_CAT;

// 카테고리별 점수 버튼 active 배경 — solid hex (차트처럼 특수 도메인 색이라 예외)
const CAT_ACTIVE_BG: Record<string, string> = {
  리더십: '#7A37D8',
  협업:   '#2563EB',
  전문성: '#F59E0B',
  혁신:   '#7A37D8',
};
const FALLBACK_ACTIVE_BG = '#74747F';
const catActiveBg = (name: string | null | undefined) =>
  name ? (CAT_ACTIVE_BG[name] ?? FALLBACK_ACTIVE_BG) : FALLBACK_ACTIVE_BG;

interface AnswerDraft {
  score: number; // 0 = 미응답, 1~5
  comment: string;
}

export function CompetencyEvalView() {
  const { user } = useAuth();
  const toast = useToast();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
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

  const isSubmitted = responses.some((r) => r.submittedAt != null);

  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  // 제출 완료 시 문항별 접힘 상태 (기본=접힘). 미제출에서는 사용하지 않는다.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [activeCat, setActiveCat] = useState<string>('전체');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 서버 기존 응답 → 점수 드래프트 초기화.
  useEffect(() => {
    const byQuestion = new Map(responses.map((r) => [r.questionId, r]));
    const next: Record<string, AnswerDraft> = {};
    for (const q of questions) {
      const existing = byQuestion.get(q.id);
      next[q.id] = { score: existing ? gradeToScore(existing.grade) : 0, comment: existing?.comment ?? '' };
    }
    setAnswers(next);
  }, [questions, responses]);

  // 제출 완료 시 openMap 초기화(전체 접힘). 미제출에서는 불필요하므로 isSubmitted 변경 시만.
  useEffect(() => {
    if (!isSubmitted) return;
    setOpenMap({});
  }, [isSubmitted]);

  function setAnswer(questionId: string, patch: Partial<AnswerDraft>) {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }

  const answered = questions.filter((q) => (answers[q.id]?.score ?? 0) > 0);
  const answeredCount = answered.length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const avg = useMemo(() => {
    if (answeredCount === 0) return 0;
    return answered.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) / answeredCount;
  }, [answered, answers, answeredCount]);

  const dynamicCategories = useMemo(
    () => Array.from(new Set(questions.map((q) => q.categoryName ?? q.categoryId).filter(Boolean))) as string[],
    [questions],
  );

  function buildPayload(): CompetencyResponseItem[] {
    return questions
      .filter((q) => (answers[q.id]?.score ?? 0) > 0)
      .map((q) => ({
        questionId: q.id,
        grade: scoreToGrade(answers[q.id].score) as unknown as CompetencyResponseItem['grade'],
        comment: answers[q.id].comment.trim() || undefined,
      }));
  }

  async function handleSave() {
    if (!cycleId || isSubmitted) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      toast.show({ variant: 'danger', message: '저장할 응답이 없어요. 점수를 먼저 선택해 주세요.' });
      return;
    }
    setSaving(true);
    try {
      await competencyResponseCommands.bulkSave(cycleId, payload);
      toast.show({ variant: 'success', message: '임시저장했어요.' });
      reloadResponses();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!cycleId || isSubmitted) return;
    if (!allAnswered) {
      toast.show({ variant: 'danger', message: '모든 문항에 점수를 선택해 주세요.' });
      return;
    }
    setSubmitting(true);
    try {
      await competencyResponseCommands.bulkSubmit(cycleId, buildPayload());
      toast.show({ variant: 'success', message: '역량평가를 제출했어요.' });
      reloadResponses();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '제출에 실패했어요.' });
    } finally {
      setSubmitting(false);
    }
  }

  const isMidterm = current?.cycleType === 'MIDTERM';

  if (cyclesLoading || (qLoading && questions.length === 0) || (rLoading && responses.length === 0)) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
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
        <InfoBanner tone="warning" title="중간평가에서는 역량평가를 진행하지 않습니다">
          역량 평가는 12월 최종평가 주기에만 진행돼요.
        </InfoBanner>
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
        onSelectCycle={setSelectedId}
        hideCycleBadge
        right={
          avg > 0 ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
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
          {/* 카테고리 필터 칩 */}
          <FilterChipBar
            options={catFilterOptions}
            value={activeCat}
            onChange={setActiveCat}
          />

          {/* 문항 카드 목록 */}
          <div className="space-y-3" style={{ paddingBottom: isSubmitted ? 0 : 80 }}>
            {visibleQuestions.map((q) => {
              const cc = catCls(q.categoryName);
              const activeBg = catActiveBg(q.categoryName);
              const score = answers[q.id]?.score ?? 0;
              const labels = q.options && q.options.length === 5 ? q.options : SCORE_LABELS;

              // 점수·근거 상세 (제출 완료 시 Collapsible의 children, 미제출 시 인라인)
              const questionDetail = (
                <>
                  {q.hint && (
                    <p className="text-[12.5px] text-muted-foreground mb-3.5 leading-relaxed">{q.hint}</p>
                  )}

                  {/* 점수 선택 버튼 — 도메인 특화 5점 선택 그리드 */}
                  <div className="mb-4 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const on = score === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAnswer(q.id, { score: s })}
                          disabled={isSubmitted}
                          aria-pressed={on}
                          className="flex flex-col items-center justify-start gap-1 px-1.5 py-2.5 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                          style={{
                            background: on ? activeBg : undefined,
                            color: on ? '#fff' : undefined,
                            borderColor: on ? activeBg : undefined,
                            boxShadow: on ? `0 0 0 3px ${activeBg}25` : undefined,
                          }}
                        >
                          <span className="text-xs font-bold">{s}</span>
                          <span className={`text-[11px] leading-snug text-center break-keep ${on ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {labels[s - 1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 근거 텍스트에어리어 */}
                  <Textarea
                    value={answers[q.id]?.comment ?? ''}
                    onChange={(e) => setAnswer(q.id, { comment: e.target.value })}
                    disabled={isSubmitted}
                    placeholder="평가 근거를 작성하세요."
                    className="min-h-[64px] text-xs resize-none"
                  />
                </>
              );

              // 제출 완료: Collapsible(기본 접힘), 헤더=카테고리 칩 + 문항 텍스트 + 점수 배지
              if (isSubmitted) {
                const isOpen = openMap[q.id] ?? false;
                const collapsibleHeader = (
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded shrink-0 ${cc.bg} ${cc.fg}`}>
                      {q.categoryName ?? q.categoryId}
                    </span>
                    <span className="text-[13.5px] font-semibold text-foreground flex-1 line-clamp-1">{q.text}</span>
                    {score > 0 && (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-primary text-primary-foreground shrink-0">
                        {score}점
                      </span>
                    )}
                  </div>
                );
                return (
                  <Collapsible
                    key={q.id}
                    open={isOpen}
                    onToggle={() => setOpenMap((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                    header={collapsibleHeader}
                    bodyClassName="px-5 py-4"
                  >
                    {questionDetail}
                  </Collapsible>
                );
              }

              // 미제출: 기존 펼친 카드 유지
              return (
                <Card key={q.id} className="overflow-hidden">
                  {/* 문항 헤더 */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-muted border-b border-border -mx-6 -mt-6 mb-4">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded shrink-0 ${cc.bg} ${cc.fg}`}>
                      {q.categoryName ?? q.categoryId}
                    </span>
                    <span className="text-[13.5px] font-semibold text-foreground flex-1">{q.text}</span>
                    {score > 0 && (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5 bg-primary text-primary-foreground shrink-0">
                        {score}점
                      </span>
                    )}
                  </div>
                  {questionDetail}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 하단 고정 액션 바 (미제출 상태에서만) */}
      {!isSubmitted && questions.length > 0 && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-t border-border bg-background/95 backdrop-blur-sm">
          {/* 좌측: 진행 요약 */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">응답 진행률</span>
              <span className="text-[13px] font-bold text-foreground">
                <span className="tabular-nums" style={{ color: allAnswered ? '#16A34A' : '#7A37D8' }}>{answeredCount}</span>
                <span className="text-muted-foreground"> / {questions.length}문항</span>
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%`, background: allAnswered ? '#16A34A' : '#7A37D8' }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: allAnswered ? '#16A34A' : '#7A37D8' }}>
              {progressPct}%
            </span>
          </div>

          {/* 우측: 액션 버튼 */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              loading={saving}
              leftIcon={<Save size={14} />}
              onClick={() => void handleSave()}
            >
              임시저장
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              disabled={!allAnswered}
              leftIcon={<Send size={14} />}
              onClick={() => void handleSubmit()}
            >
              최종 제출
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
