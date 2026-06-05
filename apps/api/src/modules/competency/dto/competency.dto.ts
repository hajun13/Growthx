import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Grade } from '@prisma/client';

// ── 허용 값 화이트리스트 (SSOT) ──
// 자유 문자열은 오타·공백·i18n 변형 시 유령 그룹 버킷을 만들어 문항이 의도한 그룹에서 사라짐.
// 컬럼 타입은 String 유지(마이그레이션 없음), 허용 '값'만 API에서 제약한다.
// appliedLevel: Position enum(team_lead=팀장, division_head=본부장) 기준 실제 관리 계층.
//   '차장'은 본 프로젝트 직급 체계(책임/선임/프로)에 없는 값이라 폐기 → '본부장 이상' 사용.
export const COMPETENCY_CATEGORIES = ['리더십', '협업', '전문성', '혁신'] as const;
export const COMPETENCY_APPLIED_LEVELS = [
  '전 직급',
  '팀장 이상',
  '본부장 이상',
] as const;

export type CompetencyCategory = (typeof COMPETENCY_CATEGORIES)[number];
export type CompetencyAppliedLevel = (typeof COMPETENCY_APPLIED_LEVELS)[number];

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
  @IsIn(COMPETENCY_CATEGORIES)
  category?: CompetencyCategory; // 리더십/협업/전문성/혁신

  @IsOptional()
  @IsInt()
  @Min(0)
  weight?: number; // % 가중치

  @IsOptional()
  @IsIn(COMPETENCY_APPLIED_LEVELS)
  appliedLevel?: CompetencyAppliedLevel; // 전 직급/팀장 이상/본부장 이상

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
  @IsOptional() @IsIn(COMPETENCY_CATEGORIES) category?: CompetencyCategory;
  @IsOptional() @IsInt() @Min(0) weight?: number;
  @IsOptional() @IsIn(COMPETENCY_APPLIED_LEVELS) appliedLevel?: CompetencyAppliedLevel;
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
