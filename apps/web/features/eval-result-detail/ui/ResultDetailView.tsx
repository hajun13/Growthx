'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import { useMidtermProgress, useMidtermReviews, useActionItems } from '@/hooks/useMidterm';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { GradeChip } from '@/components/GradeChip';
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
import { fmtScore, getPositionLabel, STAGE_LABEL } from '@/lib/ui';
import { getButtonClasses } from '@energyx/ui';
import { cn } from '@/lib/utils';
import {
  isImportByType,
  type EvaluationResultDetail,
  type ImportRoundShape,
} from '@/lib/types';
import { useResultDetailData } from '../hooks';

// byType(self/downward1/2/3) → ComparisonBar 행. (live shape 전용)
// 다단계: 본인(참고) + 1차 + 2차 + 최종(그룹대표) 중 점수가 있는 단계만.
// 1·2차 평가자는 피평가자에 따라 다르다(직원=팀장·본부장 / 팀장=본부장·부그룹장 /
// 본부장=부그룹장) — 역할 고정 표기 금지.
function toRows(detail: EvaluationResultDetail): ComparisonRow[] {
  const bt = detail.byType;
  if (!bt) return [];
  const rows: ComparisonRow[] = [];
  if (bt.self?.score != null)
    rows.push({ type: 'self', label: STAGE_LABEL.self, score: bt.self.score, grade: bt.self.grade });
  const downs: { round: 1 | 2 | 3; label: string; e?: { score: number | null; grade: import('@/lib/types').Grade | null } }[] = [
    { round: 1, label: '1차', e: bt.downward1 },
    { round: 2, label: '2차', e: bt.downward2 },
    { round: 3, label: STAGE_LABEL.d3, e: bt.downward3 },
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
    { key: 'self', label: STAGE_LABEL.self, sublabel: '본인 · 참고용', score: bt?.self?.score ?? null, grade: bt?.self?.grade ?? null },
    { key: 'downward1', label: STAGE_LABEL.d1, sublabel: '상급 부서장', score: bt?.downward1?.score ?? null, grade: bt?.downward1?.grade ?? null },
    { key: 'downward2', label: STAGE_LABEL.d2, sublabel: '상급 부서장', score: bt?.downward2?.score ?? null, grade: bt?.downward2?.grade ?? null },
    { key: 'downward3', label: STAGE_LABEL.d3, sublabel: '그룹대표', score: bt?.downward3?.score ?? null, grade: bt?.downward3?.grade ?? null },
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

export function ResultDetailView() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <ResultDetailInner />
    </Suspense>
  );
}

function ResultDetailInner() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const [showReport, setShowReport] = useState(false);

  const cycleId = current?.id ?? null;

  // 보고 있는 주기의 상태(목록에서 조회). mid_review 면 등급/보상 수치 fetch 자체를 막는다(게이팅 회피).
  const viewedCycle = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? null,
    [cycles, cycleId],
  );
  const isMidReview = viewedCycle?.status === 'mid_review';
  const isFinalStage =
    viewedCycle?.status === 'calibration' || viewedCycle?.status === 'closed';
  const isClosed = viewedCycle?.status === 'closed';

  // 결과 공개 화이트리스트 — calibration(조정 업무·잠정 배너 동반)/closed(확정)에서만 결과를 fetch·렌더.
  // draft/active/mid_review 또는 주기 미상(viewedCycle null)은 차단(블랙리스트 폴스루 금지).
  const resultsVisible = isFinalStage;

  // 공개 단계가 아니면 결과 상세는 호출하지 않는다(cycleId=null 로 비활성).
  const { data, loading, error, reload } = useResultDetailData(
    userId,
    resultsVisible ? cycleId : null,
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
  // 부서 폴백에 직급 라벨을 섞지 않는다(부서 자리엔 부서만) — 미상이면 '—'.
  const displayDept = data?.departmentName ?? '—';

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

  // ── 결과 미공개 단계(draft/active) 또는 주기 미상(viewedCycle null): 잠정 결과 렌더 금지, 안내만 ──
  if (!resultsVisible) {
    return (
      <PageContainer>
        <PageHeader
          title="평가 상세결과"
          cycles={cycles}
          selectedId={selectedId}
          onSelectCycle={setSelectedId}
        />
        {cyclesLoading ? (
          <ResultSkeleton />
        ) : (
          <EmptyState
            title="결과는 캘리브레이션 완료 후 공개돼요."
            description="이 주기는 아직 평가 진행 단계라 등급·점수 결과가 공개되지 않아요. 주기가 캘리브레이션 단계로 넘어가면 여기서 결과를 볼 수 있어요."
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
        { label: STAGE_LABEL.d3, content: bt?.downward3?.comment ?? null, strong: true },
        { label: STAGE_LABEL.d2, content: bt?.downward2?.comment ?? null, strong: false },
        { label: STAGE_LABEL.d1, content: bt?.downward1?.comment ?? null, strong: false },
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
              // Link 안에 Button(중첩 인터랙티브·무효 마크업) 대신 링크 자체를 버튼 스타일로.
              <Link
                href={`/appeals?resultId=${data.id}`}
                className={getButtonClasses({ variant: 'outlined', size: 'sm', children: true })}
              >
                이의제기
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
        <InfoBanner tone="info" title="결과 보는 법">
          1차·2차·최종(그룹대표) 단계별 실적 점수를 전사 평균과 함께 볼 수 있어요.
          종합 등급은 <strong>실적(KPI) 100% 기준</strong>이며, 역량평가는 참고용으로 등급에 반영되지 않아요.
        </InfoBanner>
      )}

      {/* 요약 카드: 이름/소속 + 종합 등급 박스 + 점수 (image 4 — 카드+그림자, 검정 박스 제거) */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
        <div className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={displayName} size="lg" />
            <div>
              <p className="text-lg font-semibold text-foreground">{displayName}</p>
              <p className="text-sm font-medium text-muted-foreground">{displayDept}</p>
            </div>
          </div>

          {/* B-3d: 종합 + 그룹별(성과중심/협업·성장) 등급 박스 + 참고용 역량평가. */}
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
            {!isImport && (
              <CompetencyRefBox score={bt?.compScore ?? null} />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border bg-muted px-6 py-3 text-sm text-muted-foreground">
          {data.finalGrade === null ? (
            <span>아직 집계 전이에요. 캘리브레이션 완료 후 공개돼요.</span>
          ) : (
            <>
              {data.percentile !== null && (
                <span>
                  전사 상위{' '}
                  <span className="font-bold text-foreground tabular-nums">
                    {data.percentile}%
                  </span>
                </span>
              )}
              <span>
                전사 평균{' '}
                <span className="font-bold text-foreground tabular-nums">
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
          <Card title="평가자 플로우 (본인 → 1차 → 2차 → 최종 그룹대표)">
            <EvaluatorFlow steps={flow} />
            {/* 합산 방식 / 예외 안내 */}
            <div
              className={[
                'mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12px]',
                stageMode && stageMode !== 'normal'
                  ? 'border border-border bg-muted text-foreground'
                  : 'border border-border bg-muted text-muted-foreground',
              ].join(' ')}
            >
              <span
                className={[
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                  stageMode && stageMode !== 'normal' ? 'bg-foreground text-background' : 'bg-muted-foreground text-background',
                ].join(' ')}
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
          <Card title="역량평가 (참고용 — 연봉·등급 미반영)">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-muted px-5 py-4">
              <p className="text-[13px] text-muted-foreground max-w-[480px] leading-relaxed">
                역량 점수는 조직 역량 추이를 보기 위한{' '}
                <strong className="text-foreground font-semibold">참고 자료</strong>예요.
                최종 등급·연봉에는 <strong className="text-foreground font-semibold">반영되지 않습니다</strong>.
              </p>
              <div className="flex flex-col items-center gap-1">
                <span className="tabular-nums text-[32px] font-bold tracking-tight leading-none text-primary">
                  {compScore !== null ? fmtScore(compScore) : '미실시'}
                </span>
                <span className="text-[11px] text-muted-foreground font-semibold">역량 환산점수 (참고용)</span>
              </div>
            </div>
          </Card>

          <Card title="평가 코멘트">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6">
                <span className="text-[13px] text-muted-foreground">아직 작성된 코멘트가 없어요.</span>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li
                    key={c.label}
                    className={[
                      'py-1 pl-3',
                      c.strong ? 'border-l-[3px] border-primary' : 'border-l-[3px] border-border',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{c.label}</span>
                      {c.strong && (
                        <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          최종
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
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
            title: isOwn && user ? getPositionLabel(user.position) : '',
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

// 요약 카드 안의 등급 박스(종합/그룹별) — GradeChip 통일 등급 색(브리프 §2), 선택 카드는 블루 아웃라인.
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
      className={cn(
        'flex min-w-[100px] flex-col items-center justify-center gap-1.5 rounded-lg border bg-card px-4 py-3',
        highlight ? 'border-[1.5px] border-primary bg-info-50' : 'border-border',
      )}
    >
      <span className={cn('text-[11px] font-semibold', highlight ? 'text-primary' : 'text-muted-foreground')}>
        {label}
      </span>
      <GradeChip grade={grade} />
      <span className="tabular-nums text-[11px] font-semibold text-muted-foreground">
        {score !== null ? fmtScore(score) : '집계 전'}
      </span>
    </div>
  );
}

// 참고용 역량평가 박스(image 4 4번째 타일) — 등급 미반영이라 GradeChip 대신 점수만, 소프트 배지로 "참고용" 표시.
function CompetencyRefBox({ score }: { score: number | null }) {
  return (
    <div className="flex min-w-[100px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        참고용
      </span>
      <span className="text-[11px] font-semibold text-muted-foreground">역량 평가</span>
      <span className="tabular-nums text-[20px] font-bold leading-none text-foreground">
        {score !== null ? fmtScore(score) : '미실시'}
      </span>
      <span className="text-[10px] text-muted-foreground">미반영</span>
    </div>
  );
}

// 임포트 결과 라운드 요약 표 — 1차/2차/최종 × 실적·역량(참고).
function ImportRoundTable({ rows }: { rows: ImportRoundRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted text-left">
            <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide">라운드</th>
            <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground text-right">실적</th>
            <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground text-right">역량 (참고)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.label}
              className={['border-t border-border/50', i % 2 === 0 ? 'bg-card' : 'bg-muted/40'].join(' ')}
            >
              <td className="px-4 py-3 font-semibold text-foreground">{r.label}</td>
              <td className="tabular-nums px-4 py-3 text-right font-semibold text-primary">
                {r.perf !== null ? fmtScore(r.perf) : '–'}
              </td>
              <td className="tabular-nums px-4 py-3 text-right text-muted-foreground">
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
