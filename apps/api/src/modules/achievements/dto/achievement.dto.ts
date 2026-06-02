import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  kpiId!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsNumber()
  actualValue!: number;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

export class ListAchievementsQuery {
  @IsOptional()
  @IsString()
  kpiId?: string;

  @IsOptional()
  @IsString()
  quarter?: string;
}
