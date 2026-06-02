import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRuleSetDto {
  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsObject({ each: false })
  gradeScale!: unknown;

  @IsObject({ each: false })
  gradingScales!: unknown;

  @IsObject({ each: false })
  poolRatios!: unknown;

  @IsObject({ each: false })
  raiseRates!: unknown;

  @IsObject({ each: false })
  weightPolicy!: unknown;
}

export class UpdateRuleSetDto {
  @IsOptional()
  gradeScale?: unknown;

  @IsOptional()
  gradingScales?: unknown;

  @IsOptional()
  poolRatios?: unknown;

  @IsOptional()
  raiseRates?: unknown;

  @IsOptional()
  weightPolicy?: unknown;
}
