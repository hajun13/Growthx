'use client';

import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton, EmptyState, ErrorState } from '@/components/States';
import { useAsync } from '@/hooks/useAsync';
import { fetchMidtermSummary, type MidtermStageCounts } from '../api-progress';
import { MidtermWaitingLists } from './MidtermProgressLists';

/**
 * HR 중간점검 진행 현황(설계 §7.5) — 단계별 인원수 + 미착수자.
 * 개시 패널(MidtermOpenPanel) 옆에 놓여 "개시했는데 지금 어디서 멈춰 있나"에 답한다.
 *
 * 로딩·오류·"아직 개시 안 함"을 서로 다른 화면으로 구분한다 — 셋이 같은 빈 화면으로 보이면
 * HR 이 "대상이 없는 것"과 "조회가 실패한 것"을 구분할 수 없다(이 브랜치에서 반복된 결함).
 */
export function MidtermProgressPanel({ cycleId }: { cycleId: string }) {
  const { data, loading, error, reload } = useAsync(
    () => fetchMidtermSummary(cycleId),
    [cycleId],
    { enabled: !!cycleId },
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-bold text-foreground">중간점검 진행 현황</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            단계별 인원수와, 지금 누구의 처리를 기다리고 있는지 보여줘요.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          disabled={loading}
          onClick={reload}
        >
          새로고침
        </Button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <Skeleton className="h-[68px] w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="mt-4">
          <ErrorState
            message={error.message || '진행 현황을 불러오지 못했어요.'}
            onRetry={reload}
          />
        </div>
      ) : !data ? (
        // 예외 없이 값도 없는 경우 — 성공으로 오인하면 "대상 0명"처럼 보이므로 따로 안내한다.
        <div className="mt-4">
          <ErrorState message="진행 현황을 받지 못했어요. 다시 시도해 주세요." onRetry={reload} />
        </div>
      ) : data.counts.total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="아직 개시된 중간점검이 없어요."
            description="위 [대상 미리보기] → [개시]를 실행하면 대상자별 중간점검이 만들어지고, 여기에 단계별 현황이 표시돼요."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <StageCounts counts={data.counts} />
          {data.counts.legacy > 0 && (
            <p className="text-[12px] text-muted-foreground">
              이전 방식(자가점검)으로 남아 있는 건{' '}
              <span className="font-semibold tabular-nums">{data.counts.legacy}</span>건은 단계
              집계에서 빼고 셌어요. 개시를 다시 실행하면 <strong className="font-semibold">이번 개시
              대상에 포함된 사람</strong>(재직 · KPI 확정 · 본부장·그룹대표 제외)만 신규 흐름으로
              바뀌고, 대상 조건에 맞지 않는 건은 그대로 남아요.
            </p>
          )}
          <MidtermWaitingLists
            waitingOnReviewer={data.waitingOnReviewer}
            waitingOnMember={data.waitingOnMember}
            unassigned={data.unassigned}
            notOpened={data.notOpened}
            unfinished={data.counts.unfinished}
            legacy={data.counts.legacy}
          />
        </div>
      )}
    </Card>
  );
}

/** 단계별 인원수 — 흐름 순서(대기 주체가 바뀌는 순서)로 늘어놓아 병목이 눈에 띄게 한다. */
const STAGE_TILES: { key: keyof MidtermStageCounts; label: string; hint: string }[] = [
  { key: 'pending', label: '1차 코멘트 대기', hint: '1차 평가자' },
  { key: 'commented', label: '본인 수정 대기', hint: '대상자' },
  { key: 'revised', label: '2차 검토 대기', hint: '2차 검토자' },
  { key: 'returned', label: '반려 · 재수정 대기', hint: '대상자' },
  { key: 'closed', label: '마감', hint: '완료' },
];

function StageCounts({ counts }: { counts: MidtermStageCounts }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {STAGE_TILES.map((tile) => (
          <div key={tile.key} className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-[11.5px] leading-4 text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-7 tabular-nums text-foreground">
              {counts[tile.key]}
            </p>
            <p className="text-[11px] leading-4 text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        전체 <span className="font-semibold tabular-nums text-foreground">{counts.total}</span>건 ·
        진행 중{' '}
        <span className="font-semibold tabular-nums text-foreground">{counts.unfinished}</span>건
        {counts.notOpened > 0 && (
          <>
            {' · 미개시 '}
            <span className="font-semibold tabular-nums text-foreground">{counts.notOpened}</span>건
          </>
        )}
      </p>
    </div>
  );
}
