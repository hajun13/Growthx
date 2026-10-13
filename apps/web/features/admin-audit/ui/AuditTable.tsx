'use client';

// 감사 로그 표 — 시각·행위자·액션·대상·상세. 행 클릭으로 변경 내역 열기.
import { ChevronRight, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { auditActionText } from '@/lib/ui';
import type { AuditLog } from '@/lib/types';

export function AuditTable({
  logs,
  loading,
  hasFilter,
  entityText,
  timestamp,
  onSelect,
  onResetFilter,
}: {
  logs: AuditLog[];
  loading: boolean;
  hasFilter: boolean;
  entityText: (entity: string) => string;
  timestamp: (iso: string) => { time: string; date: string };
  onSelect: (log: AuditLog) => void;
  onResetFilter: () => void;
}) {
  return (
    <Table bare>
      <TableHeader>
        <TableRow plain>
          <TableHead sticky className="w-37.5 text-10 uppercase tracking-wider">시각</TableHead>
          <TableHead sticky className="w-27.5 text-10 uppercase tracking-wider">행위자</TableHead>
          <TableHead sticky className="text-10 uppercase tracking-wider">액션</TableHead>
          <TableHead sticky className="text-10 uppercase tracking-wider">대상</TableHead>
          <TableHead sticky className="w-22.5 text-10 uppercase tracking-wider">상세</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          [1, 2, 3, 4, 5, 6, 7].map((i) => (
            <TableRow key={i} plain>
              <TableCell><Skeleton className="h-5 w-28" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
              <TableCell><Skeleton className="h-5 w-36" /></TableCell>
              <TableCell><Skeleton className="h-5 w-32" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
            </TableRow>
          ))
        ) : logs.length === 0 ? (
          <TableRow plain>
            <TableCell colSpan={5} flush>
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Shield size={32} className="text-border" strokeWidth={1.5} aria-hidden />
                <p className="text-13 text-muted-foreground">
                  {hasFilter ? '해당 조건의 로그가 없어요.' : '아직 감사 로그가 없어요.'}
                </p>
                {hasFilter && (
                  <Button variant="ghost" size="sm" onClick={onResetFilter}>
                    필터 초기화
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          logs.map((log) => {
            const at = timestamp(log.at);
            return (
              <TableRow key={log.id} interactive onClick={() => onSelect(log)}>
                {/* 시각 */}
                <TableCell className="tabular-nums">
                  <div className="text-12 font-semibold text-foreground">{at.time}</div>
                  <div className="mt-0.5 text-10h text-muted-foreground">{at.date}</div>
                </TableCell>
                {/* 행위자 */}
                <TableCell className="text-12h font-semibold text-foreground">
                  {log.actorName ?? (
                    <span className="font-normal text-muted-foreground">시스템</span>
                  )}
                </TableCell>
                {/* 액션 */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="solid-dark" size="xs" className="shrink-0">
                      {entityText(log.entity)}
                    </Badge>
                    <span className="text-12 text-foreground">{auditActionText(log.action)}</span>
                  </div>
                </TableCell>
                {/* 대상 ID */}
                <TableCell className="text-11h text-muted-foreground">
                  {entityText(log.entity)} #{log.entityId.slice(0, 8)}
                </TableCell>
                {/* 상세 — 행 클릭으로 일원화(중복 '변경 보기' 버튼 제거), 열 수단은 chevron 시그널만. */}
                <TableCell>
                  <div className="flex justify-end pr-1">
                    <ChevronRight size={14} className="text-muted-foreground" aria-hidden />
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
