import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Grade } from '@prisma/client';

// ── 질문(Question) ──

export class CreateCompetencyQuestionDto {
  @IsString()
  cycleId!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  hint?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompetencyQuestionDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() hint?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCompetencyQuestionsQuery {
  @IsString()
  cycleId!: string;
}

// ── 응답(Response) ──

export class CompetencyResponseItemDto {
  @IsString()
  questionId!: string;

  @IsEnum(Grade)
  grade!: Grade;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkCompetencyResponseDto {
  @IsString()
  cycleId!: string;

  /** 제출 시 true → submittedAt 기록(임시저장은 false/미지정). */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetencyResponseItemDto)
  responses!: CompetencyResponseItemDto[];
}

export class ListCompetencyResponsesQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class CompetencyResponseSummaryQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
