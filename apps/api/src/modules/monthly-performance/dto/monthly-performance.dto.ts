import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
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
