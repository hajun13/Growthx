'use client';

// 역량평가 화면 폼 상태 — 답변 드래프트·접기펼치기·저장/제출 커맨드.
// CompetencyEvalView 에서 데이터(질문·응답) 로드 후 이 훅으로 폼 상태만 위임한다.
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // 사용자가 편집한(아직 서버와 동기화 안 된) 문항 id — 서버 응답 리셋이 덮어쓰지 않도록.
  const dirtyRef = useRef<Set<string>>(new Set());
  // 미저장 변경 여부(렌더 반영용) — 뷰의 이탈 가드(beforeunload·주기 전환 확인)에 노출.
  const [hasDirty, setHasDirty] = useState(false);

  // 주기 전환 시 이전 주기의 편집 흔적(dirty)이 새 주기 가드에 남지 않도록 초기화.
  useEffect(() => {
    dirtyRef.current.clear();
    setHasDirty(false);
  }, [cycleId]);

  // 서버 기존 응답 → 점수 드래프트 초기화. 편집 중(dirty) 문항은 로컬 값을 보존한다
  // (예: 코멘트만 쓰고 점수 미선택 상태에서 임시저장 → 재조회가 코멘트를 지우던 버그 방지).
  useEffect(() => {
    const byQuestion = new Map(responses.map((r) => [r.questionId, r]));
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
    dirtyRef.current.add(questionId);
    setHasDirty(true);
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

  /** 서버 저장 성공 항목의 dirty 해제 — 점수 포함 항목은 서버에 확정 반영되므로 재조회 값으로 동기화. */
  function clearSyncedDirty(payload: CompetencyResponseItem[]) {
    for (const item of payload) {
      // 코멘트만 있는 항목은 서버에 행이 없으면 저장되지 않으므로 dirty 유지(로컬 드래프트 보존).
      if (item.grade) dirtyRef.current.delete(item.questionId);
    }
    setHasDirty(dirtyRef.current.size > 0);
  }

  async function handleSave() {
    if (!cycleId || isSubmitted) return;
    const payload = buildPayload();
    if (payload.length === 0) {
      toast.show({ variant: 'danger', message: '저장할 내용이 없어요. 점수를 선택하거나 코멘트를 입력해 주세요.' });
      return;
    }
    setSaving(true);
    try {
      await competencyResponseCommands.bulkSave(cycleId, payload);
      clearSyncedDirty(payload);
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
      const payload = buildPayload();
      await competencyResponseCommands.bulkSubmit(cycleId, payload);
      clearSyncedDirty(payload);
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
    hasDirty,
    handleSave,
    handleSubmit,
  };
}
