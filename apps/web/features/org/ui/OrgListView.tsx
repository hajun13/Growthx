'use client';

// 조직도 "목록" 뷰 — 그룹·본부 단위 인원 비교표.
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { OrgChartNode, OrgNodeType } from '@/lib/types';
import { OrgEmpty } from './OrgEmpty';

const TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

export function OrgListView({ chart }: { chart: OrgChartNode | null }) {
  const rows = useMemo(() => {
    const groups = chart?.children ?? [];
    return groups.flatMap((g) => {
      const divisions = g.children ?? [];
      if (divisions.length === 0) {
        return [{ id: g.id, dept: g.name, type: g.type, members: g.totalCount, indent: 0 }];
      }
      return [
        { id: g.id, dept: g.name, type: g.type, members: g.totalCount, indent: 0 },
        ...divisions.map((d) => ({
          id: d.id,
          dept: `└ ${d.name}`,
          type: d.type,
          members: d.totalCount,
          indent: 1,
        })),
      ];
    });
  }, [chart]);

  if (rows.length === 0) {
    return <OrgEmpty title="조직이 아직 없어요." />;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <Table>
          <TableHeader>
            <TableRow plain>
              {['조직', '유형', '인원'].map((h, i) => (
                <TableHead
                  key={h}
                  className={cn('text-11 font-bold tracking-wide uppercase', i === 0 && 'w-1/2')}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-primary">
                      <Users className="size-3.5 text-white" />
                    </div>
                    <span
                      className={cn(
                        'text-13 text-foreground',
                        d.indent === 0 ? 'font-bold' : 'pl-2 font-medium',
                      )}
                    >
                      {d.dept}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="rounded-sm border border-border bg-muted px-2 py-0.5 text-11 font-semibold text-primary">
                    {TYPE_LABEL[d.type]}
                  </span>
                </TableCell>
                <TableCell className="text-13 font-semibold text-foreground tabular-nums">
                  {d.members}명
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
