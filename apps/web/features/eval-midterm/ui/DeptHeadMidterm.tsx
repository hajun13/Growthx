'use client';

// 부서장(team_lead/division_head) 블록 — C-2.
// 상위 탭 3개: 구성원 진척 검토 / 재조정 요청 / 조직 진척 요약
// 구성원 선택 → 섹션 탭 4개: KPI 진척 / 자가점검 확인 / 보완조치 / 재조정
// 폼 상태 보존: 전 섹션 마운트 + display:none 토글
// 로직·훅·API·제출 흐름 불변
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, ChevronLeft, CheckCircle2, Clock } from 'lucide-react';
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
import { MidtermProgressTable } from '@/components/MidtermProgressTable';
import { ActionItemRow } from '@/components/ActionItemRow';
import {
  ActionItemFormModal,
  type ActionItemFormValue,
} from '@/components/ActionItemFormModal';
import { EmptyState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { RebaselineReviewQueue } from './RebaselineReviewQueue';
import { OrgProgressCard } from './OrgProgressCard';

const K = { primary: '#7a37d8', secondary: '#7A37D8', tertiary: '#2563eb' } as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';
import type {
  User,
  Evaluation,
  ActionItem,
  ActionItemStatus,
  MidtermReview,
} from '@/lib/types';

// ── 상위 탭 정의 ──
type TopTab = 'members' | 'rebaseline' | 'org';

const TOP_TABS: { key: TopTab; label: string }[] = [
  { key: 'members', label: '구성원 진척 검토' },
  { key: 'rebaseline', label: '재조정 요청' },
  { key: 'org', label: '조직 진척 요약' },
];

type DotStatus = 'done' | 'todo' | 'none';

interface TopTabBarProps {
  active: TopTab;
  onSelect: (t: TopTab) => void;
  rebaselinePending: number; // 검토 대기 건수
}

function TopTabBar({ active, onSelect, rebaselinePending }: TopTabBarProps) {
  return (
    <div
      className="flex"
      style={{ borderBottom: '1px solid rgba(204,204,212,0.4)', marginBottom: 0 }}
    >
      {TOP_TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className="flex items-center gap-1.5"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#7A37D8' : '#74747f',
              borderBottom: `2px solid ${isActive ? '#7A37D8' : 'transparent'}`,
              marginBottom: -1,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.key === 'rebaseline' && rebaselinePending > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#f59e0b',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {rebaselinePending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── 섹션 탭 정의 (MemberDetail 내부) ──
type MemberSectionTab = 'progress' | 'confirm' | 'actions' | 'rebaseline';

const MEMBER_SECTION_TABS: { key: MemberSectionTab; label: string }[] = [
  { key: 'progress', label: 'KPI 진척' },
  { key: 'confirm', label: '자가점검 확인' },
  { key: 'actions', label: '보완조치' },
  { key: 'rebaseline', label: '재조정' },
];

interface MemberSectionTabBarProps {
  active: MemberSectionTab;
  onSelect: (t: MemberSectionTab) => void;
  dots: Record<MemberSectionTab, DotStatus>;
}

function MemberSectionTabBar({ active, onSelect, dots }: MemberSectionTabBarProps) {
  return (
    <div
      className="flex"
      style={{ borderBottom: '1px solid rgba(204,204,212,0.4)', marginBottom: 0 }}
    >
      {MEMBER_SECTION_TABS.map((t) => {
        const isActive = active === t.key;
        const dot = dots[t.key];
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className="flex items-center gap-1.5"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#7A37D8' : '#74747f',
              borderBottom: `2px solid ${isActive ? '#7A37D8' : 'transparent'}`,
              marginBottom: -1,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {dot === 'done' && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: '#2563eb', display: 'inline-block', flexShrink: 0,
                }}
              />
            )}
            {dot === 'todo' && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: '#f59e0b', display: 'inline-block', flexShrink: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

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

  // 상위 탭 상태
  const [topTab, setTopTab] = useState<TopTab>('members');

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

  // 재조정 요청 대기 건수 (탭 뱃지용)
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
    <div
      className="flex flex-col gap-0 rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW, background: '#fff' }}
    >
      {/* 상위 탭 바 */}
      <TopTabBar
        active={topTab}
        onSelect={setTopTab}
        rebaselinePending={rebaselinePending}
      />

      {/* 상위 탭 콘텐츠 — 전부 마운트, display:none 토글로 상태 보존 */}

      {/* 탭 A: 구성원 진척 검토 */}
      <div style={{ display: topTab === 'members' ? 'block' : 'none', padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: 13, color: '#74747f' }}>
            확인{' '}
            <span className="tabular-nums" style={{ fontWeight: 700, color: '#18181c' }}>{confirmCount}</span>
            {' '}/ 전체{' '}
            <span className="tabular-nums" style={{ fontWeight: 700, color: '#18181c' }}>{targets.length}</span>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* 구성원 리스트 */}
          <div
            className={`${mobileView === 'panel' ? 'hidden lg:block' : 'block'} self-start rounded-xl overflow-hidden`}
            style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ background: '#f7f7f9', borderBottom: '1px solid rgba(204,204,212,0.3)' }}
            >
              <Search size={12} color="#74747f" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 검색"
                className="flex-1 outline-none"
                style={{ fontSize: 12, background: 'transparent', color: '#18181c' }}
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center" style={{ fontSize: 12.5, color: '#74747f' }}>
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
                        borderBottom: '1px solid rgba(204,204,212,0.2)',
                        borderLeft: `3px solid ${isActive ? K.secondary : 'transparent'}`,
                        background: isActive ? 'rgba(122,55,216,0.05)' : 'transparent',
                      }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: isActive ? K.secondary : '#ccccd4',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: '#18181c' }}>
                          {name}
                        </span>
                        {t.departmentName && (
                          <span className="block truncate" style={{ fontSize: 11, color: '#74747f' }}>
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
          <div className={`${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
            {!active ? (
              <p className="py-12 text-center" style={{ fontSize: 13, color: '#74747f' }}>
                좌측에서 구성원을 선택하세요.
              </p>
            ) : (
              <>
                <button
                  onClick={() => setMobileView('list')}
                  className="mb-2 flex items-center gap-1 lg:hidden"
                  style={{ fontSize: 12.5, color: K.secondary, fontWeight: 600 }}
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
      <div style={{ display: topTab === 'rebaseline' ? 'block' : 'none', padding: 24 }}>
        <RebaselineReviewQueue cycleId={cycleId} readOnly={readOnly} />
      </div>

      {/* 탭 C: 조직 진척 요약 */}
      <div style={{ display: topTab === 'org' ? 'block' : 'none', padding: 24 }}>
        <OrgProgressCard cycleId={cycleId} userId={user.id} />
      </div>
    </div>
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
      <span className="flex items-center gap-0.5" style={{ fontSize: 10.5, color: '#0e6633', fontWeight: 600 }}>
        <CheckCircle2 size={11} /> 확인
      </span>
    );
  }
  if (status === 'self_done') {
    return (
      <span className="flex items-center gap-0.5" style={{ fontSize: 10.5, color: '#9a6103', fontWeight: 600 }}>
        <Clock size={11} /> 제출
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10.5, color: '#a0a0ac', fontWeight: 600 }}>미제출</span>
  );
}

// ── 선택 구성원 상세 패널 — 섹션 탭 구조 ──
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

  // 섹션 탭 상태
  const [sectionTab, setSectionTab] = useState<MemberSectionTab>('progress');

  useEffect(() => {
    setReviewerNote(review?.reviewerNote ?? '');
  }, [review?.id, review?.reviewerNote]);

  const confirmed = review?.status === 'confirmed';
  const selfSubmitted = review?.status === 'self_done' || confirmed;

  const items: ActionItem[] = actionData?.data ?? [];

  // 진행 힌트 도트 계산
  const dots: Record<MemberSectionTab, DotStatus> = useMemo(() => {
    const progressDot: DotStatus = 'none'; // KPI 진척은 조회 전용 — 힌트 불필요
    const confirmDot: DotStatus = confirmed ? 'done' : selfSubmitted ? 'todo' : 'none';
    const actionsDot: DotStatus =
      items.length > 0
        ? items.every((i) => i.status === 'done') ? 'done' : 'todo'
        : 'none';
    const rebaselineDot: DotStatus = 'none'; // 상위 탭에서 일괄 관리
    return {
      progress: progressDot,
      confirm: confirmDot,
      actions: actionsDot,
      rebaseline: rebaselineDot,
    };
  }, [confirmed, selfSubmitted, items]);

  // 기본 탭: 첫 번째로 할 일이 있는 탭
  useEffect(() => {
    if (!progLoading) {
      const first = (Object.keys(dots) as MemberSectionTab[]).find((k) => dots[k] === 'todo');
      if (first) setSectionTab(first);
    }
  }, [progLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const kpiOptions = (progress?.kpis ?? []).map((k) => ({ value: k.kpiId, label: k.title }));
  const name = evaluatee.userName ?? evaluateeId.slice(0, 8);

  return (
    <div className="flex flex-col gap-0">
      {/* 구성원 헤더 */}
      <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: '#7A37D8', color: '#fff', fontSize: 13, fontWeight: 700 }}
          >
            {name.slice(0, 1)}
          </span>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#18181c' }}>{name}</span>
            {evaluatee.departmentName && (
              <span style={{ fontSize: 12, color: '#74747f', marginLeft: 6 }}>· {evaluatee.departmentName}</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: '#74747f' }}>자가 점검</span>
          {(!review || review.status === 'pending') ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#efeff2', color: '#a0a0ac' }}>미제출</span>
          ) : review.status === 'self_done' ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,120,0,0.08)', color: '#9a6103' }}>제출완료</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(14,154,160,0.08)', color: '#0e6633' }}>확인완료</span>
          )}
        </div>
      </div>

      {/* 섹션 탭 바 */}
      <MemberSectionTabBar
        active={sectionTab}
        onSelect={setSectionTab}
        dots={dots}
      />

      {/* 탭 콘텐츠 — 전부 마운트, display:none 토글로 폼 상태 보존 */}
      <div style={{ marginTop: 16 }}>

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
          {/* 구성원 자가 점검 코멘트 */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}>
            <div
              className="flex items-center px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(204,204,212,0.2)', background: '#f7f7f9' }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#18181c' }}>구성원 자가 점검</span>
            </div>
            <div className="p-4 bg-white">
              {review?.selfNote ? (
                <p className="whitespace-pre-wrap" style={{ fontSize: 13, color: '#2a2a30', lineHeight: 1.55 }}>
                  {review.selfNote}
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: '#74747f' }}>
                  {selfSubmitted ? '자가 점검 코멘트가 없어요.' : '아직 미제출이에요.'}
                </p>
              )}
            </div>
          </div>

          {/* 부서장 확인 — 구성원이 자가 점검을 제출한 뒤에만 노출 */}
          {selfSubmitted && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}>
              <div
                className="flex items-center px-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(204,204,212,0.2)', background: '#f7f7f9' }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#18181c' }}>부서장 확인</span>
              </div>
              <div className="p-4 bg-white">
                {confirmed ? (
                  <div className="flex flex-col gap-1">
                    <p className="whitespace-pre-wrap" style={{ fontSize: 13, color: '#2a2a30', lineHeight: 1.55 }}>
                      {review?.reviewerNote}
                    </p>
                    <span style={{ fontSize: 11.5, color: '#0e6633' }}>
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
                    {!readOnly && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          loading={confirming}
                          disabled={!reviewerNote.trim()}
                          onClick={handleConfirm}
                        >
                          확인 처리
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!selfSubmitted && (
            <div
              className="flex flex-col items-center justify-center gap-2 px-5 py-10 rounded-xl"
              style={{ background: '#f7f7f9', border: '1px solid rgba(204,204,212,0.4)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: '#a0a0ac' }}>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, color: '#74747f', textAlign: 'center' }}>
                구성원이 자가 점검을 제출한 뒤<br />확인 처리할 수 있어요.
              </p>
            </div>
          )}
        </div>

        {/* 탭 3: 보완조치 */}
        <div style={{ display: sectionTab === 'actions' ? 'block' : 'none' }}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}>
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(204,204,212,0.2)', background: '#f7f7f9' }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#18181c' }}>
                보완 조치{items.length > 0 ? ` (${items.length}건)` : ''}
              </span>
              {!readOnly && (
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
              )}
            </div>
            <div className="p-4 bg-white">
              {actionLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : items.length === 0 ? (
                <p style={{ fontSize: 12.5, color: '#74747f' }}>
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
            </div>
          </div>
        </div>

        {/* 탭 4: 재조정 — 상위 "재조정 요청" 탭으로 이동 안내 */}
        <div style={{ display: sectionTab === 'rebaseline' ? 'block' : 'none' }}>
          <div
            className="flex items-start gap-3 px-5 py-5 rounded-xl"
            style={{ background: '#eaf1fe', border: '1px solid #cdddfb' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#1d4fc4', flexShrink: 0, marginTop: 1 }}>
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#1d4fc4', marginBottom: 3 }}>목표 재조정 검토</p>
              <p style={{ fontSize: 12.5, color: '#565660', lineHeight: 1.5 }}>
                전체 구성원의 재조정 요청은 상단 <strong style={{ color: '#7A37D8' }}>"재조정 요청"</strong> 탭에서 일괄 관리할 수 있어요.
              </p>
            </div>
          </div>
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
