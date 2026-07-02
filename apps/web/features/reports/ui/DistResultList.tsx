'use client';

// 결과 테이블 — 2026-07-02 목업 정렬: 순위·대상자(아바타)·소속·직급·최종점수·등급·상세보기 컬럼
// + 하단 페이지네이션(중앙) + "N개씩 보기" 페이지 크기 선택(우측).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { GradeChip } from '@/components/GradeChip';
import { EmptyState } from '@/components/States';
import { Pagination } from '@/components/Pagination';
import { fmtScore, getPositionLabel } from '@/lib/ui';
import type { EvaluationResult, PositionDef } from '@/lib/types';

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

  if (results.length === 0) return <EmptyState title="표시할 결과가 없어요." />;

  return (
    <div className="flex flex-col">
      {/* 표 높이 상한 — 페이지 크기를 키워도 카드가 무한정 길어지지 않게 내부 스크롤(헤더 고정) */}
      <div className="max-h-[520px] overflow-y-auto">
      <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11.5px] font-semibold text-muted-foreground">순위</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11.5px] font-semibold text-muted-foreground">대상자</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11.5px] font-semibold text-muted-foreground">소속</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-left text-[11.5px] font-semibold text-muted-foreground">직급</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-center text-[11.5px] font-semibold text-muted-foreground">최종점수</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-center text-[11.5px] font-semibold text-muted-foreground">등급</th>
            <th className="sticky top-0 z-10 bg-muted px-3 py-2.5 text-center text-[11.5px] font-semibold text-muted-foreground">상세</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((r) => {
            const name = r.userName ?? r.userId.slice(0, 8);
            const go = () => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`);
            return (
              <tr
                key={r.id}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/60"
                onClick={go}
              >
                <td className="px-3 py-2.5 text-[13px] font-semibold tabular-nums text-muted-foreground">
                  {rankOf.get(r.id)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={name} size="xs" />
                    <span className="truncate text-[13px] font-semibold text-foreground">{name}</span>
                  </span>
                </td>
                <td className="truncate px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  {r.departmentName ?? '-'}
                </td>
                <td className="truncate px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  {r.position ? getPositionLabel(r.position, positions) : '-'}
                </td>
                <td className="px-3 py-2.5 text-center text-[14px] font-bold tabular-nums text-foreground">
                  {fmtScore(r.finalScore)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <GradeChip grade={r.finalGrade ?? null} size="sm" />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      go();
                    }}
                    className="inline-flex items-center gap-0.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold text-foreground transition hover:bg-muted"
                  >
                    상세보기
                    <ChevronRight size={11} aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {/* 하단 — 페이지네이션(중앙) + 페이지 크기(우측) */}
      <div className="relative flex min-h-[52px] items-center justify-center px-4 py-2.5">
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        <label className="absolute right-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="sr-only">페이지당 표시 수</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-9 rounded-[8px] border border-border bg-card px-2.5 text-[12.5px] text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}개씩 보기
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
