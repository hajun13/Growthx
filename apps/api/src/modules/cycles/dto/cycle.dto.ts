import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { CycleStatus, CycleType } from '@prisma/client';

export class CreateCycleDto {
  @IsString()
  name!: string;

  @IsInt()
  year!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  ruleSetId?: string;

  @IsOptional()
  @IsEnum(CycleType)
  cycleType?: CycleType;
}

export class UpdateCycleStatusDto {
  @IsEnum(CycleStatus)
  status!: CycleStatus;
}

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  year?: number;
}

export class ListCyclesQuery {
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @IsOptional()
  @IsString()
  year?: string;
}
