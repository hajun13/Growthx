import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KpiCategory } from '@prisma/client';

/** 단일 직책의 허용 카테고리 변경. position=직급 코드(PositionDef.code). */
export class UpdatePolicyEntryDto {
  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(KpiCategory, { each: true })
  allowed!: KpiCategory[];
}

/** 전체 매트릭스 일괄 갱신(부분 갱신 가능 — 전달된 position 만 upsert). */
export class UpdateKpiCategoryPolicyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePolicyEntryDto)
  entries!: UpdatePolicyEntryDto[];
}

export class AllowedCategoriesQuery {
  @IsOptional()
  userId?: string;

  @IsOptional()
  @IsString()
  position?: string;
}
