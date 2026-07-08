'use client';

// 행 확장 패널 — image 12: 1차/2차/최종(그룹대표) 점수 + 평가의견(비고).
// 1·2차 평가자는 피평가자에 따라 다르다(직원=팀장·본부장 / 팀장=본부장·부그룹장 /
// 본부장=부그룹장) — 역할 고정 표기 금지.
import { fmtScore, STAGE_LABEL } from '@/lib/ui';
import type { SummaryRow } from '../hooks';

function num(v: number | null): string {
  return v == null ? '-' : fmtScore(v);
}

const STAGE_DEFS = [
  { key: 'stage1', label: STAGE_LABEL.d1 },
  { key: 'stage2', label: STAGE_LABEL.d2 },
  { key: 'stageFinal', label: STAGE_LABEL.d3 },
] as const;

export function SummaryRowExpand({ row, colSpan }: { row: SummaryRow; colSpan: number }) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="border-b border-border px-4 py-4">
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
          평가의견 표시는 준비 중이에요.
        </p>
      </td>
    </tr>
  );
}
