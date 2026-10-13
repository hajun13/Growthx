'use client';

// 그룹별 적용 상태 표 — 월별 실적 저장 여부·등급풀 적용 여부·다음 행동.
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtPercent, tierLabel } from '@/lib/ui';
import type { GradePool } from '@/lib/types';
import type { GroupPerformance } from '../api';

export interface GroupStatusRow {
  group: { id: string; name: string };
  performance: GroupPerformance | null;
  pool: GradePool | null;
}

export function GroupStatusTable({ rows }: { rows: GroupStatusRow[] }) {
  return (
    <div className="overflow-x-auto border border-border">
      <Table className="min-w-190 border-collapse">
        <TableHeader>
          <TableRow plain>
            <TableHead className="text-11 uppercase">그룹</TableHead>
            <TableHead className="text-11 uppercase">월별 실적</TableHead>
            <TableHead textAlign="right" className="text-11 uppercase">달성률</TableHead>
            <TableHead className="text-11 uppercase">등급풀</TableHead>
            <TableHead textAlign="right" className="text-11 uppercase">모수</TableHead>
            <TableHead className="text-11 uppercase">다음 행동</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ group, performance, pool }) => {
            const needsRefresh = !!performance && !!pool && performance.tier !== pool.tier;
            return (
              <TableRow key={group.id} plain>
                <TableCell className="text-12h font-semibold text-foreground">{group.name}</TableCell>
                <TableCell className="text-12h text-muted-foreground">{performance ? '저장됨' : '미입력'}</TableCell>
                <TableCell textAlign="right" className="text-12h tabular-nums text-foreground">
                  {performance ? fmtPercent(performance.achievementRate) : '—'}
                </TableCell>
                <TableCell className="text-12h text-muted-foreground">
                  {!pool
                    ? '미적용'
                    : needsRefresh
                      ? `${tierLabel[pool.tier]} 기준 적용 · 재적용 필요`
                      : `${tierLabel[pool.tier]} 기준 적용`}
                </TableCell>
                <TableCell textAlign="right" className="text-12h tabular-nums text-muted-foreground">
                  {pool ? `${pool.headcount}명` : '—'}
                </TableCell>
                <TableCell className="text-12h text-muted-foreground">
                  {!performance ? '월별 실적 입력' : !pool || needsRefresh ? '자동 적용 실행' : '상한 검토'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
