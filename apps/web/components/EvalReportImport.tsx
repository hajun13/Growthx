// EvalReport — 임포트(과거) 결과 본문: 1차/2차/최종 × 실적·역량(참고).
import { ChevronRight } from 'lucide-react';
import type { EvaluationByType } from '@/lib/types';
import { fmtScore } from '@/lib/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SectionTitle } from './EvalReportParts';

export function ImportBody({ bt }: { bt: EvaluationByType | null }) {
  const rows = [
    { label: '1차', r: bt?.round1 },
    { label: '2차', r: bt?.round2 },
    { label: '최종', r: bt?.final },
  ];
  return (
    <>
      <div className="border-b border-border px-7 py-5">
        <SectionTitle hint="과거(임포트) 결과 · 라운드별 실적/역량 요약">라운드별 요약</SectionTitle>
        <Table>
          <TableHeader>
            <TableRow plain>
              <TableHead>라운드</TableHead>
              <TableHead textAlign="right">실적</TableHead>
              <TableHead textAlign="right">역량 (참고)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label} plain>
                <TableCell className="text-12h font-semibold text-foreground">{row.label}</TableCell>
                <TableCell textAlign="right" className="text-12h text-foreground tabular-nums">
                  {row.r?.perf != null ? fmtScore(row.r.perf) : '–'}
                </TableCell>
                <TableCell textAlign="right" className="text-12h text-muted-foreground tabular-nums">
                  {row.r?.comp != null ? fmtScore(row.r.comp) : '–'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-7 pt-4 pb-6">
        <div className="flex items-center gap-1.75 rounded-md border border-dashed border-neutral-500 bg-neutral-50 px-4 py-3 text-11h text-neutral-800">
          <ChevronRight size={13} className="text-muted-foreground" />
          과거(임포트) 결과는 평가자별 코멘트 대신 라운드별 실적·역량 요약으로 표시돼요. 역량 점수는 참고용이에요.
        </div>
      </div>
    </>
  );
}
