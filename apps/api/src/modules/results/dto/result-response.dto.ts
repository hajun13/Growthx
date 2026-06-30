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

// ── 평가 결과 행 DTO (GET /results 목록 · GET /results/:userId 상세 · POST /results/aggregate) ──
// 값 형태는 ResultsService.toDto 반환과 일치. byType 는 live/import 두 shape의 유니온이라
// 모든 키를 optional 로 두고 source 판별자로 분기한다(프론트 EvaluationByType 와 정합).

/** byType 유형별 비교 항목(self / downward1 팀장 / downward2 본부장 / downward3 대표). */
export class ResultByTypeEntryDto {
  @ApiProperty({ type: Number, nullable: true })
  score!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  grade!: Grade | null;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;
}

/** import 결과(과거 사이클)의 라운드 원형 — 실적(perf)·역량(comp) 점수만. */
export class ResultImportRoundDto {
  @ApiProperty({ type: Number, nullable: true })
  perf!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  comp!: number | null;
}

/**
 * byType — live({source,self,downward1~3,compScore,perfSum,stageMode}) /
 * import({source,round1,round2,final}) 유니온. 모든 키 optional, source 로 분기.
 */
export class ResultByTypeDto {
  /** 출처 판별자 — live(현행 산정) / import(과거 엑셀). */
  @ApiProperty({ type: String, required: false })
  source?: string;

  @ApiProperty({ type: ResultByTypeEntryDto, required: false })
  self?: ResultByTypeEntryDto;

  @ApiProperty({ type: ResultByTypeEntryDto, required: false })
  downward1?: ResultByTypeEntryDto;

  @ApiProperty({ type: ResultByTypeEntryDto, required: false })
  downward2?: ResultByTypeEntryDto;

  @ApiProperty({ type: ResultByTypeEntryDto, required: false })
  downward3?: ResultByTypeEntryDto;

  /** 역량 환산 점수(단일) — 등급 미반영·참고용 표시만. */
  @ApiProperty({ type: Number, nullable: true, required: false })
  compScore?: number | null;

  /** 예외 반영된 실적 합산(최종점수의 실적 기준값). */
  @ApiProperty({ type: Number, nullable: true, required: false })
  perfSum?: number | null;

  /** 실적 합산 적용 방식(normal·exception1·exception2). */
  @ApiProperty({ enum: ['normal', 'exception1', 'exception2'], required: false })
  stageMode?: string;

  @ApiProperty({ type: ResultImportRoundDto, nullable: true, required: false })
  round1?: ResultImportRoundDto | null;

  @ApiProperty({ type: ResultImportRoundDto, nullable: true, required: false })
  round2?: ResultImportRoundDto | null;

  @ApiProperty({ type: ResultImportRoundDto, nullable: true, required: false })
  final?: ResultImportRoundDto | null;
}

/** byGroup 그룹별 점수·등급(성과중심·협업성장). */
export class ResultByGroupEntryDto {
  @ApiProperty({ type: Number, nullable: true })
  score!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  grade!: Grade | null;
}

/** byGroup — KPI 그룹별(성과중심·협업성장) 점수·등급. */
export class ResultByGroupDto {
  @ApiProperty({ type: ResultByGroupEntryDto })
  performance_core!: ResultByGroupEntryDto;

  @ApiProperty({ type: ResultByGroupEntryDto })
  collaboration_growth!: ResultByGroupEntryDto;
}

/**
 * 평가 결과 1행 — GET /results 목록·GET /results/:userId 상세·POST /results/aggregate 공통.
 * ResultsService.toDto 반환과 일치. 미집계 사용자는 점수/등급/byType/byGroup 가 null.
 */
export class EvaluationResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  /** 최종 등급(S~D) — 미집계 시 null. */
  @ApiProperty({ enum: Grade, nullable: true })
  finalGrade!: Grade | null;

  @ApiProperty({ type: Number, nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  percentile!: number | null;

  @ApiProperty({ type: ResultByTypeDto, nullable: true })
  byType!: ResultByTypeDto | null;

  @ApiProperty({ type: ResultByGroupDto, nullable: true })
  byGroup!: ResultByGroupDto | null;

  @ApiProperty({ type: Number, nullable: true })
  companyAvg!: number | null;

  /** 비정규화 이름(없으면 null). */
  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  /** 비정규화 부서명(없으면 null). */
  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
