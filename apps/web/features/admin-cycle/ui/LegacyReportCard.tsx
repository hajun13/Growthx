'use client';

// 과거결과 임포트 리포트 카드
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { LegacyImportReport } from '@/lib/types';

interface Props {
  report: LegacyImportReport;
  cycleName?: string;
}

type Tone = 'ok' | 'warn' | 'err' | undefined;
const toneCls: Record<NonNullable<Tone>, string> = {
  ok: 'text-success-700',
  warn: 'text-warning-700',
  err: 'text-destructive',
};

export function LegacyReportCard({ report, cycleName }: Props) {
  const summary: { label: string; value: number; tone?: Tone }[] = [
    { label: '적재(imported)',              value: report.imported,              tone: 'ok' },
    { label: '재직 매칭(matched)',          value: report.matched },
    { label: '퇴사자 생성(createdResigned)', value: report.createdResigned },
    { label: '법인 갱신(legalEntityUpdated)', value: report.legalEntityUpdated },
    { label: '검토 필요(reviewQueue)',      value: report.reviewQueue,           tone: report.reviewQueue > 0 ? 'warn' : undefined },
    { label: '오류행(errors)',              value: report.errors.length,         tone: report.errors.length > 0 ? 'err' : undefined },
  ];

  return (
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">
            {`임포트 리포트 — ${cycleName ?? '대상 주기'} (총 ${report.total}행)`}
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">
        {/* 결과 상태 배지 */}
        <div className="mb-4">
          <Badge
            variant={report.ok ? 'success' : 'warning'}
          >
            {report.ok ? '전건 정상 적재' : '부분 적재 — 확인 필요'}
          </Badge>
        </div>

        {/* 요약 수치 그리드 */}
        <div className="grid grid-cols-3 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border">
          {summary.map((s) => (
            <div key={s.label} className="px-4 py-3">
              <div className="text-10 font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className={`tabular-nums text-22 font-extrabold leading-tight mt-1 ${s.tone ? toneCls[s.tone] : 'text-foreground'}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* 검토큐 */}
        {report.review.length > 0 && (
          <details className="mt-4 overflow-hidden rounded-lg border border-border">
            <summary className="cursor-pointer bg-warning-50 px-4 py-2.5 text-12h font-semibold text-warning-700">
              검토 필요 {report.review.length}행 펼쳐보기
            </summary>
            <div className="max-h-55 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead sticky textAlign="right" className="w-14">행</TableHead>
                    <TableHead sticky className="w-28">성명</TableHead>
                    <TableHead sticky>사유</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.review.map((r, i) => (
                    <TableRow key={`${r.row}-${i}`}>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.row}</TableCell>
                      <TableCell className="font-semibold">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}

        {/* 오류행 */}
        {report.errors.length > 0 && (
          <details className="mt-3 overflow-hidden rounded-lg border border-border">
            <summary className="cursor-pointer bg-danger-50 px-4 py-2.5 text-12h font-semibold text-danger-700">
              오류 {report.errors.length}행 펼쳐보기 (적재 제외)
            </summary>
            <div className="max-h-55 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead sticky textAlign="right" className="w-14">행</TableHead>
                    <TableHead sticky>오류 메시지</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.errors.map((e, i) => (
                    <TableRow key={`${e.row}-${i}`}>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{e.row}</TableCell>
                      <TableCell className="text-muted-foreground">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}

        {/* 푸터 */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-muted px-4 py-3">
          <p className="min-w-50 flex-1 text-11h text-muted-foreground">
            재실행해도 안전해요 — 같은 행은 (사용자·주기)로 갱신되어 중복 적재되지 않아요.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
