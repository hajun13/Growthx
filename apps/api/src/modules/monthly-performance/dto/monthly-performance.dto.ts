import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { KpiCategory } from '@prisma/client';

export class CreateMonthlyPerformanceDto {
  @IsString()
  cycleId!: string;

  @IsString()
  departmentId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsEnum(KpiCategory)
  category!: KpiCategory;

  @IsNumber()
  targetAmount!: number;

  @IsNumber()
  actualAmount!: number;
}

export class UpdateMonthlyPerformanceDto {
  @IsOptional() @IsNumber() targetAmount?: number;
  @IsOptional() @IsNumber() actualAmount?: number;
}

export class ListMonthlyPerformanceQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() year?: string;
  @IsOptional() @IsEnum(KpiCategory) category?: KpiCategory;
}

export class MonthlyPerformanceSummaryQuery {
  @IsString()
  cycleId!: string;

  @IsString()
  departmentId!: string;
}

/**
 * 월별 실적 최종저장(finalize) — 매칭 행 status=draft→final.
 * month 미지정 시 해당 부서·연도의 전월(month>=1) 일괄 확정.
 */
export class FinalizeMonthlyDto {
  @ApiProperty()
  @IsString()
  cycleId!: string;

  @ApiProperty()
  @IsString()
  departmentId!: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  /** 미지정 시 해당 부서·연도 전월(1~12) 일괄 확정. 지정 시 해당 월만. */
  @ApiProperty({ required: false, type: Number, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
