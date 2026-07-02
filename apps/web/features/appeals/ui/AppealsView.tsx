'use client';

// 이의제기 화면 — image 13 재현: 좌측 목록(사진+상태배지+카드) / 우측 상세(신청자정보+스테퍼+처리내용+최종결정).
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton, ErrorState, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useAppealsData } from '../hooks';
import { displayStatus } from './appealTimeline';
import { AppealListPanel } from './AppealListPanel';
import { AppealDetailPanel } from './AppealDetailPanel';
import { AppealCreateForm } from './AppealCreateForm';
import { useAppealActions } from './useAppealActions';

export function AppealsView() {
  return (
    <Suspense fallback={
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    }>
      <AppealsInner />
    </Suspense>
  );
}

// 상단 상태별 카운트 — 컬러 도트 + 라벨 + 수치(목업 정렬).
function StatDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label} <b className="text-foreground">{value}</b>
    </span>
  );
}

function AppealsInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const resultId = searchParams.get('resultId');

  const data = useAppealsData(!!user);
  const { items: appeals, loading, error, reload } = data;
  const actions = useAppealActions(data, resultId);

  const isLeaderOrHr =
    !!user && (user.role === 'team_lead' || user.role === 'division_head' || user.role === 'hr_admin');
  const isHr = user?.role === 'hr_admin';

  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      appeals.filter((a) => {
        if (filter !== 'all' && displayStatus(a) !== filter) return false;
        if (search && !(a.userName ?? '').includes(search) && !a.reason.includes(search)) return false;
        return true;
      }),
    [appeals, filter, search],
  );
  // 선택이 없으면 첫 항목 자동 선택(목업 — 상세 패널 상시 표시).
  const sel = appeals.find((a) => a.id === selected) ?? filtered[0] ?? appeals[0] ?? null;

  if (loading && appeals.length === 0) return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
  if (error) return <ErrorState onRetry={reload} />;

  const counts = {
    all: appeals.length,
    submitted: appeals.filter((a) => displayStatus(a) === 'submitted').length,
    under_review: appeals.filter((a) => displayStatus(a) === 'under_review').length,
    answered: appeals.filter((a) => displayStatus(a) === 'answered').length,
    closed: appeals.filter((a) => displayStatus(a) === 'closed').length,
    rejected: appeals.filter((a) => displayStatus(a) === 'rejected').length,
  };

  return (
    <PageContainer>
      <PageHeader
        title="이의제기 관리"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
        right={
          <div className="flex items-center gap-3.5 text-[12px] text-muted-foreground">
            <span>전체 <b className="text-foreground">{counts.all}</b></span>
            <StatDot color="#94A3B8" label="접수" value={counts.submitted} />
            <StatDot color="#F59E0B" label="검토중" value={counts.under_review} />
            <StatDot color="#0257CE" label="답변완료" value={counts.answered} />
            <StatDot color="#0EA05E" label="최종완료" value={counts.closed} />
            <StatDot color="#EF4444" label="반려" value={counts.rejected} />
          </div>
        }
      />

      {/* 이의제기 신청 폼 (결과에서 진입 시) */}
      {resultId && (
        <AppealCreateForm
          reason={actions.reason}
          reasonError={actions.reasonError}
          busy={actions.busy}
          onReasonChange={actions.setReason}
          onSubmit={() => void actions.submitAppeal()}
        />
      )}

      {appeals.length === 0 ? (
        <EmptyState title="이의제기 내역이 없어요." description="아직 등록된 이의제기가 없어요." />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.9fr)_1.5fr]">
          <AppealListPanel
            appeals={appeals}
            filtered={filtered}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            selectedId={sel?.id ?? null}
            onSelect={setSelected}
          />

          {sel && (
            <AppealDetailPanel
              appeal={sel}
              isLeaderOrHr={isLeaderOrHr}
              isHr={isHr}
              isOwner={sel.userId === user?.id}
              responseDraft={actions.responseDraft[sel.id] ?? ''}
              onResponseDraftChange={(v) => actions.setResponseDraft((p) => ({ ...p, [sel.id]: v }))}
              busy={actions.busy}
              onRespond={() => void actions.respond(sel.id)}
              onDecide={(body) => void actions.decide(sel.id, body)}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
