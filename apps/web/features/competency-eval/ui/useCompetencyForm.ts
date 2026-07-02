'use client';

// 역량평가 화면 폼 상태 — 답변 드래프트·접기펼치기·저장/제출 커맨드.
// CompetencyEvalView 에서 데이터(질문·응답) 로드 후 이 훅으로 폼 상태만 위임한다.
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@growthx/contracts';
import { useToast } from '@/components/Toast';
import { competencyResponseCommands } from '../hooks';
import type { CompetencyQuestion, CompetencyResponse, CompetencyResponseItem } from '../api';

// 점수(1~5) ↔ 등급(D~S) 매핑.
const scoreToGrade = (score: number): string => {
  const map: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
  return map[score] ?? 'B';
};
const gradeToScore = (grade: string): number => {
  const map: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  return map[grade] ?? 0;
};

interface AnswerDraft {
  score: number; // 0 = 미응답, 1~5
  comment: string;
}

export function useCompetencyForm({
  cycleId,
  questions,
  responses,
  reloadResponses,
}: {
  cycleId: string | undefined;
  questions: CompetencyQuestion[];
  responses: CompetencyResponse[];
  reloadResponses: () => void;
}) {
  const toast = useToast();
  const isSubmitted = responses.some((r) => r.submittedAt != null);

  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  // 문항별 접기/펼치기 상태 — 제출 완료면 전체 접힘, 작성 중이면 전체 펼침(시안 image 6) 기본값.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
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

  // 신규 문항이 로드되면 초기 열림상태만 채운다 — 사용자가 토글한 상태는 덮어쓰지 않음.
  useEffect(() => {
    if (questions.length === 0) return;
    setOpenMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const q of questions) {
        if (!(q.id in next)) {
          next[q.id] = !isSubmitted;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [questions, isSubmitted]);

  function setAnswer(questionId: string, patch: Partial<AnswerDraft>) {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }

  function toggleOpen(questionId: string) {
    setOpenMap((prev) => ({ ...prev, [questionId]: !(prev[questionId] ?? true) }));
  }

  const answered = questions.filter((q) => (answers[q.id]?.score ?? 0) > 0);
  const answeredCount = answered.length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const avg = useMemo(() => {
    if (answeredCount === 0) return 0;
    return answered.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) / answeredCount;
  }, [answered, answers, answeredCount]);

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

  return {
    isSubmitted,
    answers,
    openMap,
    setAnswer,
    toggleOpen,
    answeredCount,
    allAnswered,
    progressPct,
    avg,
    saving,
    submitting,
    handleSave,
    handleSubmit,
  };
}
