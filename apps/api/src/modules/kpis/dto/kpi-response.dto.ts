import { ApiProperty } from '@nestjs/swagger';
import {
  KpiCategory,
  KpiGroup,
  KpiStatus,
  MeasureType,
  ReviewKind,
} from '@prisma/client';

/**
 * KPI 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope / @ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 KpisService.list/get 반환(Prisma Kpi)과 일치.
 */
export class KpiDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ enum: KpiCategory })
  category!: KpiCategory;

  @ApiProperty({ enum: KpiGroup })
  group!: KpiGroup;

  @ApiProperty({ type: String, nullable: true })
  coreStrategy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  csf!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  measureMethod!: string | null;

  @ApiProperty({ enum: MeasureType })
  measureType!: MeasureType;

  @ApiProperty({ type: Number, nullable: true })
  targetValue!: number | null;

  /** 서술형 2026 목표(엑셀 F열). targetValue(숫자)와 병존. */
  @ApiProperty({ type: String, nullable: true })
  targetText!: string | null;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  isQualitative!: boolean;

  /** measureType=amount 일 때만 의미. true 면 실제 매출 절대금액 → revenueGradeScale 로 등급. */
  @ApiProperty()
  useAbsoluteAmount!: boolean;

  /** count 측정방식의 건수→등급 임계값(CountGradeBand[]). amount/rate 는 null. */
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    nullable: true,
    description: 'count 측정방식의 건수→등급 임계값',
  })
  grading!: unknown[] | null;

  /** 정성 등급기준 {S,A,B,C,D} 텍스트(엑셀 L~P열). */
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    nullable: true,
    description: '정성 등급기준 {S,A,B,C,D} 텍스트',
  })
  gradingCriteria!: Record<string, string> | null;

  @ApiProperty({ type: String, nullable: true })
  parentKpiId!: string | null;

  @ApiProperty({ enum: KpiStatus })
  status!: KpiStatus;

  @ApiProperty({ type: String, nullable: true })
  rejectReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * KPI 검토 의견(Review, quarter=0) 응답 DTO.
 * 값 형태는 KpisService.listReviews 반환과 일치(author 평탄화).
 */
export class KpiReviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  kpiId!: string;

  /** strength=승인 의견, improvement=반려/수정요청 의견. */
  @ApiProperty({ enum: ReviewKind })
  kind!: ReviewKind;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  authorName!: string;

  @ApiProperty({ type: String, nullable: true })
  authorPosition!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** KPI 삭제 결과. */
export class KpiDeleteResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;
}
