import { ApiProperty } from '@nestjs/swagger';

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
