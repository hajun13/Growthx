import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { CycleStatus } from '@prisma/client';

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
}

export class UpdateCycleStatusDto {
  @IsEnum(CycleStatus)
  status!: CycleStatus;
}

export class ListCyclesQuery {
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @IsOptional()
  @IsString()
  year?: string;
}
