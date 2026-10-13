'use client';

// 결과 테이블 — 2026-07-02 목업 정렬: 순위·대상자(아바타)·소속·직급·최종점수·등급·상세보기 컬럼
// + 하단 페이지네이션(중앙) + "N개씩 보기" 페이지 크기 선택(우측).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtScore, getPositionLabel } from '@/lib/ui';
import type { EvaluationResult, PositionDef } from '@/lib/types';
import { PersonAvatar } from './PersonAvatar';
import { ReportEmpty } from './ReportStates';
import { ResultPagination } from './ResultPagination';

const PAGE_SIZES = [10, 20, 50] as const;

export function DistResultList({
  results,
  cycleId,
  positions = [],
}: {
  results: EvaluationResult[];
  cycleId?: string;
  positions?: PositionDef[];
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // 순위 = 최종점수 내림차순 고정(이름순 정렬로 바꿔도 순위는 유지).
  const rankOf = useMemo(() => {
    const ranked = [...results].sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
    const m = new Map<string, number>();
    ranked.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [results]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = results.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (results.length === 0) return <ReportEmpty title="표시할 결과가 없어요." />;

  return (
    <div className="flex flex-col">
      {/* 표 높이 상한 — 페이지 크기를 키워도 카드가 무한정 길어지지 않게 내부 스크롤(헤더 고정) */}
      <div className="max-h-130 overflow-y-auto">
        <Table bare className="table-fixed">
          <TableHeader>
            <TableRow plain>
              <TableHead sticky className="w-7/100 text-11h">순위</TableHead>
              <TableHead sticky className="w-11/50 text-11h">대상자</TableHead>
              <TableHead sticky className="w-21/100 text-11h">소속</TableHead>
              <TableHead sticky className="w-3/25 text-11h">직급</TableHead>
              <TableHead sticky textAlign="center" className="w-7/50 text-11h">최종점수</TableHead>
              <TableHead sticky textAlign="center" className="w-1/10 text-11h">등급</TableHead>
              <TableHead sticky textAlign="center" className="w-7/50 text-11h">상세</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((r) => {
              const name = r.userName ?? r.userId.slice(0, 8);
              const go = () => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`);
              return (
                <TableRow key={r.id} interactive onClick={go}>
                  <TableCell className="text-13 font-semibold tabular-nums text-muted-foreground">
                    {rankOf.get(r.id)}
                  </TableCell>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-2">
                      <PersonAvatar name={name} size="xs" />
                      <span className="truncate text-13 font-semibold text-foreground">{name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="truncate text-12h text-muted-foreground">
                    {r.departmentName ?? '-'}
                  </TableCell>
                  <TableCell className="truncate text-12h text-muted-foreground">
                    {r.position ? getPositionLabel(r.position, positions) : '-'}
                  </TableCell>
                  <TableCell textAlign="center" className="text-14 font-bold tabular-nums text-foreground">
                    {fmtScore(r.finalScore)}
                  </TableCell>
                  <TableCell textAlign="center">
                    <GradeChip grade={r.finalGrade ?? null} size="sm" />
                  </TableCell>
                  <TableCell textAlign="center">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        go();
                      }}
                    >
                      상세보기
                      <ChevronRight aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 하단 — 페이지네이션(중앙) + 페이지 크기(우측) */}
      <div className="relative flex min-h-13 items-center justify-center px-4 py-2.5">
        <ResultPagination page={safePage} totalPages={totalPages} onChange={setPage} />
        <div className="absolute right-4 flex items-center gap-1.5 text-12 text-muted-foreground">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="페이지당 표시 수" size="sm" className="w-32 text-12h">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}개씩 보기
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
