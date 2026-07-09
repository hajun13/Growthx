'use client';

// 역량평가서 폼 상태 — 내 열(본인 또는 1차/2차/최종)의 점수·근거 드래프트 + 종합의견 + 저장/제출.
// CompetencyEvalView 가 시트 데이터를 로드하고, 이 훅은 편집 가능한 열의 폼 상태만 위임받는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@growthx/contracts';
import { useToast } from '@/components/Toast';
import { competencyResponseCommands } from '../hooks';
import type { CompetencyQuestion, CompetencyResponse, CompetencyResponseItem, CompetencyStage } from '../api';

// 점수(1~5) ↔ 등급(D~S) 매핑.
const scoreToGrade = (score: number): string => {
  const map: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
  return map[score] ?? 'B';
};
export const gradeToScore = (grade: string): number => {
  const map: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  return map[grade] ?? 0;
};

interface AnswerDraft {
  score: number; // 0 = 미응답, 1~5
  comment: string;
}

export function useCompetencyForm({
  cycleId,
  targetUserId,
  isSelf,
  myStage,
  questions,
  myResponses,
  savedOpinion,
  reload,
  onSubmitted,
}: {
  cycleId: string | undefined;
  /** 피평가자 id(시트 주인). */
  targetUserId: string | undefined;
  isSelf: boolean;
  /** 내가 쓸 수 있는 열. null=열람 전용. */
  myStage: CompetencyStage | null;
  questions: CompetencyQuestion[];
  /** 내 열의 기존 응답만. */
  myResponses: CompetencyResponse[];
  /** 내 단계의 저장된 종합의견(평가자 열 전용). */
  savedOpinion: string;
  reload: () => void;
  /** 최종 제출 성공 후 호출 — 다음 평가 대상 자동 이동 등. */
  onSubmitted?: () => void;
}) {
  const toast = useToast();
  const isSubmitted = myResponses.some((r) => r.submittedAt != null);

  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [opinion, setOpinion] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 사용자가 편집한(아직 서버와 동기화 안 된) 문항 id — 서버 응답 리셋이 덮어쓰지 않도록.
  const dirtyRef = useRef<Set<string>>(new Set());
  const opinionDirtyRef = useRef(false);
  const [hasDirty, setHasDirty] = useState(false);

  // 주기·대상 전환 시 이전 편집 흔적(dirty)이 남지 않도록 초기화.
  useEffect(() => {
    dirtyRef.current.clear();
    opinionDirtyRef.current = false;
    setHasDirty(false);
  }, [cycleId, targetUserId]);

  // 서버 기존 응답 → 드래프트 초기화. 편집 중(dirty) 문항은 로컬 값 보존.
  useEffect(() => {
    const byQuestion = new Map(myResponses.map((r) => [r.questionId, r]));
    setAnswers((prev) => {
      const next: Record<string, AnswerDraft> = {};
      for (const q of questions) {
        if (dirtyRef.current.has(q.id) && prev[q.id]) {
          next[q.id] = prev[q.id];
          continue;
        }
        const existing = byQuestion.get(q.id);
        next[q.id] = { score: existing ? gradeToScore(existing.grade) : 0, comment: existing?.comment ?? '' };
      }
      return next;
    });
  }, [questions, myResponses]);

  useEffect(() => {
    if (!opinionDirtyRef.current) setOpinion(savedOpinion);
  }, [savedOpinion]);

  function markDirty() {
    setHasDirty(dirtyRef.current.size > 0 || opinionDirtyRef.current);
  }

  function setAnswer(questionId: string, patch: Partial<AnswerDraft>) {
    if (isSubmitted) return;
    dirtyRef.current.add(questionId);
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
    markDirty();
  }

  function setOpinionText(text: string) {
    opinionDirtyRef.current = true;
    setOpinion(text);
    markDirty();
  }

  const answeredCount = questions.filter((q) => (answers[q.id]?.score ?? 0) > 0).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const draftScores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of questions) map[q.id] = answers[q.id]?.score ?? 0;
    return map;
  }, [questions, answers]);

  // 점수 선택 문항 + 코멘트만 있는 문항(grade 생략) 모두 전송 — 코멘트 단독 저장 유실 방지.
  function buildPayload(): CompetencyResponseItem[] {
    return questions
      .filter((q) => {
        const a = answers[q.id];
        return (a?.score ?? 0) > 0 || (a?.comment.trim().length ?? 0) > 0;
      })
      .map((q) => {
        const a = answers[q.id];
        return {
          questionId: q.id,
          grade:
            a.score > 0
              ? (scoreToGrade(a.score) as unknown as CompetencyResponseItem['grade'])
              : undefined,
          comment: a.comment.trim() || undefined,
        };
      });
  }

  /** 서버 저장 성공 항목의 dirty 해제(코멘트 단독 항목은 행이 없으면 저장 안 되므로 유지). */
  function clearSyncedDirty(payload: CompetencyResponseItem[]) {
    for (const item of payload) {
      if (item.grade) dirtyRef.current.delete(item.questionId);
    }
    markDirty();
  }

  /** 평가자 열이면 종합의견도 함께 저장(빈 값 = 삭제). */
  async function persistOpinion() {
    if (isSelf || !cycleId || !targetUserId || !opinionDirtyRef.current) return;
    await competencyResponseCommands.saveOpinion(cycleId, targetUserId, opinion);
    opinionDirtyRef.current = false;
    markDirty();
  }

  async function handleSave() {
    if (!cycleId || isSubmitted || !myStage) return;
    const payload = buildPayload();
    if (payload.length === 0 && !opinionDirtyRef.current) {
      toast.show({ variant: 'danger', message: '저장할 내용이 없어요. 점수를 선택하거나 의견을 입력해 주세요.' });
      return;
    }
    setSaving(true);
    try {
      if (payload.length > 0) {
        await competencyResponseCommands.bulkSave(cycleId, payload, isSelf ? undefined : targetUserId);
        clearSyncedDirty(payload);
      }
      await persistOpinion();
      toast.show({ variant: 'success', message: '임시저장했어요.' });
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!cycleId || isSubmitted || !myStage) return;
    if (!allAnswered) {
      toast.show({ variant: 'danger', message: '모든 문항에 점수를 선택해 주세요.' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      await competencyResponseCommands.bulkSubmit(cycleId, payload, isSelf ? undefined : targetUserId);
      clearSyncedDirty(payload);
      await persistOpinion();
      toast.show({ variant: 'success', message: '역량평가를 제출했어요.' });
      reload();
      onSubmitted?.();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '제출에 실패했어요.' });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    isSubmitted,
    answers,
    draftScores,
    opinion,
    setAnswer,
    setOpinionText,
    answeredCount,
    allAnswered,
    progressPct,
    saving,
    submitting,
    hasDirty,
    handleSave,
    handleSubmit,
  };
}
