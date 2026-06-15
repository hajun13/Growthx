import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';

/**
 * 평가자정리 표(평가 요약) 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 값 형태는 ResultsService.summaryTable 반환과 일치. 실제 응답은 봉투(@ApiOkEnvelopeArray)로 감싸진다.
 */

/** 단계별 실적/역량 점수(1차·2차·최종·합산 공통). */
export class SummaryStageDto {
  @ApiProperty({ type: Number, nullable: true })
  perf!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  comp!: number | null;
}

/** 평가자정리 표 1행 — 다단계(1차 팀장·2차 본부장·최종 그룹대표) × 실적/역량 + 합산 + 최종. */
export class SummaryRowDto {
  @ApiProperty()
  no!: number;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  group!: string | null;

  @ApiProperty({ type: String, nullable: true })
  division!: string | null;

  @ApiProperty({ type: String, nullable: true })
  team!: string | null;

  /** 직책 코드(PositionDef.code). */
  @ApiProperty({ type: String, nullable: true })
  position!: string | null;

  /** 역할(hr_admin·division_head·team_lead·employee). */
  @ApiProperty({ type: String, nullable: true })
  role!: string | null;

  @ApiProperty({ type: SummaryStageDto })
  stage1!: SummaryStageDto;

  @ApiProperty({ type: SummaryStageDto })
  stage2!: SummaryStageDto;

  @ApiProperty({ type: SummaryStageDto })
  stageFinal!: SummaryStageDto;

  @ApiProperty({ type: SummaryStageDto })
  sum!: SummaryStageDto;

  @ApiProperty({ type: Number, nullable: true })
  finalScore!: number | null;

  /** 최종 등급(S~D). */
  @ApiProperty({ type: String, nullable: true })
  finalGrade!: string | null;

  /** 데이터 출처 — import(과거 엑셀) / live(현행 산정). */
  @ApiProperty({ enum: ['import', 'live'] })
  source!: 'import' | 'live';
}

// ── YoY: 연도 누적 비교 응답 DTO (orval 타입 생성용) ─────────────────
// 값 형태는 ComparisonService.compare / .distribution 반환과 일치.
// 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다.

/** 평가 당시 조직 스냅샷(그룹›본부›팀). */
export class OrgSnapshotDto {
  @ApiProperty({ type: String, nullable: true })
  group!: string | null;

  @ApiProperty({ type: String, nullable: true })
  division!: string | null;

  @ApiProperty({ type: String, nullable: true })
  team!: string | null;
}

/** 사이클별 RuleSet 요약(규칙 차이 표면화). */
export class CompareRuleSummaryDto {
  /** 역량 점수가 등급/연봉 산정에 반영됐는지(false=참고용). */
  @ApiProperty()
  competencyIncluded!: boolean;

  /** 등급 스케일 짧은 라벨("S96·A91·B85·C80·D<80"). */
  @ApiProperty()
  gradeScaleLabel!: string;

  /** 데이터 출처 — import(과거 엑셀) / aggregate(현행 산정). */
  @ApiProperty()
  source!: string;
}

/** GET /results/compare — 개인 연도별 타임라인 1행. */
export class CompareTimelineEntryDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ type: String, nullable: true })
  cycleName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  year!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  finalGrade!: Grade | null;

  @ApiProperty({ type: Number, nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  percentile!: number | null;

  /** 실적 원형. */
  @ApiProperty({ type: Number, nullable: true })
  perf!: number | null;

  /** 역량 원형(참고용, null 가능). */
  @ApiProperty({ type: Number, nullable: true })
  comp!: number | null;

  @ApiProperty({ type: OrgSnapshotDto })
  org!: OrgSnapshotDto;

  @ApiProperty({ type: CompareRuleSummaryDto })
  ruleSummary!: CompareRuleSummaryDto;
}

/** GET /results/compare — 개인 연도 누적 비교 결과. */
export class CompareResultDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  userName!: string;

  /** 재직 상태(active·resigned 등). */
  @ApiProperty()
  employmentStatus!: string;

  /** 법인(energyx·mirae_plan 등). */
  @ApiProperty()
  legalEntity!: string;

  @ApiProperty({ type: [CompareTimelineEntryDto] })
  timeline!: CompareTimelineEntryDto[];
}

/** 등급별 카운트/비율 맵(S~D). additionalProperties 로 표현. */
export class GradeCountMapDto {
  @ApiProperty({ type: Number })
  S!: number;

  @ApiProperty({ type: Number })
  A!: number;

  @ApiProperty({ type: Number })
  B!: number;

  @ApiProperty({ type: Number })
  C!: number;

  @ApiProperty({ type: Number })
  D!: number;
}

/** GET /results/distribution — 조직(부서) 단위 분포 버킷. */
export class DistributionBucketDto {
  /** 스냅샷/현재 조직명. */
  @ApiProperty()
  deptName!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: GradeCountMapDto })
  counts!: GradeCountMapDto;

  /** 등급 비율(%, 소수1). */
  @ApiProperty({ type: GradeCountMapDto })
  ratios!: GradeCountMapDto;
}

/** GET /results/distribution — 전체(overall) 집계. */
export class DistributionOverallDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ type: GradeCountMapDto })
  counts!: GradeCountMapDto;

  @ApiProperty({ type: GradeCountMapDto })
  ratios!: GradeCountMapDto;
}

/** GET /results/distribution — 사이클(연도)별 분포. */
export class DistributionCycleDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ type: String, nullable: true })
  cycleName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  year!: number | null;

  @ApiProperty({ type: [DistributionBucketDto] })
  buckets!: DistributionBucketDto[];

  @ApiProperty({ type: DistributionOverallDto })
  overall!: DistributionOverallDto;
}

/** GET /results/distribution — 연도 누적 조직 등급분포 결과. */
export class DistributionResultDto {
  /** 조직 단위(group·division·team). */
  @ApiProperty({ enum: ['group', 'division', 'team'] })
  scope!: string;

  @ApiProperty({ type: [DistributionCycleDto] })
  cycles!: DistributionCycleDto[];
}
