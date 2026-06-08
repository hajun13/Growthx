import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { KpiCategory, KpiGroup } from '@prisma/client';

/** 정성 등급기준 {S,A,B,C,D} 텍스트. 화면 편집 반영. 모든 칸 선택. */
export class KpiImportGradingCriteriaDto {
  @IsOptional() @IsString() S?: string | null;
  @IsOptional() @IsString() A?: string | null;
  @IsOptional() @IsString() B?: string | null;
  @IsOptional() @IsString() C?: string | null;
  @IsOptional() @IsString() D?: string | null;
}

/** 관리자가 미리보기에서 편집한 1개 KPI 행. */
export class KpiImportCommitRowDto {
  @IsEnum(KpiCategory)
  category!: KpiCategory;

  @IsEnum(KpiGroup)
  group!: KpiGroup;

  @IsOptional()
  @IsString()
  csf?: string | null;

  /** 성과관리지표(KPI). 빈 행은 스킵 + warning. */
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  targetText?: string | null;

  @IsOptional()
  @IsString()
  measureMethod?: string | null;

  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  /** 관리자 토글(정성/정량). */
  @IsBoolean()
  isQualitative!: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => KpiImportGradingCriteriaDto)
  gradingCriteria?: KpiImportGradingCriteriaDto | null;
}

/** POST /excel/import/kpi/commit — 편집된 행 적재(JSON body). */
export class KpiImportCommitDto {
  /** 대상 사용자(필수). */
  @IsString()
  userId!: string;

  /** 생략 시 활성 사이클(없으면 400). */
  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiImportCommitRowDto)
  rows!: KpiImportCommitRowDto[];
}

/**
 * POST /excel/import/kpi/submit — 적재된 draft KPI를 제출(submitted)로 전환.
 * 적재(commit) 후 별도 단계로 제출. 본인 제출과 동일하게 가중치 합=100 검증.
 */
export class KpiImportSubmitDto {
  /** 대상 사용자(필수). */
  @IsString()
  userId!: string;

  /** 생략 시 활성 사이클. */
  @IsOptional()
  @IsString()
  cycleId?: string;
}
