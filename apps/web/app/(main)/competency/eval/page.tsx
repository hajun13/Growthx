'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useCompetencyQuestions,
  useCompetencyResponses,
  competencyResponseCommands,
  scoreToGrade,
  gradeToScore,
} from '@/hooks/useCompetency';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';
import type { CompetencyResponseInput } from '@/lib/types';

const CATEGORIES = ['리더십', '협업', '전문성', '혁신'] as const;
const catColors: Record<string, { bg: string; color: string }> = {
  리더십: { bg: '#3182f6', color: '#fff' },
  협업: { bg: '#03b26c', color: '#fff' },
  전문성: { bg: '#f57800', color: '#fff' },
  혁신: { bg: '#9333ea', color: '#fff' },
};
const SCORE_LABELS = ['매우미흡', '미흡', '보통', '우수', '매우우수'];

interface AnswerDraft {
  score: number; // 0 = 미응답, 1~5
  comment: string;
}

export default function CompetencyEvalPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const {
    data: qData,
    loading: qLoading,
    error,
    reload: reloadQuestions,
  } = useCompetencyQuestions(cycleId, { enabled: !!user });
  // 임직원에게는 활성 문항만 노출.
  const questions = useMemo(
    () => (qData?.data ?? []).filter((q) => q.isActive),
    [qData],
  );

  const {
    data: rData,
    loading: rLoading,
    reload: reloadResponses,
  } = useCompetencyResponses(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  const responses = useMemo(() => rData?.data ?? [], [rData]);
  // 이미 제출된 응답이 하나라도 있으면 입력 잠금.
  const isSubmitted = responses.some((r) => r.submittedAt != null);

  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 서버 기존 응답 → 점수 드래프트 초기화.
  useEffect(() => {
    const byQuestion = new Map(responses.map((r) => [r.questionId, r]));
    const next: Record<string, AnswerDraft> = {};
    for (const q of questions) {
      const existing = byQuestion.get(q.id);
      next[q.id] = {
        score: existing ? gradeToScore(existing.grade) : 0,
        comment: existing?.comment ?? '',
      };
    }
    setAnswers(next);
  }, [questions, responses]);

  function setAnswer(questionId: string, patch: Partial<AnswerDraft>) {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...patch },
    }));
  }

  const answered = questions.filter((q) => (answers[q.id]?.score ?? 0) > 0);
  const answeredCount = answered.length;
  const allAnswered =
    questions.length > 0 && answeredCount === questions.length;

  const avg = useMemo(() => {
    if (answeredCount === 0) return 0;
    return (
      answered.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) /
      answeredCount
    );
  }, [answered, answers, answeredCount]);

  function buildPayload(): CompetencyResponseInput[] {
    return questions
      .filter((q) => (answers[q.id]?.score ?? 0) > 0)
      .map((q) => ({
        questionId: q.id,
        grade: scoreToGrade(answers[q.id].score),
        comment: answers[q.id].comment.trim() || undefined,
      }));
  }

  async function handleSave() {
    if (!cycleId || isSubmitted) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      toast.show({
        variant: 'danger',
        message: '저장할 응답이 없어요. 점수를 먼저 선택해 주세요.',
      });
      return;
    }
    setSaving(true);
    try {
      await competencyResponseCommands.bulkSave(cycleId, payload);
      toast.show({ variant: 'success', message: '임시저장했어요.' });
      reloadResponses();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!cycleId || isSubmitted) return;
    if (!allAnswered) {
      toast.show({
        variant: 'danger',
        message: '모든 문항에 점수를 선택해 주세요.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await competencyResponseCommands.bulkSubmit(cycleId, buildPayload());
      toast.show({ variant: 'success', message: '역량평가를 제출했어요.' });
      reloadResponses();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isMidterm = current?.cycleType === 'MIDTERM';

  if (cyclesLoading || qLoading || rLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }
  if (error) return <ErrorState onRetry={reloadQuestions} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  if (isMidterm) {
    return (
      <PageContainer>
        <PageHeader
          title="역량평가"
          subtitle="역량 항목별로 평가를 진행합니다. (연봉 미반영 · 참고용)"
        />
        <InfoBanner tone="warning" title="중간평가에서는 역량평가를 진행하지 않습니다">
          역량 평가는 12월 최종평가 주기에만 진행돼요.
        </InfoBanner>
      </PageContainer>
    );
  }

  const visibleQuestions = questions.filter(
    (q) => !activeCat || q.category === activeCat,
  );

  return (
    <PageContainer>
      <PageHeader
        title="역량평가"
        subtitle="역량 항목별로 평가를 진행합니다. (연봉 미반영 · 참고용)"
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <>
            <button
              onClick={() => void handleSave()}
              disabled={isSubmitted || saving}
              className="flex items-center gap-1.5 border border-border px-4 py-2 hover:bg-muted disabled:opacity-50"
              style={{ fontSize: 13, color: '#4e5968' }}
            >
              <Save size={14} /> 임시저장
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitted || submitting || !allAnswered}
              className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600, background: '#3182f6' }}
            >
              <Send size={14} /> {isSubmitted ? '제출 완료' : '제출'}
            </button>
          </>
        }
      />

      {isSubmitted && (
        <InfoBanner tone="success" title="제출이 완료된 역량평가입니다">
          이미 제출한 응답이라 수정할 수 없어요. 결과는 참고용으로만 활용돼요.
        </InfoBanner>
      )}

      {questions.length === 0 ? (
        <EmptyState
          title="진행 중인 역량평가 문항이 없어요."
          description="관리자가 문항을 등록하면 여기에 표시돼요."
        />
      ) : (
        <>
          {/* 상단 통계 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="col-span-1 flex items-center gap-4 border border-border bg-white px-4 py-3 md:col-span-3">
              <div>
                <div style={{ fontSize: 11, color: '#8b95a1' }}>평균 점수</div>
                <div
                  style={{ fontSize: 22, fontWeight: 700, color: '#3182f6' }}
                >
                  {avg > 0 ? avg.toFixed(2) : '—'}
                </div>
              </div>
              <div className="h-10 w-px" style={{ background: '#e5e8eb' }} />
              <div className="flex flex-wrap gap-4">
                {CATEGORIES.map((c) => {
                  const items = answered.filter((q) => q.category === c);
                  const catAvg =
                    items.length > 0
                      ? items.reduce(
                          (s, q) => s + (answers[q.id]?.score ?? 0),
                          0,
                        ) / items.length
                      : 0;
                  const cc = catColors[c];
                  return (
                    <div key={c}>
                      <div style={{ fontSize: 10.5, color: '#8b95a1' }}>
                        {c}
                      </div>
                      <div
                        style={{ fontSize: 15, fontWeight: 700, color: cc.bg }}
                      >
                        {catAvg > 0 ? catAvg.toFixed(1) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="border border-border bg-white px-4 py-3">
              <div style={{ fontSize: 11, color: '#8b95a1' }}>완료 항목</div>
              <div
                style={{ fontSize: 22, fontWeight: 700, color: '#191f28' }}
              >
                {answeredCount} / {questions.length}
              </div>
            </div>
          </div>

          {/* 카테고리 탭 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCat(null)}
              className="border px-3 py-1.5 transition-colors"
              style={{
                fontSize: 12,
                background: !activeCat ? '#3182f6' : '#fff',
                color: !activeCat ? '#fff' : '#4e5968',
                borderColor: !activeCat ? '#3182f6' : '#e5e8eb',
              }}
            >
              전체
            </button>
            {CATEGORIES.map((c) => {
              const cc = catColors[c];
              const on = activeCat === c;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCat(on ? null : c)}
                  className="border px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: 12,
                    background: on ? cc.bg : '#fff',
                    color: on ? cc.color : '#4e5968',
                    borderColor: on ? cc.bg : '#e5e8eb',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* 문항 카드 */}
          <div className="space-y-3">
            {visibleQuestions.map((q) => {
              const cc = catColors[q.category] ?? {
                bg: '#8b95a1',
                color: '#fff',
              };
              const score = answers[q.id]?.score ?? 0;
              return (
                <div
                  key={q.id}
                  className="overflow-hidden border border-border bg-white"
                >
                  <div
                    className="flex items-center gap-3 border-b border-border px-5 py-3"
                    style={{ background: '#f9fafb' }}
                  >
                    <span
                      className="px-2.5 py-1"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: cc.bg,
                        color: cc.color,
                      }}
                    >
                      {q.category}
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: '#191f28',
                      }}
                    >
                      {q.text}
                    </span>
                    {score > 0 && (
                      <span
                        className="ml-auto px-2.5 py-0.5"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 999,
                          background: '#3182f6',
                          color: '#fff',
                        }}
                      >
                        {score}점
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    {q.hint && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: '#6b7684',
                          marginBottom: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        {q.hint}
                      </p>
                    )}
                    <div className="mb-4 grid grid-cols-5 gap-2">
                      {(() => {
                        // 문항별 커스텀 보기(인덱스 0→점수1 … 인덱스 4→점수5). 없으면 기본 라벨 폴백.
                        const labels =
                          q.options && q.options.length === 5
                            ? q.options
                            : SCORE_LABELS;
                        return [1, 2, 3, 4, 5].map((s) => {
                          const on = score === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setAnswer(q.id, { score: s })}
                              disabled={isSubmitted}
                              className="flex flex-col items-center justify-start gap-1 border px-1.5 py-2.5 transition-all disabled:cursor-not-allowed"
                              style={{
                                background: on ? cc.bg : '#f9fafb',
                                color: on ? cc.color : '#8b95a1',
                                borderColor: on ? cc.bg : '#e5e8eb',
                                boxShadow: on ? `0 0 0 2px ${cc.bg}25` : 'none',
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700 }}>
                                {s}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: on ? 600 : 400,
                                  lineHeight: 1.3,
                                  textAlign: 'center',
                                  wordBreak: 'keep-all',
                                }}
                              >
                                {labels[s - 1]}
                              </span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <textarea
                      value={answers[q.id]?.comment ?? ''}
                      onChange={(e) =>
                        setAnswer(q.id, { comment: e.target.value })
                      }
                      disabled={isSubmitted}
                      placeholder="평가 근거를 작성하세요."
                      className="w-full resize-none border border-border px-3 py-2 focus:border-primary focus:outline-none disabled:bg-muted/30"
                      style={{ fontSize: 12, color: '#4e5968', minHeight: 64 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageContainer>
  );
}
