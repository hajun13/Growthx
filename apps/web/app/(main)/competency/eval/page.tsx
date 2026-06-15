'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Send, BookOpen } from 'lucide-react';
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

// ── Kinetic Enterprise 팔레트 ─────────────────────────────────
const K = {
  primary: '#3f2c80',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  outline: 'rgba(202,196,210,0.5)',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outlineText: '#797582',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const CATEGORIES = ['리더십', '협업', '전문성', '혁신'] as const;
// Kinetic 팔레트로 카테고리 색 정렬: 리더십=primary, 협업=tertiary, 전문성=orange, 혁신=secondary
const catColors: Record<string, { bg: string; color: string }> = {
  리더십: { bg: K.primary, color: '#fff' },
  협업: { bg: K.tertiary, color: '#fff' },
  전문성: { bg: '#f57800', color: '#fff' },
  혁신: { bg: K.secondary, color: '#fff' },
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
  const progressPct =
    questions.length > 0
      ? Math.round((answeredCount / questions.length) * 100)
      : 0;

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

  if (cyclesLoading || (qLoading && !qData) || (rLoading && !rData)) {
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
  if (!current)
    return (
      <PageContainer>
        <EmptyState
          title="진행 중인 평가 주기가 없어요."
          description="HR 관리자에게 문의하세요."
        />
      </PageContainer>
    );

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
      />

      {/* 참고용 강조 배너 */}
      <div
        className="flex items-start gap-3 rounded-xl px-5 py-4"
        style={{
          background: 'rgba(63,44,128,0.06)',
          border: '1px solid rgba(63,44,128,0.18)',
        }}
      >
        <BookOpen size={18} color={K.primary} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: K.primary, marginBottom: 2 }}>
            역량평가는 참고용 자료입니다 (연봉·등급 미반영)
          </p>
          <p style={{ fontSize: 12, color: K.onSurfaceVariant, lineHeight: 1.6 }}>
            역량 평가 결과는 조직 역량 추이 분석에만 활용되며, 최종 등급 및 연봉 산정에는{' '}
            <strong style={{ color: '#ba1a1a' }}>반영되지 않습니다</strong>.
            연 1회(12월) 진행, 10문항 S/A/B/C/D 기준입니다.
          </p>
        </div>
      </div>

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
          {/* 상단 통계 카드 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* 진행률 + 카테고리별 평균 */}
            <div
              className="col-span-1 md:col-span-3 rounded-xl"
              style={{ border: K.outline, background: '#fff', boxShadow: CARD_SHADOW, overflow: 'hidden' }}
            >
              <div className="flex items-center gap-5 px-5 py-4">
                {/* 평균 점수 */}
                <div className="flex flex-col gap-0.5" style={{ minWidth: 72 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: K.outlineText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    평균 점수
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ fontSize: 28, fontWeight: 800, color: K.secondary, lineHeight: 1, letterSpacing: '-0.02em' }}
                  >
                    {avg > 0 ? avg.toFixed(1) : '—'}
                  </span>
                </div>
                <div style={{ width: 1, height: 40, background: 'rgba(202,196,210,0.5)', flexShrink: 0 }} />
                {/* 카테고리별 */}
                <div className="flex flex-wrap gap-5">
                  {CATEGORIES.map((c) => {
                    const items = answered.filter((q) => q.category === c);
                    const catAvg =
                      items.length > 0
                        ? items.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) / items.length
                        : 0;
                    const cc = catColors[c];
                    return (
                      <div key={c} className="flex flex-col gap-0.5">
                        <span style={{ fontSize: 10, fontWeight: 600, color: K.outlineText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {c}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{ fontSize: 18, fontWeight: 800, color: cc.bg, lineHeight: 1 }}
                        >
                          {catAvg > 0 ? catAvg.toFixed(1) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 진행률 바 */}
              <div style={{ height: 4, background: K.surfaceLow }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: allAnswered ? K.tertiary : K.secondary,
                    transition: 'width .3s ease',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              </div>
            </div>

            {/* 완료 항목 카드 */}
            <div
              className="flex flex-col justify-center px-5 py-4 rounded-xl"
              style={{ border: K.outline, background: '#fff', boxShadow: CARD_SHADOW }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: K.outlineText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                완료 항목
              </span>
              <div className="flex items-end gap-1.5 mt-1">
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 34, fontWeight: 800, lineHeight: 1,
                    letterSpacing: '-0.02em',
                    color: allAnswered ? K.tertiary : K.onSurface,
                  }}
                >
                  {answeredCount}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: K.outlineText, paddingBottom: 2 }}>
                  / {questions.length}
                </span>
              </div>
              <span style={{ fontSize: 11, color: K.outlineText, marginTop: 4 }}>
                {progressPct}% 완료
              </span>
            </div>
          </div>

          {/* 카테고리 필터 탭 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCat(null)}
              className="px-3 py-1.5 transition-colors"
              style={{
                fontSize: 12,
                background: !activeCat ? K.primary : '#fff',
                color: !activeCat ? '#fff' : '#484551',
                border: `1px solid ${!activeCat ? K.primary : 'rgba(202,196,210,0.6)'}`,
                borderRadius: 999,
                fontWeight: !activeCat ? 600 : 400,
                cursor: 'pointer',
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
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    fontSize: 12,
                    background: on ? cc.bg : '#fff',
                    color: on ? cc.color : '#484551',
                    border: `1px solid ${on ? cc.bg : 'rgba(202,196,210,0.6)'}`,
                    borderRadius: 999,
                    fontWeight: on ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* 문항 카드 목록 */}
          <div className="space-y-3" style={{ paddingBottom: isSubmitted ? 0 : 80 }}>
            {visibleQuestions.map((q) => {
              const cc = catColors[q.category] ?? { bg: '#8b95a1', color: '#fff' };
              const score = answers[q.id]?.score ?? 0;
              return (
                <div
                  key={q.id}
                  className="overflow-hidden rounded-xl"
                  style={{
                    border: '1px solid rgba(202,196,210,0.5)',
                    background: '#fff',
                    boxShadow: CARD_SHADOW,
                  }}
                >
                  {/* 문항 헤더 */}
                  <div
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ background: '#f8f9fd', borderBottom: '1px solid rgba(202,196,210,0.2)' }}
                  >
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600,
                        background: cc.bg, color: cc.color,
                        padding: '2px 10px', borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {q.category}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#191c1f', flex: 1 }}>
                      {q.text}
                    </span>
                    {score > 0 && (
                      <span
                        style={{
                          fontSize: 11, fontWeight: 700,
                          borderRadius: 999,
                          background: K.secondary, color: '#fff',
                          padding: '2px 10px',
                          flexShrink: 0,
                        }}
                      >
                        {score}점
                      </span>
                    )}
                  </div>

                  {/* 문항 본문 */}
                  <div className="p-5">
                    {q.hint && (
                      <p style={{ fontSize: 12.5, color: '#797582', marginBottom: 14, lineHeight: 1.6 }}>
                        {q.hint}
                      </p>
                    )}
                    {/* 점수 선택 버튼 */}
                    <div className="mb-4 grid grid-cols-5 gap-2">
                      {(() => {
                        const labels =
                          q.options && q.options.length === 5 ? q.options : SCORE_LABELS;
                        return [1, 2, 3, 4, 5].map((s) => {
                          const on = score === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setAnswer(q.id, { score: s })}
                              disabled={isSubmitted}
                              className="flex flex-col items-center justify-start gap-1 px-1.5 py-2.5 transition-all disabled:cursor-not-allowed"
                              style={{
                                background: on ? cc.bg : '#f2f3f7',
                                color: on ? cc.color : '#797582',
                                border: `1px solid ${on ? cc.bg : 'rgba(202,196,210,0.5)'}`,
                                borderRadius: 8,
                                boxShadow: on ? `0 0 0 3px ${cc.bg}25` : 'none',
                                cursor: isSubmitted ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{s}</span>
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
                    {/* 근거 텍스트에어리어 */}
                    <textarea
                      value={answers[q.id]?.comment ?? ''}
                      onChange={(e) => setAnswer(q.id, { comment: e.target.value })}
                      disabled={isSubmitted}
                      placeholder="평가 근거를 작성하세요."
                      className="w-full resize-none outline-none disabled:opacity-60"
                      style={{
                        fontSize: 12, color: '#484551',
                        minHeight: 64,
                        border: '1px solid rgba(202,196,210,0.6)',
                        borderRadius: 6,
                        padding: '8px 12px',
                        background: isSubmitted ? '#f8f9fd' : '#fff',
                        lineHeight: 1.5,
                        transition: 'border-color .12s, box-shadow .12s',
                      }}
                      onFocus={(e) => {
                        if (!isSubmitted) {
                          e.currentTarget.style.borderColor = K.secondary;
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 하단 고정 액션 바 (미제출 상태에서만) */}
      {!isSubmitted && questions.length > 0 && (
        <div
          className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: 'rgba(248,249,253,0.92)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(202,196,210,0.4)',
            padding: '14px 24px',
          }}
        >
          {/* 좌측: 진행 요약 */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span style={{ fontSize: 10, fontWeight: 600, color: K.outlineText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                응답 진행률
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}>
                <span className="tabular-nums" style={{ color: allAnswered ? K.tertiary : K.secondary }}>
                  {answeredCount}
                </span>
                <span style={{ color: K.outlineText }}> / {questions.length}문항</span>
              </span>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(202,196,210,0.6)' }} />
            {/* 미니 진행바 */}
            <div style={{ width: 120, height: 6, background: K.surfaceLow, borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', width: `${progressPct}%`,
                  background: allAnswered ? K.tertiary : K.secondary,
                  transition: 'width .3s ease', borderRadius: 3,
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: allAnswered ? K.tertiary : K.secondary }}>
              {progressPct}%
            </span>
          </div>

          {/* 우측: 액션 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              style={{
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                color: K.primary, background: '#fff',
                border: `1px solid ${K.primary}`, borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={14} />
              {saving ? '저장 중…' : '임시저장'}
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !allAnswered}
              className="flex items-center gap-1.5 text-white disabled:opacity-50 transition-opacity"
              style={{
                padding: '10px 28px', fontSize: 13, fontWeight: 700,
                background: allAnswered ? K.secondary : '#8b95a1',
                border: 'none', borderRadius: 8,
                boxShadow: allAnswered ? '0 4px 12px rgba(0,84,202,0.25)' : 'none',
                cursor: !allAnswered || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={14} />
              {submitting ? '제출 중…' : '최종 제출'}
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
