import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { EvaluationStatus, EvaluationType, Grade } from '@prisma/client';

export class CreateEvaluationDto {
  @IsString()
  cycleId!: string;

  @IsString()
  evaluateeId!: string;

  @IsEnum(EvaluationType)
  type!: EvaluationType;

  /** downward 일 때 필수: 1=1차 팀장, 2=2차 본부장. self 는 생략. */
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  round?: number;
}

/**
 * 과제별 성과 점수 입력.
 * - achievementRate: amount/rate 측정방식의 달성률(%) 또는 count 의 실적 건수.
 * - directGrade: qualitative 측정방식에서 평가자가 직접 부여한 등급.
 * grade/score 는 백엔드가 측정방식·RuleSet 으로 산출(프론트 위임 금지).
 */
export class KpiScoreInput {
  @IsString()
  kpiId!: string;

  @IsOptional()
  @IsNumber()
  achievementRate?: number;

  @IsOptional()
  @IsEnum(Grade)
  directGrade?: Grade;

  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;
}

export class PatchEvaluationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiScoreInput)
  kpiScores?: KpiScoreInput[];
}

export class AddCommentDto {
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsString()
  content!: string;
}

export class ListEvaluationsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() evaluatorId?: string;
  @IsOptional() @IsString() evaluateeId?: string;
  @IsOptional() @IsEnum(EvaluationType) type?: EvaluationType;
  @IsOptional() @IsEnum(EvaluationStatus) status?: EvaluationStatus;
}
