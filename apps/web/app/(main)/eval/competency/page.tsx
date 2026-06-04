'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useCompetencyQuestions,
  useCompetencyResponses,
  competencyResponseCommands,
} from '@/hooks/useCompetency';
import { useToast } from '@/components/Toast';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { GradeRadio } from '@/components/GradeRadio';
import { TextField } from '@/components/TextField';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import type { Grade, CompetencyResponseInput } from '@/lib/types';

interface AnswerDraft {
  grade: Grade | null;
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
    reload,
  } = useCompetencyQuestions(cycleId, { enabled: !!user });
  // 임직원에게는 활성 질문만 노출.
  const questions = useMemo(
    () => (qData?.data ?? []).filter((q) => q.isActive),
    [qData],
  );

  const { data: rData, loading: rLoading } = useCompetencyResponses(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );

  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [submitting, setSubmitting] = useState(false);

  // 서버 기존 응답 → 드래프트 초기화.
  useEffect(() => {
    const byQuestion = new Map(
      (rData?.data ?? []).map((r) => [r.questionId, r]),
    );
    const next: Record<string, AnswerDraft> = {};
    for (const q of questions) {
      const existing = byQuestion.get(q.id);
      next[q.id] = {
        grade: existing?.grade ?? null,
        comment: existing?.comment ?? '',
      };
    }
    setAnswers(next);
  }, [questions, rData]);

  function setAnswer(questionId: string, patch: Partial<AnswerDraft>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...patch },
    }));
  }

  const answeredCount = questions.filter(
    (q) => answers[q.id]?.grade != null,
  ).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  async function submitAll() {
    if (!cycleId) return;
    if (!allAnswered) {
      toast.show({
        variant: 'danger',
        message: '모든 질문에 등급을 선택해 주세요.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const responses: CompetencyResponseInput[] = questions.map((q) => ({
        questionId: q.id,
        grade: answers[q.id].grade as Grade,
        comment: answers[q.id].comment.trim() || undefined,
      }));
      await competencyResponseCommands.bulkSubmit(cycleId, responses);
      toast.show({ variant: 'success', message: '역량평가를 제출했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  useSetPrimaryAction(
    questions.length > 0
      ? {
          label: '역량평가 제출',
          onClick: () => void submitAll(),
          disabled: !allAnswered || submitting,
          loading: submitting,
        }
      : null,
    [questions.length, answeredCount, allAnswered, submitting],
  );

  // MIDTERM 주기이면 역량평가를 비활성화한다.
  const isMidterm = current?.cycleType === 'MIDTERM';

  if (cyclesLoading || qLoading || rLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  // 중간평가 주기 → 역량평가 미진행 안내 화면
  if (isMidterm) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="역량평가"
          subtitle="역량 평가는 연 1회(최종평가) 진행되는 참고용 평가예요."
          cycles={cycles}
          selectedId={selectedId}
          onSelectCycle={setSelectedId}
        />
        <InfoBanner tone="warning" title="중간평가에서는 역량평가를 진행하지 않습니다">
          역량 평가는 12월 최종평가 주기에만 진행돼요. 현재 주기(중간평가)에서는
          역량 평가 문항이 표시되지 않아요.
        </InfoBanner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="역량평가"
        subtitle="역량 평가는 연 1회 진행되는 참고용 평가예요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <InfoBanner tone="info" title="본 평가는 연봉에 반영되지 않습니다">
        역량 평가는 성과(KPI) 평가와 별도로 진행되는 참고용 데이터예요. 응답 결과는
        연봉 산정에 반영되지 않으니 편하게 작성해 주세요.
      </InfoBanner>

      {questions.length === 0 ? (
        <EmptyState
          title="진행 중인 역량평가 문항이 없어요."
          description="관리자가 문항을 등록하면 여기에 표시돼요."
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              총 {questions.length}문항 중{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {answeredCount}
              </span>
              문항 응답
            </span>
          </div>

          {questions.map((q, idx) => (
            <Card key={q.id} title={`Q${idx + 1}. ${q.text}`}>
              <div className="flex flex-col gap-4">
                {q.hint && (
                  <p className="text-sm text-muted-foreground">{q.hint}</p>
                )}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">
                    등급 선택
                  </span>
                  <GradeRadio
                    name={`q-${q.id}`}
                    value={answers[q.id]?.grade ?? null}
                    onChange={(g) => setAnswer(q.id, { grade: g })}
                  />
                </div>
                <TextField
                  label="코멘트 (선택)"
                  value={answers[q.id]?.comment ?? ''}
                  onChange={(v) => setAnswer(q.id, { comment: v })}
                  multiline
                  rows={2}
                  placeholder="자유롭게 의견을 남겨주세요"
                />
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
