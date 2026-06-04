import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { JobLevel, KpiCategory, KpiGroup, MeasureType } from '@prisma/client';

export class KpiTemplateItemDto {
  @IsEnum(KpiCategory)
  category!: KpiCategory;

  @IsEnum(KpiGroup)
  group!: KpiGroup;

  @IsOptional()
  @IsString()
  sampleStrategy?: string;

  @IsEnum(MeasureType)
  defaultMeasureType!: MeasureType;

  @IsInt()
  defaultWeight!: number;

  @IsBoolean()
  isQualitative!: boolean;
}

export class CreateKpiTemplateDto {
  @IsString()
  cycleId!: string;

  @IsEnum(JobLevel)
  jobLevel!: JobLevel;

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => KpiTemplateItemDto)
  items!: KpiTemplateItemDto[];
}

/** 양식 전체 교체(items 재정의). 가중치 합·정성 상한 재검증. */
export class UpdateKpiTemplateDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => KpiTemplateItemDto)
  items?: KpiTemplateItemDto[];
}

export class ListKpiTemplatesQuery {
  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsEnum(JobLevel)
  jobLevel?: JobLevel;
}
