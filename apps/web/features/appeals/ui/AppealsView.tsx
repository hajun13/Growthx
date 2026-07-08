'use client';

// 이의제기 화면 — image 13 재현: 좌측 목록(사진+상태배지+카드) / 우측 상세(신청자정보+스테퍼+처리내용+최종결정).
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton, ErrorState, EmptyState } from '@/components/States';
import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
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
  // 선택이 없으면 필터 결과의 첫 항목 자동 선택. 필터 밖 항목으로 폴백하지 않는다
  // (필터 0건인데 상세에 다른 항목이 보이던 혼란 제거 — 0건이면 placeholder).
  const sel = filtered.find((a) => a.id === selected) ?? filtered[0] ?? null;

  if (loading && appeals.length === 0) return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
  if (error) return <ErrorState onRetry={reload} />;

  // under_review 는 저장 상태로 도달 불가(백엔드 전이) — displayStatus 가 '접수'에 흡수.
  const counts = {
    all: appeals.length,
    submitted: appeals.filter((a) => displayStatus(a) === 'submitted').length,
    answered: appeals.filter((a) => displayStatus(a) === 'answered').length,
    closed: appeals.filter((a) => displayStatus(a) === 'closed').length,
    rejected: appeals.filter((a) => displayStatus(a) === 'rejected').length,
  };

  // 신청 진입로 안내 — 이의제기는 평가 결과 화면에서만 신청 가능(비관리자 + 직접 진입 시).
  const showEntryGuide = !isHr && !resultId;

  return (
    <PageContainer>
      <PageHeader
        title="이의제기 관리"
        subtitle="등급 통보 후 7일 이내에 평가 결과에 대한 이의제기를 신청하고 처리합니다."
        right={
          <div className="flex items-center gap-3.5 text-[12px] text-muted-foreground">
            <span>전체 <b className="text-foreground">{counts.all}</b></span>
            <StatDot color="#94A3B8" label="접수" value={counts.submitted} />
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

      {/* 신청 진입로 안내 — 내역이 있어도 상단에 한 줄 유지 */}
      {showEntryGuide && appeals.length > 0 && (
        <InfoBanner
          tone="info"
          action={
            <Link href="/eval/result">
              <Button variant="secondary" size="sm" leftIcon={<ArrowRight size={13} aria-hidden />}>
                내 평가 결과로 이동
              </Button>
            </Link>
          }
        >
          새 이의제기는 평가 결과 화면에서 신청할 수 있어요 — 등급 통보 후 7일 이내.
        </InfoBanner>
      )}

      {appeals.length === 0 ? (
        showEntryGuide ? (
          <EmptyState
            title="이의제기 내역이 없어요."
            description="이의제기는 평가 결과 화면에서 신청할 수 있어요 — 등급 통보 후 7일 이내에 내 평가 결과에서 ‘이의제기’를 눌러 접수하세요."
            action={
              <Link href="/eval/result">
                <Button variant="secondary" size="sm">
                  내 평가 결과로 이동
                  <ArrowRight size={13} aria-hidden />
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState title="이의제기 내역이 없어요." description="아직 등록된 이의제기가 없어요." />
        )
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

          {sel ? (
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
          ) : (
            <EmptyState
              title="표시할 이의제기가 없어요."
              description="현재 필터·검색 조건에 맞는 항목이 없어요. 필터를 ‘전체’로 바꾸거나 검색어를 지워 보세요."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
