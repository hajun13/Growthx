'use client';

// 본인(employee/부서장 본인) 블록 — C-1.
//  ① 내 KPI 진척 표  ② 자가 점검 코멘트 작성·제출  ③ 내게 배정된 보완 조치 상태 갱신.
//  ④ 목표 재조정 요청 — RebaselineRequestSection (본인 제안→상태 추적).
// 재설계 2026-06-08: 단계 번호 칩 + active 카드 테두리 강조 + 빈 상태 텍스트 개선.
import { useEffect, useMemo, useState } from 'react';
import {
  useMidtermProgress,
  useMidtermReviews,
  useActionItems,
  midtermReviewCommands,
  actionItemCommands,
} from '@/hooks/useMidterm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ProgressDonut } from '@/components/ProgressDonut';
import { MidtermProgressTable } from '@/components/MidtermProgressTable';
import { ActionItemRow } from '@/components/ActionItemRow';
import { EmptyState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { T } from '@/lib/toss';
import { RebaselineRequestSection } from './RebaselineRequestSection';
import type { User, ActionItem, ActionItemStatus, MidtermReview } from '@/lib/types';

// 단계 번호 칩(Card 헤더 좌측에 부착) — 각 Card가 어떤 단계인지 시각화.
type StepChipStatus = 'done' | 'active' | 'pending';
function StepChip({
  num,
  status,
}: {
  num: number;
  status: StepChipStatus;
}) {
  const style: React.CSSProperties = (() => {
    if (status === 'done') return { background: '#3182f6', color: '#fff' };
    if (status === 'active') return { background: '#EBF3FE', color: '#1B64DA' };
    return { background: '#F2F4F6', color: '#B0B8C1' };
  })();
  return (
    <span
      style={{
        ...style,
        width: 18,
        height: 18,
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {num}
    </span>
  );
}

export function EmployeeMidterm({
  cycleId,
  user,
  readOnly,
}: {
  cycleId: string;
  user: User;
  readOnly: boolean;
}) {
  const toast = useToast();

  const { data: progress, loading: progLoading } = useMidtermProgress({
    cycleId,
    userId: user.id,
  });
  const { data: reviews, loading: revLoading, reload: reloadReviews } =
    useMidtermReviews({ cycleId, evaluateeId: user.id });
  const { data: actionData, loading: actionLoading, reload: reloadActions } =
    useActionItems({ cycleId, assigneeId: user.id });

  // 본인 review(단건) — 목록에서 본인 것만.
  const myReview = useMemo(
    () => reviews?.data.find((r) => r.evaluateeId === user.id) ?? null,
    [reviews, user.id],
  );
  const selfDone = myReview?.status === 'self_done' || myReview?.status === 'confirmed';
  const confirmed = myReview?.status === 'confirmed';

  const kpis = progress?.kpis ?? [];
  // 입력 완료율(도넛): 분기 실적이 1건 이상 있는 KPI 수 / 전체.
  const enteredCount = kpis.filter((k) => k.quarters.length > 0).length;

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // review 로드/변경 시 본문 복원.
  useEffect(() => {
    setNote(myReview?.selfNote ?? '');
  }, [myReview?.id, myReview?.selfNote]);

  async function submitSelfCheck() {
    setSubmitting(true);
    try {
      await midtermReviewCommands.submitSelf({
        cycleId,
        selfNote: note.trim() || undefined,
      });
      toast.show({ variant: 'success', message: '자가 점검을 제출했어요.' });
      reloadReviews();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(id: string, next: ActionItemStatus, completionNote?: string) {
    setBusyItemId(id);
    try {
      await actionItemCommands.transition(id, { status: next, completionNote });
      toast.show({ variant: 'success', message: '보완 조치 상태를 변경했어요.' });
      reloadActions();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'INVALID_STATE_TRANSITION'
            ? '지금 단계에서는 바꿀 수 없는 상태예요.'
            : err.message
          : '상태 변경에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusyItemId(null);
    }
  }

  const myItems: ActionItem[] = actionData?.data ?? [];

  // 단계 상태 도출 — Stepper와 동일 로직으로 Card 강조에 사용.
  const reviewStatus = myReview?.status ?? 'pending';
  const actionsDone =
    myItems.length === 0 ||
    myItems.every((i) => i.status === 'done' || i.status === 'canceled');

  // Card 단계: 1=KPI확인(always done), 2=자가점검, 3=피드백확인, 4=보완조치, 5=재조정
  const step2Status: StepChipStatus =
    selfDone ? 'done' : 'active';
  const step3Status: StepChipStatus =
    confirmed ? 'done' : selfDone ? 'active' : 'pending';
  const step4Status: StepChipStatus =
    confirmed && actionsDone
      ? 'done'
      : confirmed && !actionsDone
        ? 'active'
        : 'pending';
  const step5Status: StepChipStatus =
    step4Status === 'done' ? 'active' : 'pending';

  // active 카드 테두리 강조(1px solid #3182f6).
  const activeBorder = `1px solid ${T.blue500}`;
  const defaultBorder = `1px solid ${T.grey200}`;

  return (
    <>
      {/* ① 내 KPI 진척 — 단계 1(항상 완료) */}
      <div style={{ border: defaultBorder }}>
        <Card
          title={
            <span className="flex items-center">
              <StepChip num={1} status="done" />
              내 KPI 진척
            </span>
          }
          action={
            progLoading ? null : (
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11.5, color: T.grey500 }}>분기 실적 기준</span>
                <ProgressDonut done={enteredCount} total={kpis.length} size={48} />
              </div>
            )
          }
        >
          {progLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <MidtermProgressTable items={kpis} variant="self" />
          )}
        </Card>
      </div>

      {/* ② 자가 점검 — 단계 2 */}
      <div style={{ border: step2Status === 'active' ? activeBorder : defaultBorder }}>
        <Card
          title={
            <span className="flex items-center">
              <StepChip num={2} status={step2Status} />
              자가 점검 제출
            </span>
          }
        >
          {revLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="flex flex-col gap-3">
              <TextField
                label="자가 점검"
                hideLabel
                multiline
                rows={4}
                value={note}
                onChange={setNote}
                readOnly={readOnly || confirmed}
                placeholder="상반기 진척에 대한 자가 점검을 적어주세요."
              />
              <div
                className="flex flex-wrap items-center justify-between gap-2"
                style={{
                  borderTop: `1px solid ${T.grey100}`,
                  paddingTop: 12,
                }}
              >
                <SelfStatusLine review={myReview} />
                {!readOnly && !confirmed && (
                  <Button
                    loading={submitting}
                    onClick={submitSelfCheck}
                    disabled={!note.trim() && !selfDone}
                  >
                    {selfDone ? '다시 제출' : '점검 제출'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ③ 부서장 피드백 확인 — 단계 3 (읽기전용 정보 표시) */}
      <div style={{ border: step3Status === 'active' ? activeBorder : defaultBorder }}>
        <Card
          title={
            <span className="flex items-center">
              <StepChip num={3} status={step3Status} />
              부서장 피드백 확인
            </span>
          }
        >
          {revLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : confirmed && myReview?.reviewerNote ? (
            <div className="flex flex-col gap-1">
              <p
                className="whitespace-pre-wrap"
                style={{ fontSize: 13, color: T.grey800, lineHeight: 1.55 }}
              >
                {myReview.reviewerNote}
              </p>
              <span style={{ fontSize: 11.5, color: '#0B7544' }}>
                확인 완료
                {myReview.reviewerName ? ` (${myReview.reviewerName})` : ''}
                {myReview.confirmedAt
                  ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR')}`
                  : ''}
              </span>
            </div>
          ) : selfDone ? (
            <div
              className="px-4 py-6 text-center"
              style={{ background: '#F9FAFB' }}
            >
              <p style={{ fontSize: 13, color: T.grey500 }}>
                부서장이 피드백을 작성하고 확인 처리하면 여기서 확인할 수 있어요.
              </p>
            </div>
          ) : (
            <div
              className="px-4 py-6 text-center"
              style={{ background: '#F9FAFB' }}
            >
              <p style={{ fontSize: 13, color: T.grey400 }}>
                자가 점검을 제출한 후 부서장 피드백을 확인할 수 있어요.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* ④ 보완 조치 — 단계 4 */}
      <div style={{ border: step4Status === 'active' ? activeBorder : defaultBorder }}>
        <Card
          title={
            <span className="flex items-center">
              <StepChip num={4} status={step4Status} />
              보완 조치 수행
            </span>
          }
        >
          {actionLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : myItems.length === 0 ? (
            <EmptyState title="부서장이 보완 조치를 등록하면 여기서 진행 상태를 갱신할 수 있어요." />
          ) : (
            <div className="flex flex-col gap-2">
              {myItems.map((it) => (
                <ActionItemRow
                  key={it.id}
                  item={it}
                  mode={readOnly ? 'readonly' : 'assignee'}
                  onChangeStatus={changeStatus}
                  busy={busyItemId === it.id}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ⑤ 목표 재조정 요청 — 단계 5 (본인 제안 → 부서장 검토 → 승인 반영) */}
      <div style={{ border: step5Status === 'active' ? activeBorder : defaultBorder }}>
        <RebaselineRequestSection
          cycleId={cycleId}
          userId={user.id}
          readOnly={readOnly}
        />
      </div>
    </>
  );
}

function SelfStatusLine({ review }: { review: MidtermReview | null }) {
  if (!review || review.status === 'pending') {
    return <span style={{ fontSize: 12, color: T.grey500 }}>아직 제출하지 않았어요.</span>;
  }
  if (review.status === 'self_done') {
    return (
      <span style={{ fontSize: 12, color: '#A66800' }}>
        제출 완료 · 부서장 확인 대기 중
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12, color: '#0B7544' }}>
      부서장 확인 완료
      {review.reviewerName ? ` (${review.reviewerName})` : ''}
    </span>
  );
}
