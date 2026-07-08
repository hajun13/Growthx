'use client';

// 부서장(team_lead/division_head) 블록 — 구성원 점검·평가 전용.
// 2026-07-02 재구성: 내부 탭(재조정/조직 요약)은 MidtermView 페이지 탭으로 승격·제거되어
// 이 컴포넌트는 구성원 목록 → 상세(MemberDetail: KPI 진행/상급자 점검/보완조치)만 담당한다.
// 폼 상태 보존: 전 섹션 마운트 + display:none 토글
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useMidtermReviews } from '../hooks';
import { Card } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { EvaluationSubjectPanel } from '@/components/EvaluationSubjectPanel';
import { EmptyState, Skeleton } from '@/components/States';
import { cn } from '@/lib/utils';
import { MemberDetail } from './MemberDetail';
import { ReviewBadge } from './deptHeadHelpers';
import type { User, Evaluation, MidtermReview } from '@/lib/types';

export function DeptHeadMidterm({
  cycleId,
  user,
  readOnly,
}: {
  cycleId: string;
  user: User;
  readOnly: boolean;
}) {
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'panel'>('list');
  // 선택 구성원 상세(ReviewSplitPanel)의 미저장 여부 — 전환 확인 경고용.
  const dirtyRef = useRef(false);
  // 미저장 상태에서 다른 구성원 선택 시 확인 모달(공용 Modal — window.confirm 대체) 대상.
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  const active = useMemo(
    () => targets.find((t) => t.evaluateeId === selectedId) ?? targets[0] ?? null,
    [targets, selectedId],
  );
  const activeUserId = active?.evaluateeId ?? null;

  // 최종 승인(confirmed)과 확인 진행중(내 단계 여부와 무관한 결재 진행)을 구분 집계.
  const confirmCount = targets.filter(
    (t) => reviewByEvaluatee.get(t.evaluateeId)?.status === 'confirmed',
  ).length;
  const inProgressCount = targets.filter((t) => {
    const r = reviewByEvaluatee.get(t.evaluateeId);
    return r?.status === 'self_done' && (r.reviewStage ?? 0) > 0;
  }).length;

  const filtered = targets.filter((t) =>
    search ? (t.userName ?? t.evaluateeId).includes(search) : true,
  );
  const subjectItems = filtered.map((t) => {
    const rv = reviewByEvaluatee.get(t.evaluateeId);
    const name = t.userName ?? t.evaluateeId.slice(0, 8);
    return {
      id: t.evaluateeId,
      name,
      description: t.departmentName ?? null,
      active: t.evaluateeId === activeUserId,
      onSelect: () => selectMember(t.evaluateeId),
      accessory: <ReviewBadge status={rv?.status} reviewStage={rv?.reviewStage} />,
    };
  });

  function selectMember(evaluateeId: string) {
    // 미저장 판정/피드백이 있으면 전환 전 확인(공용 Modal) — MemberDetail 이 key 리마운트되어 전부 유실된다.
    if (dirtyRef.current && evaluateeId !== activeUserId) {
      setPendingSelectId(evaluateeId);
      return;
    }
    applySelect(evaluateeId);
  }

  function applySelect(evaluateeId: string) {
    if (evaluateeId !== activeUserId) dirtyRef.current = false;
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
    <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      <div className="p-5">
        {/* 승인 카운터 — 최종 승인(confirmed)과 확인 진행중(순차 결재 중) 분리 표기 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-muted-foreground">
            최종 승인{' '}
            <span className="tabular-nums font-semibold text-foreground">{confirmCount}</span>
            {' '}· 확인 진행중{' '}
            <span className="tabular-nums font-semibold text-foreground">{inProgressCount}</span>
            {' '}/ 전체{' '}
            <span className="tabular-nums font-semibold text-foreground">{targets.length}</span>명
          </p>
        </div>

        <div className="gx-master-detail">
          {/* ── 구성원 리스트 ── */}
          <EvaluationSubjectPanel
            title="구성원"
            count={targets.length}
            search={search}
            onSearch={setSearch}
            searchPlaceholder="이름 검색"
            searchAriaLabel="구성원 이름 검색"
            emptyMessage="검색 결과가 없어요."
            items={subjectItems}
            maxHeightClassName="max-h-[480px]"
            className={mobileView === 'panel' ? 'hidden lg:block' : 'block'}
          />

          {/* ── 선택 구성원 상세 패널 ── */}
          <div className={cn(mobileView === 'list' ? 'hidden lg:block' : 'block')}>
            {!active ? (
              <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground rounded-lg border border-dashed border-border/60">
                좌측에서 구성원을 선택하세요.
              </div>
            ) : (
              <>
                <button
                  onClick={() => setMobileView('list')}
                  className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-primary lg:hidden"
                >
                  <ChevronLeft size={14} /> 구성원 목록
                </button>
                <MemberDetail
                  key={activeUserId}
                  cycleId={cycleId}
                  evaluatee={active}
                  review={reviewByEvaluatee.get(active.evaluateeId) ?? null}
                  readOnly={readOnly}
                  onConfirmed={reloadReviews}
                  onDirtyChange={(d) => { dirtyRef.current = d; }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 구성원 전환 확인 — 미저장 판정/피드백 유실 경고(공용 Modal) */}
      <Modal
        open={pendingSelectId !== null}
        onClose={() => setPendingSelectId(null)}
        title="다른 구성원으로 이동할까요?"
        size="sm"
        primaryAction={{
          label: '이동',
          variant: 'danger',
          onClick: () => {
            const next = pendingSelectId;
            setPendingSelectId(null);
            if (next) applySelect(next);
          },
        }}
        secondaryAction={{ label: '계속 작성', onClick: () => setPendingSelectId(null) }}
      >
        작성 중인 점검 의견이 저장되지 않았어요. 다른 구성원으로 이동하면 사라져요.
      </Modal>
    </div>
  );
}
