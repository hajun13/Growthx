import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Grade } from '@prisma/client';

// ── 허용 값 화이트리스트 (SSOT) ──
// targetGroup: 문항 적용 대상. role 기준 직책자/비직책자 구분.
//   all=모든 임직원 / manager=직책자(team_lead·division_head·representative) / non_manager=비직책자(employee).
// 카테고리는 더 이상 하드코딩 문자열이 아닌 CompetencyCategory 레지스트리(categoryId FK).
export const COMPETENCY_TARGET_GROUPS = ['all', 'manager', 'non_manager'] as const;

export type CompetencyTargetGroup = (typeof COMPETENCY_TARGET_GROUPS)[number];

// ── 카테고리(Category) ──

export class CreateCompetencyCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompetencyCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── 질문(Question) ──

export class CreateCompetencyQuestionDto {
  @IsString()
  cycleId!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  hint?: string;

  @IsString()
  categoryId!: string; // CompetencyCategory.id

  // 문항별 커스텀 5지선다 보기. []=레거시/폴백. 값이 있으면 정확히 5개(서비스 레이어 검증).
  // 인덱스0→점수1(등급D, 최저) … 인덱스4→점수5(등급S, 최고).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  options?: string[];

  /**
   * 카테고리 가중치 %. 카테고리에 이미 문항이 있으면 무시되고 그 카테고리 가중치를 따른다
   * (카테고리 내 동일값). 첫 문항일 때만 초기값으로 쓰인다.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsIn(COMPETENCY_TARGET_GROUPS)
  targetGroup?: CompetencyTargetGroup; // all/manager/non_manager

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
  @IsOptional() @IsString() categoryId?: string;
  // 5지선다 보기. []=보기 제거(폴백), 값 있으면 정확히 5개(서비스 검증). undefined=미변경.
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(5) options?: string[];
  /** 카테고리 가중치 % — 지정 시 이 문항이 속한 카테고리 전체 문항에 적용(카테고리 내 동일값). */
  @IsOptional() @IsInt() @Min(0) @Max(100) weight?: number;
  @IsOptional() @IsIn(COMPETENCY_TARGET_GROUPS) targetGroup?: CompetencyTargetGroup;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCompetencyQuestionsQuery {
  // cycleId 미지정 시 전체 사이클 문항 조회(관리자 연도별 이력 조회). 지정 시 해당 사이클 필터.
  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsIn(COMPETENCY_TARGET_GROUPS)
  targetGroup?: CompetencyTargetGroup;
}

export class CopyFromCycleDto {
  @IsString()
  sourceCycleId!: string;

  @IsString()
  targetCycleId!: string;
}

export class CategoryWeightItemDto {
  @IsString()
  categoryId!: string;

  /** 카테고리 가중치 %(0~100) — 그 카테고리의 모든 문항에 동일 적용. */
  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;
}

/** 카테고리 가중치 일괄 저장 — 저장 후 평가표(직책자/비직책자)별 카테고리 가중치 합 = 100% 필수. */
export class SetCategoryWeightsDto {
  @IsString()
  cycleId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryWeightItemDto)
  weights!: CategoryWeightItemDto[];
}

// ── 응답(Response) ──

export class CompetencyResponseItemDto {
  @IsString()
  questionId!: string;

  /** 등급. 미지정 시 코멘트 단독 저장(기존 행이 있으면 코멘트만 갱신, 등급 유지). */
  @IsOptional()
  @IsEnum(Grade)
  grade?: Grade;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkCompetencyResponseDto {
  @IsString()
  cycleId!: string;

  /**
   * 피평가자 id. 미지정(또는 본인)=본인평가(self) 열, 지정=그 사용자의 시트에
   * 내 평가 단계(1차/2차/최종 — 하향 평가 배정 기준) 열 작성.
   */
  @IsOptional()
  @IsString()
  targetUserId?: string;

  /** 제출 시 true → submittedAt 기록(임시저장은 false/미지정). */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetencyResponseItemDto)
  responses!: CompetencyResponseItemDto[];
}

export const COMPETENCY_STAGES = ['self', 'round1', 'round2', 'round3'] as const;

export class ListCompetencyResponsesQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** 단계 필터(self/round1/round2/round3). 미지정=전체(본인 조기열람 게이트 적용). */
  @IsOptional()
  @IsIn(COMPETENCY_STAGES)
  stage?: (typeof COMPETENCY_STAGES)[number];
}

// ── 역량평가서(시트)·평가 대상·종합의견 ──

export class CompetencySheetQuery {
  @IsString()
  cycleId!: string;

  /** 피평가자 id. 미지정=본인 시트. */
  @IsOptional()
  @IsString()
  userId?: string;
}

export class CompetencyTargetsQuery {
  @IsString()
  cycleId!: string;
}

export class SaveCompetencyOpinionDto {
  @IsString()
  cycleId!: string;

  /** 피평가자 id. */
  @IsString()
  userId!: string;

  /** 종합의견 본문. 빈 문자열 저장 = 삭제. */
  @IsString()
  comment!: string;
}

export class CompetencyResponseSummaryQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
