'use client';

// 확정 KPI 표 — 구성원 1행(KPI 전체 선택) + 펼치면 KPI별 선택. 연결 기록(평가 점수·중간점검)은 해제 영향 안내.
import { Fragment } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { kpiCategoryLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { UnlockKpi, UnlockUser } from '../api';

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

const lastConfirmed = (u: UnlockUser) =>
  u.kpis.reduce((m, k) => (k.confirmedAt > m ? k.confirmedAt : m), u.kpis[0]?.confirmedAt ?? '');

function LinkedBadges({ scores, checkIns }: { scores: number; checkIns: number }) {
  if (scores === 0 && checkIns === 0) return <span className="text-12 text-muted-foreground">없음</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {scores > 0 && <Badge variant="warning" size="xs">평가 점수 {scores}</Badge>}
      {checkIns > 0 && <Badge variant="info" size="xs">중간점검 {checkIns}</Badge>}
    </div>
  );
}

interface Props {
  users: UnlockUser[];
  selected: Set<string>;
  expanded: Set<string>;
  disabled: boolean;
  onToggleKpi: (id: string) => void;
  onToggleUser: (u: UnlockUser) => void;
  onToggleExpand: (userId: string) => void;
}

export function UnlockTable({ users, selected, expanded, disabled, onToggleKpi, onToggleUser, onToggleExpand }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow plain>
          <TableHead className="w-10" />
          <TableHead>구성원</TableHead>
          <TableHead>소속</TableHead>
          <TableHead className="w-32">확정 KPI</TableHead>
          <TableHead className="w-28">최종 결재일</TableHead>
          <TableHead className="w-44">연결 기록</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => {
          const picked = u.kpis.filter((k) => selected.has(k.id)).length;
          const state = picked === 0 ? false : picked === u.kpis.length ? true : 'indeterminate';
          const open = expanded.has(u.userId);
          const weight = u.kpis.reduce((s, k) => s + k.weight, 0);
          return (
            <Fragment key={u.userId}>
              <TableRow data-state={picked > 0 ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={state}
                    disabled={disabled}
                    aria-label={`${u.name} 확정 KPI 전체 선택`}
                    onCheckedChange={() => onToggleUser(u)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-13 font-semibold text-foreground">{u.name}</span>
                    {u.positionLabel && <span className="text-12 text-muted-foreground">{u.positionLabel}</span>}
                    {!u.isActive && <Badge variant="muted" size="xs">비활성</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-12 text-muted-foreground">{u.departmentName ?? '-'}</TableCell>
                <TableCell className="tabular-nums text-12 text-foreground">
                  {u.kpis.length}건 · {weight}%
                  {picked > 0 && picked < u.kpis.length && (
                    <span className="ml-1 text-primary">({picked} 선택)</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-12 text-muted-foreground">{fmtDate(lastConfirmed(u))}</TableCell>
                <TableCell>
                  <LinkedBadges
                    scores={u.kpis.reduce((s, k) => s + k.scoreCount, 0)}
                    checkIns={u.kpis.reduce((s, k) => s + k.checkInCount, 0)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost-muted"
                    size="icon-xs"
                    aria-expanded={open}
                    aria-label={open ? `${u.name} KPI 접기` : `${u.name} KPI 펼치기`}
                    onClick={() => onToggleExpand(u.userId)}
                  >
                    <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
              {open && u.kpis.map((k) => (
                <KpiRow key={k.id} kpi={k} checked={selected.has(k.id)} disabled={disabled} onToggle={() => onToggleKpi(k.id)} />
              ))}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

// 펼친 KPI 행 — 구성원 행과 구분되는 옅은 바탕(행 색은 TableRow 소유라 셀에 둔다).
const SUB = 'bg-muted/30';

function KpiRow({ kpi, checked, disabled, onToggle }: { kpi: UnlockKpi; checked: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <TableRow plain>
      <TableCell className={SUB} />
      <TableCell colSpan={2} className={SUB}>
        <Label className="cursor-pointer items-start font-normal">
          <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} aria-label={`${kpi.title} 선택`} />
          <span className="min-w-0">
            <span className="block text-12h text-foreground break-keep">{kpi.title}</span>
            <span className="text-11 text-muted-foreground">{kpiCategoryLabel[kpi.category]}</span>
          </span>
        </Label>
      </TableCell>
      <TableCell className={`${SUB} tabular-nums text-12 text-foreground`}>{kpi.weight}%</TableCell>
      <TableCell className={`${SUB} tabular-nums text-12 text-muted-foreground`}>{fmtDate(kpi.confirmedAt)}</TableCell>
      <TableCell className={SUB}>
        <LinkedBadges scores={kpi.scoreCount} checkIns={kpi.checkInCount} />
      </TableCell>
      <TableCell className={SUB} />
    </TableRow>
  );
}
