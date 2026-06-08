'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useResultDetail } from '@/hooks/useResults';
import { useMidtermProgress, useMidtermReviews, useActionItems } from '@/hooks/useMidterm';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ComparisonBar, type ComparisonRow } from '@/components/ComparisonBar';
import { EvaluatorFlow, type EvaluatorStep } from '@/components/EvaluatorFlow';
import { EvalReport } from '@/components/EvalReport';
import { MidtermResultSummary } from '@/components/MidtermResultSummary';
import { MidtermActionPanel } from '@/components/MidtermActionPanel';
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

// byType(self/downward1/2/3) → ComparisonBar 행. (live shape 전용)
// 다단계: 본인(참고) + 1차 팀장 + 2차 본부장 + 최종 그룹대표 중 점수가 있는 단계만.
function toRows(detail: EvaluationResultDetail): ComparisonRow[] {
  const bt = detail.byType;
  if (!bt) return [];
  const rows: ComparisonRow[] = [];
  if (bt.self?.score != null)
    rows.push({ type: 'self', label: '본인평가', score: bt.self.score, grade: bt.self.grade });
  const downs: { round: 1 | 2 | 3; label: string; e?: { score: number | null; grade: import('@/lib/types').Grade | null } }[] = [
    { round: 1, label: '1차 (팀장)', e: bt.downward1 },
    { round: 2, label: '2차 (본부장)', e: bt.downward2 },
    { round: 3, label: '최종 (그룹대표)', e: bt.downward3 },
  ];
  for (const d of downs) {
    if (d.e?.score != null)
      rows.push({ type: 'downward', round: d.round, label: d.label, score: d.e.score, grade: d.e.grade });
  }
  return rows;
}

// byType → 평가자 플로우(본인 → 1차 → 2차 → 최종). (live shape 전용)
function toFlow(detail: EvaluationResultDetail): EvaluatorStep[] {
  const bt = detail.byType;
  return [
    { key: 'self', label: '본인평가', sublabel: '본인 · 참고용', score: bt?.self?.score ?? null, grade: bt?.self?.grade ?? null },
    { key: 'downward1', label: '1차 평가', sublabel: '팀장', score: bt?.downward1?.score ?? null, grade: bt?.downward1?.grade ?? null },
    { key: 'downward2', label: '2차 평가', sublabel: '본부장', score: bt?.downward2?.score ?? null, grade: bt?.downward2?.grade ?? null },
    { key: 'downward3', label: '최종 평가', sublabel: '그룹대표', score: bt?.downward3?.score ?? null, grade: bt?.downward3?.grade ?? null },
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
  const [showReport, setShowReport] = useState(false);

  const cycleId = searchParams.get('cycleId') ?? current?.id ?? null;

  // 보고 있는 주기의 상태(목록에서 조회). mid_review 면 등급/보상 수치 fetch 자체를 막는다(게이팅 회피).
  const viewedCycle = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? null,
    [cycles, cycleId],
  );
  const isMidReview = viewedCycle?.status === 'mid_review';
  const isFinalStage =
    viewedCycle?.status === 'calibration' || viewedCycle?.status === 'closed';

  // mid_review 면 결과 상세는 호출하지 않는다(cycleId=null 로 비활성).
  const { data, loading, error, reload } = useResultDetail(
    userId,
    isMidReview ? null : cycleId,
  );

  // 블록① — mid_review 진척 요약용(본인/부서장/HR 가시 범위는 백엔드가 검증).
  const { data: midProgress, loading: midProgressLoading } = useMidtermProgress(
    { cycleId, userId },
    { enabled: !!cycleId && isMidReview },
  );
  const { data: midReviews } = useMidtermReviews(
    { cycleId, evaluateeId: userId },
    { enabled: !!cycleId && isMidReview },
  );

  // 블록③ — 최종(calibration/closed) 단계 보완 조치 이행 패널.
  const { data: actionData } = useActionItems(
    { cycleId, evaluateeId: userId },
    { enabled: !!cycleId && isFinalStage },
  );

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

  // ── 블록① mid_review 분기: 등급/보상 숨기고 진척 요약으로 대체 ──
  if (isMidReview) {
    const midReview = midReviews?.data.find((r) => r.evaluateeId === userId) ?? null;
    return (
      <PageContainer>
        <PageHeader
          title="평가 상세결과"
          cycles={cycles}
          selectedId={selectedId}
          onSelectCycle={setSelectedId}
        />
        {midProgressLoading ? (
          <ResultSkeleton />
        ) : (
          <MidtermResultSummary
            userName={displayName}
            departmentName={displayDept}
            progress={midProgress?.kpis ?? []}
            review={midReview}
          />
        )}
      </PageContainer>
    );
  }

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
  // 코멘트는 live shape 에만 존재(import 결과는 평가자 코멘트 없음). 단계별 — 최종 우선 노출.
  const commentSource: { label: string; content: string | null; strong: boolean }[] = isImport
    ? []
    : [
        { label: '최종 평가 (그룹대표)', content: bt?.downward3?.comment ?? null, strong: true },
        { label: '2차 평가 (본부장)', content: bt?.downward2?.comment ?? null, strong: false },
        { label: '1차 평가 (팀장)', content: bt?.downward1?.comment ?? null, strong: false },
      ];
  const comments = commentSource.filter(
    (c): c is { label: string; content: string; strong: boolean } => !!c.content,
  );
  const compScore = isImport ? null : bt?.compScore ?? null;
  const stageMode = isImport ? undefined : bt?.stageMode;
  const stageModeText =
    stageMode === 'exception1'
      ? '예외 ① 1차 평가자 = 최종평가자 → 1차 100% 반영'
      : stageMode === 'exception2'
        ? '예외 ② 2차 평가자 = 최종평가자 → 1차 70% + 최종 30% 반영'
        : '정상 가중 · 1차 50% + 2차 30% + 최종 20%';

  return (
    <PageContainer>
      <PageHeader
        title="평가 상세결과"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-2">
            {!isImport && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FileText className="h-4 w-4" aria-hidden />}
                onClick={() => setShowReport(true)}
              >
                평가표 인쇄
              </Button>
            )}
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
          1차(팀장)·2차(본부장)·최종(그룹대표) 단계별 실적 점수를 전사 평균과 함께 볼 수 있어요.
          종합 등급은 <strong>실적(KPI) 100% 기준</strong>이며, 역량평가는 참고용으로 등급에 반영되지 않아요.
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
          <Card title="평가자 플로우 (본인 → 1차 팀장 → 2차 본부장 → 최종 그룹대표)">
            <EvaluatorFlow steps={flow} />
            {/* 합산 방식 / 예외 안내 */}
            <div
              className={
                'mt-4 flex items-center gap-2 border px-3 py-2 text-xs ' +
                (stageMode && stageMode !== 'normal'
                  ? 'border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]'
                  : 'border-border bg-muted/40 text-muted-foreground')
              }
            >
              <span
                className={
                  'px-1.5 py-0.5 text-[10px] font-bold text-white ' +
                  (stageMode && stageMode !== 'normal' ? 'bg-[#ea580c]' : 'bg-muted-foreground')
                }
              >
                합산 방식
              </span>
              {stageModeText}
            </div>
          </Card>

          <Card title="단계별 점수 비교">
            {rows.length === 0 ? (
              <EmptyState title="비교할 평가 데이터가 없어요." />
            ) : (
              <ComparisonBar rows={rows} companyAvg={data.companyAvg} />
            )}
          </Card>

          {/* 역량평가(참고용 · 등급 미반영) */}
          <Card title="역량평가 (참고용)">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-xl text-sm text-muted-foreground">
                역량 점수는 조직 역량 추이를 보기 위한 <strong className="text-foreground">참고 자료</strong>예요.
                최종 등급·연봉에는 반영되지 않습니다.
              </p>
              <div className="text-center">
                <p className="text-2xl font-extrabold tabular-nums text-foreground">
                  {compScore !== null ? fmtScore(compScore) : '미실시'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">역량 환산점수</p>
              </div>
            </div>
          </Card>

          <Card title="평가 코멘트">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                아직 코멘트가 없어요.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li
                    key={c.label}
                    className={
                      'border-l-[3px] py-1 pl-3 ' +
                      (c.strong ? 'border-primary' : 'border-border')
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {c.label}
                      </span>
                      {c.strong && (
                        <span className="bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          최종
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-base text-foreground">
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* 블록③ — 최종(calibration/closed) 단계 중간 보완 조치 이행 현황(참고용·등급 미반영). */}
      {isFinalStage && (
        <MidtermActionPanel items={actionData?.data ?? []} showWhenEmpty={isOwn} />
      )}

      {/* 평가표 인쇄(화면과 동일하게 출력) */}
      {showReport && (
        <EvalReport
          data={{
            name: displayName,
            dept: displayDept,
            title: isOwn && user ? positionLabel[user.position] : '',
            finalGrade: data.finalGrade,
            finalScore: data.finalScore,
            percentile: data.percentile,
            companyAvg: data.companyAvg,
            byType: data.byType,
            byGroup: data.byGroup,
            cycleName: viewedCycle?.name ?? current?.name,
          }}
          onClose={() => setShowReport(false)}
        />
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
