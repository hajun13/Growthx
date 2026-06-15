import { ApiProperty } from '@nestjs/swagger';
import { KpiCategory } from '@prisma/client';

/**
 * 월별 실적 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 MonthlyPerformanceService.toDto / summary 반환과 일치.
 */

/** 단건 월별 실적(목표·실적·달성률). list/create/update 공통 shape. */
export class MonthlyPerformanceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  departmentId!: string;

  @ApiProperty()
  year!: number;

  /** 1~12. */
  @ApiProperty()
  month!: number;

  @ApiProperty({ enum: KpiCategory })
  category!: KpiCategory;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;

  /** 단월 달성률(actual/target×100, 목표 0이면 0). */
  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ type: String, nullable: true })
  enteredById!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 카테고리별 누적 현황(요약 카드). */
export class MonthlyPerformanceSummaryCategoryDto {
  @ApiProperty({ enum: KpiCategory })
  category!: KpiCategory;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;

  @ApiProperty()
  achievementRate!: number;

  /** 측정방식별 등급(S~D). 실적 미입력 시 null. */
  @ApiProperty({ type: String, nullable: true })
  currentGrade!: string | null;
}

/** 월별 누적 달성률 추이 1포인트(차트). */
export class MonthlyTrendPointDto {
  /** 1~12. */
  @ApiProperty()
  month!: number;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ type: String, nullable: true })
  grade!: string | null;
}

/** 누적 달성률 + 현재 등급 요약(카테고리별 + 종합 + 월별 추이). */
export class MonthlyPerformanceSummaryDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  departmentId!: string;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  /** 누적 목표 합. */
  @ApiProperty()
  targetAmount!: number;

  /** 누적 실적 합. */
  @ApiProperty()
  actualAmount!: number;

  @ApiProperty()
  achievementRate!: number;

  /** 종합 등급(S~D). 실적 미입력 시 null. */
  @ApiProperty({ type: String, nullable: true })
  currentGrade!: string | null;

  @ApiProperty({ type: [MonthlyPerformanceSummaryCategoryDto] })
  byCategory!: MonthlyPerformanceSummaryCategoryDto[];

  @ApiProperty({ type: [MonthlyTrendPointDto] })
  monthlyTrend!: MonthlyTrendPointDto[];
}
