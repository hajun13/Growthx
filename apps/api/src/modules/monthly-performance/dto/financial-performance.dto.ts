import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 경영실적(월별 손익) 일괄 적재 — 부서·연도 단위로 매출/원가 목표·실적을 한 번에 upsert.
 * KPI commit 패턴과 동일하게 트랜잭션 upsert + audit 기록.
 * 저장 입력값은 매출(revenue)·원가(cost) 의 목표/실적뿐.
 * 매출총이익/율/년계는 응답에서 파생(저장 안 함).
 */

/** 단월 입력 행(목표/실적). 미입력 셀은 생략(null) 가능. */
export class FinancialMonthInputDto {
  /** 1~12. */
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsOptional() @IsNumber() revenueTarget?: number | null;
  @IsOptional() @IsNumber() revenueActual?: number | null;
  @IsOptional() @IsNumber() costTarget?: number | null;
  @IsOptional() @IsNumber() costActual?: number | null;
}

/** 전년도(2024) 연간 참고값(월 분할 없음). month=0 sentinel 행으로 저장. */
export class FinancialPrevYearDto {
  @IsOptional() @IsNumber() revenueActual?: number | null;
  @IsOptional() @IsNumber() costActual?: number | null;
  /** 참고용 전년 목표(있으면). 보통 실적만. */
  @IsOptional() @IsNumber() revenueTarget?: number | null;
  @IsOptional() @IsNumber() costTarget?: number | null;
}

/** 일괄 적재 바디 — 부서·연도 단위 12개월 + 전년 참고. */
export class FinancialPerformanceBulkDto {
  @IsString()
  cycleId!: string;

  @IsString()
  departmentId!: string;

  /** 기준연도(예: 2025). 전년 참고는 year-1(2024) sentinel 로 저장. */
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialPrevYearDto)
  prevYear?: FinancialPrevYearDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinancialMonthInputDto)
  months!: FinancialMonthInputDto[];
}

/** financial-grid 조회 쿼리. */
export class FinancialGridQuery {
  @IsString()
  cycleId!: string;

  @IsString()
  departmentId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year!: number;
}
