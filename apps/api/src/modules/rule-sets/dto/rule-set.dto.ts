import { IsDefined, IsOptional, IsString } from 'class-validator';

// gradeScale 은 배열(JSON), 나머지는 객체(JSON)다. 구조 무결성은 ScoringService.validateRuleSet 가
// 검증하므로 DTO 단에서는 존재(IsDefined)만 보장한다(@IsObject 는 배열을 거부하므로 사용 금지).
export class CreateRuleSetDto {
  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsDefined()
  gradeScale!: unknown;

  @IsDefined()
  gradingScales!: unknown;

  @IsDefined()
  poolRatios!: unknown;

  @IsDefined()
  raiseRates!: unknown;

  @IsDefined()
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
