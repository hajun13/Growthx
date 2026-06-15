import { ApiProperty } from '@nestjs/swagger';
import { KpiCategory, KpiGroup } from '@prisma/client';

/**
 * KPI 일괄 등록 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 값 형태는 ExcelService(previewKpi·commitKpi·submitImportedKpi) 반환의 `data` 내부와 일치.
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다.
 */

/** 파싱/적재 오류 1건. */
export class KpiImportErrorDto {
  @ApiProperty()
  row!: number;

  @ApiProperty()
  message!: string;
}

/** 미리보기/편집 KPI 행 1개(parseKpiSheet rows 와 동일). */
export class KpiImportRowDto {
  @ApiProperty({ enum: KpiCategory })
  category!: KpiCategory;

  @ApiProperty({ enum: KpiGroup })
  group!: KpiGroup;

  @ApiProperty({ type: String, nullable: true })
  csf!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  targetText!: string | null;

  @ApiProperty({ type: String, nullable: true })
  measureMethod!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  weight!: number | null;

  @ApiProperty()
  isQualitative!: boolean;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: { type: 'string' },
    description: '정성 등급기준 {S,A,B,C,D} 텍스트',
  })
  gradingCriteria!: Record<string, string> | null;

  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;
}

/** POST /excel/import/kpi/preview 응답(data). */
export class KpiImportPreviewDto {
  @ApiProperty({ type: String, nullable: true })
  fileName!: string | null;

  @ApiProperty({ type: [KpiImportRowDto] })
  rows!: KpiImportRowDto[];

  @ApiProperty()
  validCount!: number;

  @ApiProperty()
  errorCount!: number;

  @ApiProperty()
  weightSum!: number;

  @ApiProperty({ type: [KpiImportErrorDto] })
  errors!: KpiImportErrorDto[];
}

/** POST /excel/import/kpi/commit 응답(data). importKpi 와 동일 shape. */
export class KpiImportResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ type: String, nullable: true })
  fileName!: string | null;

  @ApiProperty()
  imported!: number;

  @ApiProperty()
  deletedDrafts!: number;

  @ApiProperty()
  weightSum!: number;

  @ApiProperty({ type: [KpiImportErrorDto] })
  errors!: KpiImportErrorDto[];

  @ApiProperty({ type: [String] })
  warnings!: string[];
}

/** POST /excel/import/kpi/submit 응답(data). */
export class KpiImportSubmitResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  submitted!: number;

  @ApiProperty()
  weightSum!: number;
}
