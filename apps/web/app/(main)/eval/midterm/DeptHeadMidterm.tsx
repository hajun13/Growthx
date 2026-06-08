'use client';

// 부서장(team_lead/division_head) 블록 — C-2.
// 구성원 선택 → 진척 확인 + 부서장 확인(코멘트 필수) + 보완 조치 등록·관리.
// + 재조정 검토 큐(RebaselineReviewQueue) — 구성원 목표 재조정 제안 승인/반려.
// 구성원 목록 = 부서장 downward 평가 대상(계약 가정 A8/G2 — useEvaluations type=downward).
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, ChevronLeft, CheckCircle2, Clock } from 'lucide-react';
import { InfoBanner } from '@/components/InfoBanner';
import { useEvaluations } from '@/hooks/useEvaluations';
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
import { MidtermProgressTable } from '@/components/MidtermProgressTable';
import { ActionItemRow } from '@/components/ActionItemRow';
import {
  ActionItemFormModal,
  type ActionItemFormValue,
} from '@/components/ActionItemFormModal';
import { EmptyState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { T } from '@/lib/toss';
import { RebaselineReviewQueue } from './RebaselineReviewQueue';
import type {
  User,
  Evaluation,
  ActionItem,
  ActionItemStatus,
  MidtermReview,
} from '@/lib/types';

export function DeptHeadMidterm({
  cycleId,
  user,
  readOnly,
}: {
  cycleId: string;
  user: User;
  readOnly: boolean;
}) {
  const toast = useToast();

  // 평가 대상(구성원) — downward 배정.
  const { data: evals, loading: evalsLoading } = useEvaluations(
    { cycleId, evaluatorId: user.id, type: 'downward' },
    { enabled: !!cycleId },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  // 가시 부서 전체 리뷰(확인 진행 요약·자가점검 본문) — 부서장 시야.
  const { data: reviews, reload: reloadReviews } = useMidtermReviews({ cycleId });
  const reviewByEvaluatee = useMemo(() => {
    const m = new Map<string, MidtermReview>();
    for (const r of reviews?.data ?? []) m.set(r.evaluateeId, r);
    return m;
  }, [reviews]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');

  const active = useMemo(
    () => targets.find((t) => t.evaluateeId === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );
  const activeUserId = active?.evaluateeId ?? null;

  const confirmCount = targets.filter(
    (t) => reviewByEvaluatee.get(t.evaluateeId)?.status === 'confirmed',
  ).length;

  const filtered = targets.filter((t) =>
    search ? (t.userName ?? t.evaluateeId).includes(search) : true,
  );

  function selectMember(evaluateeId: string) {
    setSelectedId(evaluateeId);
    setMobileView('panel');
  }

  if (evalsLoading) {
    return (
      <Card title="구성원 점검">
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }
  if (targets.length === 0) {
    return (
      <Card title="구성원 점검">
        <EmptyState
          title="점검할 구성원이 없어요."
          description="부서장 평가가 배정되면 구성원이 표시돼요."
        />
      </Card>
    );
  }

  return (
    <>
    <Card
      title="① 구성원 진척 검토 · ② 자가점검 확인"
      action={
        <span style={{ fontSize: 12, color: T.grey600 }}>
          확인 {confirmCount} / 전체 {targets.length}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* 구성원 리스트 */}
        <div
          className={`${mobileView === 'panel' ? 'hidden lg:block' : 'block'} self-start`}
          style={{ border: `1px solid ${T.grey200}` }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{ background: T.grey50, borderBottom: `1px solid ${T.grey200}` }}
          >
            <Search size={12} color={T.grey500} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 검색"
              className="flex-1 outline-none"
              style={{ fontSize: 12, background: 'transparent', color: T.grey900 }}
            />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center" style={{ fontSize: 12.5, color: T.grey500 }}>
                검색 결과가 없어요.
              </p>
            ) : (
              filtered.map((t) => {
                const rv = reviewByEvaluatee.get(t.evaluateeId);
                const isActive = t.evaluateeId === activeUserId;
                const name = t.userName ?? t.evaluateeId.slice(0, 8);
                return (
                  <button
                    key={t.id}
                    onClick={() => selectMember(t.evaluateeId)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                    style={{
                      borderBottom: `1px solid ${T.grey100}`,
                      borderLeft: `3px solid ${isActive ? T.blue500 : 'transparent'}`,
                      background: isActive ? '#EEF4FF' : 'transparent',
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center"
                      style={{
                        background: isActive ? T.blue500 : T.grey300,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                        {name}
                      </span>
                      {t.departmentName && (
                        <span className="block truncate" style={{ fontSize: 11, color: T.grey500 }}>
                          {t.departmentName}
                        </span>
                      )}
                    </span>
                    <ReviewBadge status={rv?.status} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 선택 구성원 상세 */}
        <div className={`${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {!active ? (
            <p className="py-12 text-center" style={{ fontSize: 13, color: T.grey500 }}>
              좌측에서 구성원을 선택하세요.
            </p>
          ) : (
            <>
              <button
                onClick={() => setMobileView('list')}
                className="mb-2 flex items-center gap-1 lg:hidden"
                style={{ fontSize: 12.5, color: T.blue500, fontWeight: 600 }}
              >
                <ChevronLeft size={14} /> 구성원 목록
              </button>
              <MemberDetail
                key={activeUserId}
                cycleId={cycleId}
                evaluatee={active}
                review={reviewByEvaluatee.get(active.evaluateeId) ?? null}
                memberUsers={targetsToUsers(targets)}
                readOnly={readOnly}
                onConfirmed={reloadReviews}
                toast={toast}
              />
            </>
          )}
        </div>
      </div>
    </Card>

    {/* 재조정 검토 큐 — 구성원 목표 재조정 제안 승인/반려. */}
    <RebaselineReviewQueue cycleId={cycleId} readOnly={readOnly} />
    </>
  );
}

// downward 대상 Evaluation → UserCombobox 후보(담당 선택용 최소 User shape).
function targetsToUsers(targets: Evaluation[]): User[] {
  return targets.map((t) => ({
    id: t.evaluateeId,
    name: t.userName ?? t.evaluateeId.slice(0, 8),
    email: '',
    role: 'employee',
    position: '',
    departmentId: null,
    managerId: null,
    jobLevel: 'senior_minus',
    mustChangePassword: false,
    visibilityScope: 'self',
    isActive: true,
    employmentStatus: 'active',
    legalEntity: 'energyx',
    resignedAt: null,
    evaluationExempt: false,
    evaluationExemptReason: null,
    createdAt: '',
  })) as User[];
}

function ReviewBadge({ status }: { status?: MidtermReview['status'] }) {
  if (status === 'confirmed') {
    return (
      <span className="flex items-center gap-0.5" style={{ fontSize: 10.5, color: '#0B7544', fontWeight: 600 }}>
        <CheckCircle2 size={11} /> 확인
      </span>
    );
  }
  if (status === 'self_done') {
    return (
      <span className="flex items-center gap-0.5" style={{ fontSize: 10.5, color: '#A66800', fontWeight: 600 }}>
        <Clock size={11} /> 제출
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10.5, color: T.grey400, fontWeight: 600 }}>미제출</span>
  );
}

// ── 선택 구성원 상세 패널 ──
function MemberDetail({
  cycleId,
  evaluatee,
  review,
  memberUsers,
  readOnly,
  onConfirmed,
  toast,
}: {
  cycleId: string;
  evaluatee: Evaluation;
  review: MidtermReview | null;
  memberUsers: User[];
  readOnly: boolean;
  onConfirmed: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const evaluateeId = evaluatee.evaluateeId;
  const { data: progress, loading: progLoading } = useMidtermProgress({
    cycleId,
    userId: evaluateeId,
  });
  const { data: actionData, loading: actionLoading, reload: reloadActions } =
    useActionItems({ cycleId, evaluateeId });

  const [reviewerNote, setReviewerNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ActionItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReviewerNote(review?.reviewerNote ?? '');
  }, [review?.id, review?.reviewerNote]);

  const confirmed = review?.status === 'confirmed';
  const selfSubmitted = review?.status === 'self_done' || confirmed;

  async function handleConfirm() {
    if (!review) {
      toast.show({ variant: 'danger', message: '구성원이 자가 점검을 제출해야 확인할 수 있어요.' });
      return;
    }
    if (!reviewerNote.trim()) return;
    setConfirming(true);
    try {
      await midtermReviewCommands.confirm(review.id, { reviewerNote: reviewerNote.trim() });
      toast.show({ variant: 'success', message: '중간 점검을 확인 처리했어요.' });
      onConfirmed();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '확인 처리에 실패했어요.',
      });
    } finally {
      setConfirming(false);
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

  async function saveActionItem(v: ActionItemFormValue) {
    setSaving(true);
    try {
      if (editItem) {
        await actionItemCommands.update(editItem.id, {
          title: v.title,
          detail: v.detail,
          assigneeId: v.assigneeId ?? undefined,
          kpiId: v.kpiId,
          dueDate: v.dueDate,
        });
        toast.show({ variant: 'success', message: '보완 조치를 수정했어요.' });
      } else {
        await actionItemCommands.create({
          cycleId,
          evaluateeId,
          title: v.title,
          detail: v.detail,
          assigneeId: v.assigneeId ?? undefined,
          kpiId: v.kpiId,
          dueDate: v.dueDate,
        });
        toast.show({ variant: 'success', message: '보완 조치를 등록했어요.' });
      }
      setModalOpen(false);
      setEditItem(null);
      reloadActions();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  const items: ActionItem[] = actionData?.data ?? [];
  const kpiOptions = (progress?.kpis ?? []).map((k) => ({ value: k.kpiId, label: k.title }));
  const name = evaluatee.userName ?? evaluateeId.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      {/* 구성원 헤더 */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 15, fontWeight: 700, color: T.grey900 }}>{name}</span>
        {evaluatee.departmentName && (
          <span style={{ fontSize: 12, color: T.grey500 }}>· {evaluatee.departmentName}</span>
        )}
        <span className="ml-auto" style={{ fontSize: 11.5, color: review ? T.grey600 : T.grey400 }}>
          self 점검: {review?.status === 'pending' || !review ? '미제출' : review.status === 'self_done' ? '제출완료' : '확인완료'}
        </span>
      </div>

      {/* KPI 진척 */}
      <Subsection title="KPI 진척">
        {progLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <MidtermProgressTable items={progress?.kpis ?? []} variant="review" />
        )}
      </Subsection>

      {/* 구성원 자가 점검 */}
      <Subsection title="구성원 자가 점검">
        {review?.selfNote ? (
          <p className="whitespace-pre-wrap" style={{ fontSize: 13, color: T.grey800, lineHeight: 1.55 }}>
            {review.selfNote}
          </p>
        ) : (
          <p style={{ fontSize: 12.5, color: T.grey500 }}>
            {selfSubmitted ? '자가 점검 코멘트가 없어요.' : '아직 미제출이에요.'}
          </p>
        )}
      </Subsection>

      {/* 부서장 확인 */}
      <Subsection title="부서장 확인">
        {confirmed ? (
          <div className="flex flex-col gap-1">
            <p className="whitespace-pre-wrap" style={{ fontSize: 13, color: T.grey800, lineHeight: 1.55 }}>
              {review?.reviewerNote}
            </p>
            <span style={{ fontSize: 11.5, color: '#0B7544' }}>
              확인 완료
              {review?.confirmedAt
                ? ` · ${new Date(review.confirmedAt).toLocaleDateString('ko-KR')}`
                : ''}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField
              label="부서장 중간 피드백"
              hideLabel
              multiline
              rows={3}
              value={reviewerNote}
              onChange={setReviewerNote}
              readOnly={readOnly}
              placeholder="구성원에게 줄 중간 피드백을 적어주세요. (확인 처리 전 필수)"
            />
            {!readOnly && !selfSubmitted && (
              <InfoBanner tone="info">
                구성원이 자가 점검을 제출하면 피드백을 작성하고 확인할 수 있어요.
              </InfoBanner>
            )}
            {!readOnly && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  loading={confirming}
                  disabled={!selfSubmitted || !reviewerNote.trim()}
                  onClick={handleConfirm}
                >
                  확인 처리
                </Button>
              </div>
            )}
          </div>
        )}
      </Subsection>

      {/* 보완 조치 */}
      <Subsection
        title="보완 조치"
        action={
          !readOnly ? (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={13} />}
              onClick={() => {
                setEditItem(null);
                setModalOpen(true);
              }}
            >
              보완 조치 등록
            </Button>
          ) : undefined
        }
      >
        {actionLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12.5, color: T.grey500 }}>
            이 구성원에게 등록된 보완 조치가 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <ActionItemRow
                key={it.id}
                item={it}
                mode={readOnly ? 'readonly' : 'owner'}
                onChangeStatus={changeStatus}
                onEdit={(item) => {
                  setEditItem(item);
                  setModalOpen(true);
                }}
                busy={busyItemId === it.id}
              />
            ))}
          </div>
        )}
      </Subsection>

      <ActionItemFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
        }}
        editing={!!editItem}
        memberUsers={memberUsers}
        kpiOptions={kpiOptions}
        submitting={saving}
        initial={
          editItem
            ? {
                title: editItem.title,
                detail: editItem.detail ?? undefined,
                assigneeId: editItem.assigneeId,
                kpiId: editItem.kpiId,
                dueDate: editItem.dueDate ? editItem.dueDate.slice(0, 10) : '',
              }
            : { assigneeId: evaluateeId }
        }
        onSubmit={saveActionItem}
      />
    </div>
  );
}

function Subsection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${T.grey200}` }}>
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ borderBottom: `1px solid ${T.grey100}`, background: T.grey50 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>{title}</span>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}
