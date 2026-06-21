'use client';

// ④-5 RebaselineHistory — 재조정 이력 패널(조립).
// 데이터 = useRebaselineHistory(전용 엔드포인트, 사유·변경자·시각·diff 포함).
//   디자이너 가정(useKpiSnapshots + 메타 보강)과 달리 계약 §7 전용 엔드포인트를 쓴다.
// 단계 무관 항상 조회 가능(편집은 mid_review 만, 이력은 언제나).
import { useMemo } from 'react';
import { useRebaselineHistory } from '@/hooks/useMidterm';
import { Card } from '@/components/Card';
import { EmptyState, Skeleton } from '@/components/States';
import { RebaselineHistoryItem } from './RebaselineHistoryItem';
import { T } from '@/lib/palette';
import type { MeasureType, RebaselineHistoryEntry } from '@/lib/types';

export interface RebaselineHistoryProps {
  cycleId: string;
  userId: string | null; // 선택된 피평가자(없으면 안내)
  // KPI 별 측정방식(목표값 단위 표기용).
  measureTypeByKpiId?: Record<string, MeasureType>;
}

export function RebaselineHistory({
  cycleId,
  userId,
  measureTypeByKpiId,
}: RebaselineHistoryProps) {
  const { data, loading, error, reload } = useRebaselineHistory(
    { cycleId, evaluateeId: userId },
    { enabled: !!userId },
  );

  const entries: RebaselineHistoryEntry[] = useMemo(
    () => data?.data ?? [],
    [data],
  );

  return (
    <Card
      title="재조정 이력"
      action={
        userId && entries.length > 0 ? (
          <span style={{ fontSize: 12, color: T.grey600 }}>{entries.length}건</span>
        ) : undefined
      }
    >
      {!userId ? (
        <EmptyState
          title="구성원을 선택하면 이력이 보여요."
          description="재조정 이력은 피평가자별로 표시돼요."
        />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        // 백엔드 미배포/404 등 → 조용한 폴백(편집은 계속 가능).
        <p style={{ fontSize: 12.5, color: T.grey500 }} className="py-6 text-center">
          이력을 불러오지 못했어요.
          <button
            type="button"
            onClick={reload}
            className="ml-2 underline"
            style={{ color: T.blue500, fontWeight: 600 }}
          >
            다시 시도
          </button>
        </p>
      ) : entries.length === 0 ? (
        <EmptyState title="아직 재조정 이력이 없어요." />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <RebaselineHistoryItem
              key={entry.snapshotId}
              entry={entry}
              defaultOpen={i === 0}
              measureTypeByKpiId={measureTypeByKpiId}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
