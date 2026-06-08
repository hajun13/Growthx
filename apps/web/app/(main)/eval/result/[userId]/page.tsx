'use client';

import { Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useResultDetail } from '@/hooks/useResults';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Breadcrumb } from '@/components/Breadcrumb';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ComparisonBar, type ComparisonRow } from '@/components/ComparisonBar';
import { EvaluatorFlow, type EvaluatorStep } from '@/components/EvaluatorFlow';
import { ResultExportButton } from '@/components/ResultExportButton';
import { ApiError } from '@/lib/api';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { fmtScore, positionLabel } from '@/lib/ui';
import {
  isImportByType,
  type EvaluationResultDetail,
  type ImportRoundShape,
} from '@/lib/types';

// byType(self/downward1/downward2) → ComparisonBar 행. (live shape 전용)
// 단일 캐스케이드: 부서장 평가는 직속 1명만. 데이터 키 downward1/2 중 채워진 쪽을 단일 행으로.
function toRows(detail: EvaluationResultDetail): ComparisonRow[] {
  const bt = detail.byType;
  if (!bt) return [];
  const rows: ComparisonRow[] = [];
  if (bt.self?.score != null)
    rows.push({
      type: 'self',
      label: '본인평가',
      score: bt.self.score,
      grade: bt.self.grade,
    });
  const dw = bt.downward1 ?? bt.downward2 ?? null;
  if (dw?.score != null)
    rows.push({
      type: 'downward',
      round: 1,
      label: '부서장 평가',
      score: dw.score,
      grade: dw.grade,
    });
  return rows;
}

// byType → 평가자 플로우(self → 부서장 평가, 단일). (live shape 전용)
function toFlow(detail: EvaluationResultDetail): EvaluatorStep[] {
  const bt = detail.byType;
  const dw = bt?.downward1 ?? bt?.downward2 ?? null;
  return [
    {
      key: 'self',
      label: '본인평가',
      sublabel: '본인',
      score: bt?.self?.score ?? null,
      grade: bt?.self?.grade ?? null,
    },
    {
      key: 'downward1',
      label: '부서장 평가',
      sublabel: '직속 부서장',
      score: dw?.score ?? null,
      grade: dw?.grade ?? null,
    },
  ];
}

// 임포트 결과(2025 등 과거)의 라운드 요약 행 — 1차/2차/최종 × 실적·역량(참고).
interface ImportRoundRow {
  label: string;
  perf: number | null;
  comp: number | null;
}
function toImportRows(detail: EvaluationResultDetail): ImportRoundRow[] {
  const bt = detail.byType;
  if (!bt) return [];
  const mk = (label: string, r: ImportRoundShape | null | undefined) => ({
    label,
    perf: r?.perf ?? null,
    comp: r?.comp ?? null,
  });
  return [
    mk('1차', bt.round1),
    mk('2차', bt.round2),
    mk('최종', bt.final),
  ];
}

export default function ResultDetailPage() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <ResultDetailInner />
    </Suspense>
  );
}

function ResultDetailInner() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params.userId;
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId } = useCurrentCycle();

  const cycleId = searchParams.get('cycleId') ?? current?.id ?? null;

  const { data, loading, error, reload } = useResultDetail(userId, cycleId);
  const isImport = useMemo(() => isImportByType(data?.byType), [data]);
  const rows = useMemo(() => (data && !isImport ? toRows(data) : []), [data, isImport]);
  const flow = useMemo(() => (data && !isImport ? toFlow(data) : []), [data, isImport]);
  const importRows = useMemo(
    () => (data && isImport ? toImportRows(data) : []),
    [data, isImport],
  );

  // B-3c: 결과 응답의 비정규화 이름 우선, 본인이면 인증 정보로 보강.
  const isOwn = !!user && user.id === userId;
  const displayName =
    data?.userName ?? (isOwn ? user!.name : '평가 대상자');
  const displayDept =
    data?.departmentName ?? (isOwn ? positionLabel[user!.position] : '평가 결과');

  if (loading) return <ResultSkeleton />;
  if (error) {
    if (error instanceof ApiError && error.isForbidden) {
      return <Forbidden message="이 결과를 볼 권한이 없어요." />;
    }
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          title="결과는 캘리브레이션 완료 후 공개돼요."
          description="아직 확정된 평가 결과가 없어요."
        />
      );
    }
    return <ErrorState onRetry={reload} />;
  }
  if (!data) return <EmptyState title="표시할 평가 결과가 없어요." />;

  const bt = data.byType;
  // 코멘트는 live shape 에만 존재(import 결과는 평가자 코멘트 없음).
  const downwardComment = isImport
    ? null
    : bt?.downward1?.comment ?? bt?.downward2?.comment ?? null;
  const comments = downwardComment
    ? [{ label: '부서장', content: downwardComment }]
    : [];

  return (
    <PageContainer>
      <Breadcrumb
        backHref="/eval"
        items={[
          { label: '평가결과', href: '/eval/result' },
          { label: '평가 상세결과' },
        ]}
      />

      <PageHeader
        title="평가 상세결과"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-2">
            <ResultExportButton userId={userId} cycleId={cycleId} />
            {data.finalGrade !== null && (
              <Link href={`/appeals?resultId=${data.id}`}>
                <Button variant="secondary" size="sm">
                  이의제기
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {isImport ? (
        <InfoBanner tone="info" title="임포트된 과거 결과예요">
          이 결과는 과거(2025 등) 평가 데이터를 가져온 것이라 본인·부서장 평가자별
          분해 대신 1차/2차/최종 라운드 요약으로 표시돼요. 역량 점수는 참고용이에요.
        </InfoBanner>
      ) : (
        <InfoBanner tone="success" title="결과 보는 법">
          본인평가와 부서장 평가 점수를 전사 평균과 함께 비교할 수 있어요.
          종합 등급은 캘리브레이션 결과를 반영한 최종 등급이에요.
        </InfoBanner>
      )}

      {/* 다크 요약 카드: 이름/소속 + 종합 등급 박스 + 점수 */}
      <div className="summary-dark overflow-hidden shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center bg-white/10 text-xl font-bold text-white"
            >
              {displayName.slice(0, 1)}
            </span>
            <div>
              <p className="text-lg font-bold text-white">{displayName}</p>
              <p className="text-sm font-medium text-white/70">{displayDept}</p>
            </div>
          </div>

          {/* B-3d: 종합 + 그룹별(성과중심/협업·성장) 등급 박스. */}
          <div className="flex flex-wrap items-stretch gap-3">
            <SummaryGradeBox
              label="종합"
              grade={data.finalGrade}
              score={data.finalScore}
              highlight
            />
            <SummaryGradeBox
              label="성과중심"
              grade={data.byGroup?.performance_core.grade ?? null}
              score={data.byGroup?.performance_core.score ?? null}
            />
            <SummaryGradeBox
              label="협업·성장"
              grade={data.byGroup?.collaboration_growth.grade ?? null}
              score={data.byGroup?.collaboration_growth.score ?? null}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/10 px-6 py-3 text-sm text-white/80">
          {data.finalGrade === null ? (
            <span>아직 집계 전이에요. 캘리브레이션 완료 후 공개돼요.</span>
          ) : (
            <>
              {data.percentile !== null && (
                <span>
                  전사 상위{' '}
                  <span className="font-bold text-white tabular-nums">
                    {data.percentile}%
                  </span>
                </span>
              )}
              <span>
                전사 평균{' '}
                <span className="font-bold text-white tabular-nums">
                  {fmtScore(data.companyAvg)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {isImport ? (
        <Card title="라운드별 요약 (1차 / 2차 / 최종)">
          {importRows.every((r) => r.perf === null && r.comp === null) ? (
            <EmptyState title="표시할 라운드 데이터가 없어요." />
          ) : (
            <ImportRoundTable rows={importRows} />
          )}
        </Card>
      ) : (
        <>
          <Card title="평가자 플로우 (본인평가 → 부서장 평가)">
            <EvaluatorFlow steps={flow} />
          </Card>

          <Card title="유형별 점수 비교 (본인 / 부서장)">
            {rows.length === 0 ? (
              <EmptyState title="비교할 평가 데이터가 없어요." />
            ) : (
              <ComparisonBar rows={rows} companyAvg={data.companyAvg} />
            )}
          </Card>

          <Card title="평가 코멘트">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                아직 코멘트가 없어요.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li key={c.label} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center bg-secondary text-sm font-semibold text-foreground"
                    >
                      {c.label.slice(0, 1)}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-foreground">
                        {c.label}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap text-base text-foreground">
                        {c.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </PageContainer>
  );
}

// 다크 요약 카드 안의 등급 박스(종합/단계별).
function SummaryGradeBox({
  label,
  grade,
  score,
  highlight,
}: {
  label: string;
  grade: import('@/lib/types').Grade | null;
  score: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        'flex min-w-[96px] flex-col items-center justify-center gap-1 px-4 py-3 ' +
        (highlight
          ? 'bg-white text-[#1b2330]'
          : 'bg-white/10 text-white ring-1 ring-white/15')
      }
    >
      <span
        className={
          'text-xs font-semibold ' +
          (highlight ? 'text-[#4E5968]' : 'text-white/70')
        }
      >
        {label}
      </span>
      <span className="text-2xl font-extrabold tabular-nums leading-none">
        {grade ?? '–'}
      </span>
      <span
        className={
          'text-xs font-semibold tabular-nums ' +
          (highlight ? 'text-[#4E5968]' : 'text-white/70')
        }
      >
        {score !== null ? fmtScore(score) : '집계 전'}
      </span>
    </div>
  );
}

// 임포트 결과 라운드 요약 표 — 1차/2차/최종 × 실적·역량(참고).
function ImportRoundTable({ rows }: { rows: ImportRoundRow[] }) {
  return (
    <div className="overflow-hidden border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary/50 text-left text-xs font-semibold text-muted-foreground">
            <th className="px-4 py-2.5">라운드</th>
            <th className="px-4 py-2.5 text-right">실적</th>
            <th className="px-4 py-2.5 text-right">역량 (참고)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-4 py-2.5 font-semibold text-foreground">
                {r.label}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {r.perf !== null ? fmtScore(r.perf) : '–'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.comp !== null ? fmtScore(r.comp) : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
