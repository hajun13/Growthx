import { ApiProperty } from '@nestjs/swagger';
import { RebaselineRequestStatus } from '@prisma/client';

/**
 * 재조정(re-baseline) 요청 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope / @ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 RebaselineService.toView / serialize / history 반환과 1:1 일치.
 */

/** 제안 1건(저장·반환되는 items[] 요소). */
export class RebaselineItemDtoOut {
  @ApiProperty()
  kpiId!: string;

  /** undefined=변경 안 함, null=목표값 제거. */
  @ApiProperty({ type: Number, nullable: true, required: false })
  targetValue?: number | null;

  /** undefined=변경 안 함. */
  @ApiProperty({ type: String, nullable: true, required: false })
  targetText?: string | null;

  /** undefined=변경 안 함, 0~100 정수. */
  @ApiProperty({ type: Number, required: false })
  weight?: number;
}

/** 변경된 필드 1건(전/후). */
export class RebaselineFieldChangeDto {
  @ApiProperty({ enum: ['targetValue', 'targetText', 'weight'] })
  field!: 'targetValue' | 'targetText' | 'weight';

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }], nullable: true })
  before!: number | string | null;

  @ApiProperty({ oneOf: [{ type: 'number' }, { type: 'string' }], nullable: true })
  after!: number | string | null;
}

/** 현재 confirmed KPI 스냅샷 1건(diff 기준). */
export class RebaselineKpiDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty()
  group!: string;

  @ApiProperty()
  measureType!: string;

  @ApiProperty({ type: Number, nullable: true })
  targetValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  targetText!: string | null;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  isQualitative!: boolean;

  @ApiProperty()
  status!: string;
}

/** 제안 값(proposed) — proposedChanges 요소 내부. */
export class RebaselineProposedValueDto {
  @ApiProperty({ type: Number, nullable: true, required: false })
  targetValue?: number | null;

  @ApiProperty({ type: String, nullable: true, required: false })
  targetText?: string | null;

  @ApiProperty({ type: Number, required: false })
  weight?: number;
}

/** 현재 값(current) — proposedChanges 요소 내부. */
export class RebaselineCurrentValueDto {
  @ApiProperty({ type: Number, nullable: true })
  targetValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  targetText!: string | null;

  @ApiProperty()
  weight!: number;
}

/** 한 KPI 의 제안 vs 현재 diff. */
export class RebaselineProposedChangeDto {
  @ApiProperty()
  kpiId!: string;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: RebaselineProposedValueDto })
  proposed!: RebaselineProposedValueDto;

  @ApiProperty({ type: RebaselineCurrentValueDto, nullable: true })
  current!: RebaselineCurrentValueDto | null;

  @ApiProperty({ type: [RebaselineFieldChangeDto] })
  fields!: RebaselineFieldChangeDto[];
}

/**
 * 목록·공통 view — GET /midterm/rebaseline-requests 응답 요소.
 * RebaselineService.toView 반환과 일치.
 */
export class RebaselineRequestViewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  evaluateeId!: string;

  @ApiProperty({ type: String, nullable: true })
  evaluateeName!: string | null;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: RebaselineRequestStatus })
  status!: RebaselineRequestStatus;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ type: String, nullable: true })
  reviewerId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewerName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  reviewedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  appliedSnapshotId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * 상세 = view + 제안·현재값 비교 정보.
 * GET /midterm/rebaseline-requests/:id 및 mutation(생성·수정·검토) 응답.
 * RebaselineService.serialize 반환과 일치.
 */
export class RebaselineRequestDetailDto extends RebaselineRequestViewDto {
  @ApiProperty({ type: [RebaselineItemDtoOut] })
  items!: RebaselineItemDtoOut[];

  @ApiProperty({ type: [RebaselineKpiDto] })
  currentKpis!: RebaselineKpiDto[];

  @ApiProperty({ type: [RebaselineProposedChangeDto] })
  proposedChanges!: RebaselineProposedChangeDto[];

  @ApiProperty()
  projectedWeightSum!: number;

  @ApiProperty()
  weightValid!: boolean;
}

/** 한 KPI 의 변경 묶음(history.changed 요소). */
export class RebaselineKpiChangeDto {
  @ApiProperty()
  kpiId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: [RebaselineFieldChangeDto] })
  fields!: RebaselineFieldChangeDto[];
}

/**
 * 재조정 이력 1건 — GET /midterm/rebaseline/history 응답 요소.
 * RebaselineService.history entries 반환과 일치.
 */
export class RebaselineHistoryEntryDto {
  @ApiProperty()
  snapshotId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  createdBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  createdByName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: [RebaselineKpiChangeDto] })
  changed!: RebaselineKpiChangeDto[];
}
