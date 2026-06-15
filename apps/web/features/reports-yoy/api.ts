/**
 * reports-yoy feature — 데이터 계층(연도 누적 비교 · 조직 등급분포).
 * @growthx/contracts 생성 클라이언트 호출 + 봉투 unwrap.
 *
 * ⚠ 봉투 이중 래핑: orval customFetch 는 { data, status, headers } 를 반환하고,
 *   그 data 가 다시 HTTP 본문 봉투({ data: <DTO> }) → 실제 DTO 는 res.data.data.
 *
 * 생성 DTO(nullable cycleName·year·org.*) 를 기존 도메인 타입(@/lib/types 의
 * CompareResult·DistributionResult)으로 매핑해 UI 의 로직·시각을 그대로 보존한다.
 */
import {
  resultsControllerCompare,
  resultsControllerDistribution,
  type CompareResultDto,
  type DistributionResultDto,
} from '@growthx/contracts';
import type {
  CompareResult,
  CompareTimelineEntry,
  DistributionResult,
  DistributionCycle,
  DistributionScope,
  EmploymentStatus,
  Grade,
  LegalEntity,
} from '@/lib/types';

const ZERO_COUNTS: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };

function toCompareResult(dto: CompareResultDto): CompareResult {
  return {
    userId: dto.userId,
    userName: dto.userName,
    employmentStatus: dto.employmentStatus as EmploymentStatus,
    legalEntity: dto.legalEntity as LegalEntity,
    timeline: dto.timeline.map(
      (t): CompareTimelineEntry => ({
        cycleId: t.cycleId,
        cycleName: t.cycleName ?? '',
        year: t.year ?? 0,
        finalGrade: (t.finalGrade ?? null) as Grade | null,
        finalScore: t.finalScore,
        percentile: t.percentile,
        perf: t.perf,
        comp: t.comp,
        org: {
          group: t.org.group,
          division: t.org.division,
          team: t.org.team,
        },
        ruleSummary: {
          competencyIncluded: t.ruleSummary.competencyIncluded,
          gradeScaleLabel: t.ruleSummary.gradeScaleLabel,
          source: t.ruleSummary.source,
        },
      }),
    ),
  };
}

function toDistributionResult(dto: DistributionResultDto): DistributionResult {
  return {
    scope: dto.scope,
    cycles: dto.cycles.map(
      (c): DistributionCycle => ({
        cycleId: c.cycleId,
        cycleName: c.cycleName ?? '',
        year: c.year ?? 0,
        buckets: c.buckets.map((b) => ({
          deptName: b.deptName,
          total: b.total,
          counts: { ...ZERO_COUNTS, ...b.counts },
          ratios: { ...ZERO_COUNTS, ...b.ratios },
        })),
        overall: {
          total: c.overall.total,
          counts: { ...c.overall.counts },
          ratios: { ...c.overall.ratios },
        },
      }),
    ),
  };
}

// GET /results/compare — 개인 연도별 타임라인.
// userId 생략 시 본인 기준(백엔드 행수준 권한). cycleIds 빈 배열 → 미전송(전 사이클).
export async function fetchYoyCompare(params: {
  userId?: string | null;
  cycleIds?: string[];
}): Promise<CompareResult> {
  const cycleIdsKey = (params.cycleIds ?? []).join(',');
  const res = await resultsControllerCompare({
    userId: params.userId ?? undefined,
    cycleIds: cycleIdsKey || undefined,
  });
  return toCompareResult(res.data.data);
}

// GET /results/distribution — 조직 등급분포.
// 'all' 법인은 미전송(전체). cycleIds 빈 배열 → 미전송(전 사이클).
export async function fetchYoyDistribution(params: {
  scope?: DistributionScope;
  deptId?: string | null;
  cycleIds?: string[];
  legalEntity?: LegalEntity | 'all';
}): Promise<DistributionResult> {
  const cycleIdsKey = (params.cycleIds ?? []).join(',');
  const legalEntity =
    params.legalEntity && params.legalEntity !== 'all'
      ? params.legalEntity
      : undefined;
  const res = await resultsControllerDistribution({
    scope: params.scope,
    deptId: params.deptId ?? undefined,
    cycleIds: cycleIdsKey || undefined,
    legalEntity,
  });
  return toDistributionResult(res.data.data);
}
