'use client';

// 부서장(team_lead/division_head) 블록 — C-2.
// 상위 탭 3개: 구성원 진척 검토 / 재조정 요청 / 조직 진척 요약
// 구성원 선택 → 섹션 탭 3개: KPI 진척 / 자가점검 확인 / 보완조치
// 폼 상태 보존: 전 섹션 마운트 + display:none 토글
// 로직·훅·API·제출 흐름 불변
import { useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, CheckCircle2, Clock } from 'lucide-react';
import { useEvaluations } from '@/hooks/useEvaluations';
import {
  useMidtermProgress,
  useMidtermReviews,
  useActionItems,
  midtermReviewCommands,
  actionItemCommands,
} from '../hooks';
// 재조정(rebaseline)은 이 슬라이스 범위 밖 → 기존 훅 유지.
import { useRebaselineRequests } from '@/hooks/useMidterm';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { SearchInput } from '@/components/SearchInput';
import { MidtermProgressTable } from '@/components/MidtermProgressTable';
import { ActionItemRow } from '@/components/ActionItemRow';
import {
  ActionItemFormModal,
  type ActionItemFormValue,
} from '@/components/ActionItemFormModal';
import { EmptyState, Skeleton } from '@/components/States';
import { Tabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RebaselineReviewQueue } from './RebaselineReviewQueue';
import { OrgProgressCard } from './OrgProgressCard';
import type {
  User,
  Evaluation,
  ActionItem,
  ActionItemStatus,
  MidtermReview,
} from '@/lib/types';

// ── 상위 탭 정의 ──
type TopTab = 'members' | 'rebaseline' | 'org';

type DotStatus = 'done' | 'todo' | 'none';

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

  const [topTab, setTopTab] = useState<TopTab>('members');

  const { data: evals, loading: evalsLoading } = useEvaluations(
    { cycleId, evaluatorId: user.id, type: 'downward' },
    { enabled: !!cycleId },
  );
  const targets: Evaluation[] = useMemo(() => evals?.data ?? [], [evals]);

  const { data: reviews, reload: reloadReviews } = useMidtermReviews({ cycleId });
  const reviewByEvaluatee = useMemo(() => {
    const m = new Map<string, MidtermReview>();
    for (const r of reviews?.data ?? []) m.set(r.evaluateeId, r);
    return m;
  }, [reviews]);

  const { data: rebaselineData } = useRebaselineRequests(
    { cycleId, forReview: true },
    { enabled: !!cycleId },
  );
  const rebaselinePending = rebaselineData?.data?.length ?? 0;

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

  const topTabItems = [
    { key: 'members', label: '구성원 진척 검토' },
    {
      key: 'rebaseline',
      label: '재조정 요청',
      badge: rebaselinePending > 0 ? rebaselinePending : undefined,
    },
    { key: 'org', label: '조직 진척 요약' },
  ];

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
    <div className="flex flex-col gap-0 rounded-xl overflow-hidden border border-border bg-card shadow-elev-1">
      {/* 상위 탭 바 */}
      <Tabs
        items={topTabItems}
        activeKey={topTab}
        onChange={(k) => setTopTab(k as TopTab)}
      />

      {/* 탭 콘텐츠 — 전부 마운트, display:none 토글 */}

      {/* 탭 A: 구성원 진척 검토 */}
      <div style={{ display: topTab === 'members' ? 'block' : 'none' }} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted-foreground">
            확인{' '}
            <span className="tabular-nums font-bold text-foreground">{confirmCount}</span>
            {' '}/ 전체{' '}
            <span className="tabular-nums font-bold text-foreground">{targets.length}</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* 구성원 리스트 */}
          <div
            className={cn(
              'self-start rounded-xl overflow-hidden border border-border shadow-elev-1',
              mobileView === 'panel' ? 'hidden lg:block' : 'block',
            )}
          >
            {/* 검색 */}
            <div className="px-3 py-2.5 bg-muted border-b border-border/30">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="이름 검색"
                className="w-full text-[12px]"
                ariaLabel="구성원 이름 검색"
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
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
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left',
                        'border-b border-border/20 border-l-[3px] transition-colors',
                        isActive
                          ? 'bg-purple-50 border-l-primary'
                          : 'border-l-transparent hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          'text-white text-[12px] font-bold',
                          isActive ? 'bg-primary' : 'bg-muted-foreground/30',
                        )}
                      >
                        {name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {name}
                        </span>
                        {t.departmentName && (
                          <span className="block truncate text-[11px] text-muted-foreground">
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

          {/* 선택 구성원 상세 — 섹션 탭 구조 */}
          <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block')}>
            {!active ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground">
                좌측에서 구성원을 선택하세요.
              </p>
            ) : (
              <>
                <button
                  onClick={() => setMobileView('list')}
                  className="mb-2 flex items-center gap-1 text-[12.5px] font-semibold text-primary lg:hidden"
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
      </div>

      {/* 탭 B: 재조정 요청 */}
      <div style={{ display: topTab === 'rebaseline' ? 'block' : 'none' }} className="p-6">
        <RebaselineReviewQueue cycleId={cycleId} readOnly={readOnly} />
      </div>

      {/* 탭 C: 조직 진척 요약 */}
      <div style={{ display: topTab === 'org' ? 'block' : 'none' }} className="p-6">
        <OrgProgressCard cycleId={cycleId} userId={user.id} />
      </div>
    </div>
  );
}

// downward 대상 Evaluation → UserCombobox 후보 최소 User shape.
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
      <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-success-700">
        <CheckCircle2 size={11} /> 확인
      </span>
    );
  }
  if (status === 'self_done') {
    return (
      <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-warning-700">
        <Clock size={11} /> 제출
      </span>
    );
  }
  return (
    <span className="text-[10.5px] font-semibold text-muted-foreground/60">미제출</span>
  );
}

// ── 선택 구성원 상세 패널 — 섹션 탭 구조 ──
type MemberSectionTab = 'progress' | 'confirm' | 'actions';

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
  const [sectionTab, setSectionTab] = useState<MemberSectionTab>('progress');

  useEffect(() => {
    setReviewerNote(review?.reviewerNote ?? '');
  }, [review?.id, review?.reviewerNote]);

  const confirmed = review?.status === 'confirmed';
  const selfSubmitted = review?.status === 'self_done' || confirmed;
  const items: ActionItem[] = actionData?.data ?? [];

  const dots: Record<MemberSectionTab, DotStatus> = useMemo(() => {
    const confirmDot: DotStatus = confirmed ? 'done' : selfSubmitted ? 'todo' : 'none';
    const actionsDot: DotStatus =
      items.length > 0
        ? items.every((i) => i.status === 'done') ? 'done' : 'todo'
        : 'none';
    return { progress: 'none', confirm: confirmDot, actions: actionsDot };
  }, [confirmed, selfSubmitted, items]);

  useEffect(() => {
    if (!progLoading) {
      const first = (Object.keys(dots) as MemberSectionTab[]).find((k) => dots[k] === 'todo');
      if (first) setSectionTab(first);
    }
  }, [progLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    if (!review) {
      toast.show({ variant: 'danger', message: '구성원이 자가점검을 제출해야 확인할 수 있어요.' });
      return;
    }
    if (!reviewerNote.trim()) return;
    setConfirming(true);
    try {
      await midtermReviewCommands.confirm(review.id, { reviewerNote: reviewerNote.trim() });
      toast.show({ variant: 'success', message: '중간 점검을 확인 완료했어요.' });
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

  const kpiOptions = (progress?.kpis ?? []).map((k) => ({ value: k.kpiId, label: k.title }));
  const name = evaluatee.userName ?? evaluateeId.slice(0, 8);

  const sectionTabItems = [
    { key: 'progress', label: 'KPI 진척' },
    { key: 'confirm', label: '자가점검 확인' },
    { key: 'actions', label: '보완조치' },
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* 구성원 헤더 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[13px] font-bold">
            {name.slice(0, 1)}
          </span>
          <div>
            <span className="text-[15px] font-bold text-foreground">{name}</span>
            {evaluatee.departmentName && (
              <span className="text-[12px] text-muted-foreground ml-1.5">
                · {evaluatee.departmentName}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">자가점검</span>
          {(!review || review.status === 'pending') ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground/60">미제출</span>
          ) : review.status === 'self_done' ? (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-50 text-warning-700">제출완료</span>
          ) : (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success-50 text-success-700">확인완료</span>
          )}
        </div>
      </div>

      {/* 섹션 탭 바 */}
      <Tabs
        items={sectionTabItems}
        activeKey={sectionTab}
        onChange={(k) => setSectionTab(k as MemberSectionTab)}
      />

      {/* 탭 콘텐츠 — 전부 마운트, display:none 토글 */}
      <div className="mt-4">

        {/* 탭 1: KPI 진척 */}
        <div style={{ display: sectionTab === 'progress' ? 'block' : 'none' }}>
          {progLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <MidtermProgressTable items={progress?.kpis ?? []} variant="review" />
          )}
        </div>

        {/* 탭 2: 자가점검 확인 */}
        <div style={{ display: sectionTab === 'confirm' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
          {/* 구성원 자가점검 코멘트 */}
          <Card title="구성원 자가점검">
            {review?.selfNote ? (
              <p className="whitespace-pre-wrap text-[13px] text-foreground leading-relaxed">
                {review.selfNote}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                {selfSubmitted ? '자가점검 코멘트가 없어요.' : '아직 미제출이에요.'}
              </p>
            )}
          </Card>

          {selfSubmitted && (
            <Card title="부서장 확인">
              {confirmed ? (
                <div className="flex flex-col gap-1">
                  <p className="whitespace-pre-wrap text-[13px] text-foreground leading-relaxed">
                    {review?.reviewerNote}
                  </p>
                  <span className="text-[11.5px] text-success-700">
                    확인 완료
                    {review?.confirmedAt
                      ? ` · ${new Date(review.confirmedAt).toLocaleDateString('ko-KR')}`
                      : ''}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <TextField
                    label="부서장 피드백"
                    hideLabel
                    multiline
                    rows={3}
                    value={reviewerNote}
                    onChange={setReviewerNote}
                    readOnly={readOnly}
                    placeholder="구성원에게 줄 부서장 피드백을 적어주세요. (확인 완료 전 필수)"
                  />
                  {!readOnly && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        loading={confirming}
                        disabled={!reviewerNote.trim()}
                        onClick={handleConfirm}
                      >
                        확인 완료
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {!selfSubmitted && (
            <EmptyState
              title="구성원이 자가점검을 제출한 뒤 확인 완료할 수 있어요."
            />
          )}
        </div>

        {/* 탭 3: 보완조치 */}
        <div style={{ display: sectionTab === 'actions' ? 'block' : 'none' }}>
          <Card
            title={`보완 조치${items.length > 0 ? ` (${items.length}건)` : ''}`}
            action={
              !readOnly && (
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
              )
            }
          >
            {actionLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : items.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
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
          </Card>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            목표 재조정 요청은 상단 <strong className="font-semibold text-foreground">"재조정 요청"</strong> 탭에서 일괄 검토할 수 있어요.
          </p>
        </div>

      </div>

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
