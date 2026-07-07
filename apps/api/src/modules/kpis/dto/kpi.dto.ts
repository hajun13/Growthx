import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { KpiCategory, KpiGroup, KpiStatus, MeasureType } from '@prisma/client';

export class CreateKpiDto {
  @IsString()
  cycleId!: string;

  /** hr_admin 대리 생성용 대상 사용자. 미지정 시 작성자 본인. (비관리자는 무시) */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(KpiCategory)
  category!: KpiCategory;

  @IsEnum(KpiGroup)
  group!: KpiGroup;

  @IsString()
  title!: string;

  /** 서술 필드는 null 허용 — "전송된 null/빈 값 = 클리어 의도"(@IsOptional 은 null 도 검증 스킵). */
  @IsOptional()
  @IsString()
  coreStrategy?: string | null;

  @IsOptional()
  @IsString()
  csf?: string | null;

  @IsOptional()
  @IsString()
  measureMethod?: string | null;

  @IsEnum(MeasureType)
  measureType!: MeasureType;

  @IsOptional()
  @IsNumber()
  targetValue?: number | null;

  /** 서술형 2026 목표(엑셀 F열). 정량 targetValue 와 병존. */
  @IsOptional()
  @IsString()
  targetText?: string | null;

  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsBoolean()
  isQualitative!: boolean;

  /** 갭#2: measureType=amount 일 때만 의미. true 면 실제 매출 절대금액 → revenueGradeScale 로 등급. */
  @IsOptional()
  @IsBoolean()
  useAbsoluteAmount?: boolean;

  /** count 측정방식의 건수→등급 임계값(CountGradeBand[]). amount/rate 는 불필요. */
  @IsOptional()
  @IsArray()
  grading?: unknown[];

  /** 정성 등급기준 {S,A,B,C,D} 텍스트(엑셀 L~P열). 밴드 값·객체 자체 모두 null 허용(클리어). */
  @IsOptional()
  @IsObject()
  gradingCriteria?: Record<string, string | null> | null;

  @IsOptional()
  @IsString()
  parentKpiId?: string;
}

/**
 * 부분 수정 시맨틱: 미전송(undefined) 필드 = 기존값 유지,
 * 전송된 null·빈 문자열 = 클리어(서비스에서 null 로 정규화 반영).
 */
export class UpdateKpiDto {
  @IsOptional() @IsEnum(KpiCategory) category?: KpiCategory;
  @IsOptional() @IsEnum(KpiGroup) group?: KpiGroup;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() coreStrategy?: string | null;
  @IsOptional() @IsString() csf?: string | null;
  @IsOptional() @IsString() measureMethod?: string | null;
  @IsOptional() @IsEnum(MeasureType) measureType?: MeasureType;
  @IsOptional() @IsNumber() targetValue?: number | null;
  @IsOptional() @IsString() targetText?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(100) weight?: number;
  @IsOptional() @IsBoolean() isQualitative?: boolean;
  @IsOptional() @IsBoolean() useAbsoluteAmount?: boolean;
  @IsOptional() @IsArray() grading?: unknown[];
  @IsOptional() @IsObject() gradingCriteria?: Record<string, string | null> | null;
  @IsOptional() @IsString() parentKpiId?: string;
}

export class ApproveKpiDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectKpiDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class LinkKpiDto {
  @IsString()
  parentKpiId!: string;
}

export class ListKpisQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsEnum(KpiStatus) status?: KpiStatus;
  @IsOptional() @IsEnum(KpiGroup) group?: KpiGroup;
  @IsOptional() @IsEnum(KpiCategory) category?: KpiCategory;
}

/** KPI 검토 의견(Review) 조회 — kpiId 단건 또는 cycleId·userId 묶음. */
export class ListReviewsQuery {
  @IsOptional() @IsString() kpiId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() cycleId?: string;
}
