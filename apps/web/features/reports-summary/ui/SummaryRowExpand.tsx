'use client';

// 행 확장 패널 — image 12: 1차(팀장)/2차(본부장)/최종(그룹대표) 점수 + 평가의견(비고).
import { fmtScore } from '@/lib/ui';
import type { SummaryRow } from '../hooks';

function num(v: number | null): string {
  return v == null ? '-' : fmtScore(v);
}

const STAGE_DEFS = [
  { key: 'stage1', label: '1차 평가 (팀장)' },
  { key: 'stage2', label: '2차 평가 (본부장)' },
  { key: 'stageFinal', label: '최종 평가 (그룹대표)' },
] as const;

export function SummaryRowExpand({ row }: { row: SummaryRow }) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={13} className="border-b border-border px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STAGE_DEFS.map((s) => {
            const stage = row[s.key];
            return (
              <div key={s.key} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-[11px] font-semibold text-muted-foreground">{s.label}</div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">실적</span>
                  <span className="font-bold tabular-nums text-foreground">{num(stage.perf)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">역량(참고)</span>
                  <span className="font-bold tabular-nums text-foreground">{num(stage.comp)}</span>
                </div>
              </div>
            );
          })}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 text-[11px] font-semibold text-muted-foreground">환산 결과</div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">평가합산(실적)</span>
              <span className="font-bold tabular-nums text-foreground">{num(row.sum.perf)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">최종 환산점수</span>
              <span className="font-bold tabular-nums text-primary">{num(row.finalScore)}</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          평가의견은 아직 별도 필드로 제공되지 않아요(API 갭 — 단계별 코멘트 필드 없음).
        </p>
      </td>
    </tr>
  );
}
