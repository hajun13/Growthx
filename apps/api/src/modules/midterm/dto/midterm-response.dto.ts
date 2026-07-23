import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActionItemSource,
  ActionItemStatus,
  Grade,
  KpiStatus,
  MeasureType,
  MidtermReviewStatus,
} from '@prisma/client';

/**
 * 6월 중간평가 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope / @ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 MidtermProgressService / MidtermReviewsService / ActionItemsService 반환과 1:1 일치.
 * (재조정 rebaseline-requests 계열은 rebaseline-response.dto.ts 에서 이미 타입화됨.)
 */

// ── 진척 점검(GET /midterm/progress) ──

/** KPI별 본인 자가점검(prefill용). MidtermKpiCheckIn 일부. */
export class MidtermSelfCheckInDto {
  @ApiProperty()
  kpiId!: string;

  @ApiProperty({ type: String, nullable: true })
  selfActualText!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  selfActualValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  selfNote!: string | null;

  @ApiProperty({ enum: Grade, nullable: true })
  selfGrade!: Grade | null;
}

/** 분기 실적 1건. */
export class MidtermQuarterProgressDto {
  @ApiProperty()
  quarter!: number;

  @ApiProperty()
  actualValue!: number;

  @ApiProperty()
  achievementRate!: number;
}

/** KPI별 진척 1건 — kpiProgress 요소. */
export class MidtermKpiProgressDto {
  @ApiProperty()
  kpiId!: string;

  @ApiProperty({ type: String, nullable: true })
  csf!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  group!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ enum: MeasureType })
  measureType!: MeasureType;

  @ApiProperty({ type: String, nullable: true })
  measureMethod!: string | null;

  @ApiProperty()
  isQualitative!: boolean;

  /** KPI 승인 상태 — 중간점검 수정은 confirmed 만 가능(화면 편집 가능 범위 판정용). */
  @ApiProperty({ enum: KpiStatus })
  status!: KpiStatus;

  @ApiProperty()
  weight!: number;

  @ApiProperty({ type: Number, nullable: true })
  targetValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  targetText!: string | null;

  /** 정성 등급기준 {S,A,B,C,D} 서술(자유 객체). */
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: '정성 등급기준 {S,A,B,C,D} 서술',
  })
  gradingCriteria!: Record<string, unknown> | null;

  @ApiProperty()
  cumulativeActual!: number;

  @ApiProperty({ type: Number, nullable: true })
  cumulativeRate!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  currentGrade!: Grade | null;

  @ApiProperty({ enum: ['up', 'flat', 'down'] })
  trend!: 'up' | 'flat' | 'down';

  @ApiProperty({ enum: ['on_track', 'at_risk', 'off_track'] })
  signal!: 'on_track' | 'at_risk' | 'off_track';

  @ApiProperty({ type: [MidtermQuarterProgressDto] })
  quarters!: MidtermQuarterProgressDto[];

  @ApiProperty({ type: MidtermSelfCheckInDto, nullable: true })
  selfCheckIn!: MidtermSelfCheckInDto | null;
}

/** 조직 진척 카테고리별 1건. */
export class MidtermOrgCategoryDto {
  @ApiProperty()
  category!: string;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;

  @ApiProperty()
  achievementRate!: number;
}

/** 조직 진척 월별 누적 추세 1건. */
export class MidtermOrgMonthlyDto {
  @ApiProperty()
  month!: number;

  @ApiProperty()
  achievementRate!: number;
}

/** 조직 진척 요약(사용자 그룹 월별 실적 누적). */
export class MidtermOrgProgressDto {
  @ApiProperty()
  departmentId!: string;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ type: [MidtermOrgCategoryDto] })
  byCategory!: MidtermOrgCategoryDto[];

  @ApiProperty({ type: [MidtermOrgMonthlyDto] })
  monthlyTrend!: MidtermOrgMonthlyDto[];
}

/** GET /midterm/progress 응답(단건) — MidtermProgressService.progress.data 와 일치. */
export class MidtermProgressDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['on_track', 'at_risk', 'off_track'] })
  overallSignal!: 'on_track' | 'at_risk' | 'off_track';

  @ApiProperty({ type: [MidtermKpiProgressDto] })
  kpis!: MidtermKpiProgressDto[];

  @ApiProperty({ type: MidtermOrgProgressDto, nullable: true })
  org!: MidtermOrgProgressDto | null;
}

// ── 자가점검/부서장 확인 리뷰(GET/POST /midterm/reviews, PATCH :id/confirm) ──

/** 리뷰에 정규화된 KPI별 자가점검 1건(리뷰 toDto.kpiCheckIns 요소). */
export class MidtermReviewCheckInDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  kpiId!: string;

  @ApiProperty({ type: String, nullable: true })
  selfActualText!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  selfActualValue!: number | null;

  @ApiProperty({ type: String, nullable: true })
  selfNote!: string | null;

  @ApiProperty({ enum: Grade, nullable: true })
  selfGrade!: Grade | null;

  @ApiProperty({ type: String, nullable: true })
  reviewerNote!: string | null;

  @ApiProperty({ enum: Grade, nullable: true })
  reviewerGrade!: Grade | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  confirmedAt!: string | null;
}

/** 중간점검 리뷰 1건 — MidtermReviewsService.toDto 와 일치. */
export class MidtermReviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  evaluateeId!: string;

  @ApiProperty({ type: String, nullable: true })
  evaluateeName!: string | null;

  @ApiProperty({ enum: MidtermReviewStatus })
  status!: MidtermReviewStatus;

  @ApiProperty({ type: String, nullable: true })
  selfNote!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  selfSubmittedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewerId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewerName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reviewerNote!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  confirmedAt!: string | null;

  /** 순차 확인 결재(KPI 결재선과 동일 체인) — 완료된 확인 단계 수. */
  @ApiProperty()
  reviewStage!: number;

  /** 확인 이력 [{stage, approverId, approverName, at}]. 반송/재제출 시 리셋. */
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    nullable: true,
    description: '확인 이력 [{stage, approverId, approverName, at}]',
  })
  reviewTrail!: unknown[] | null;

  // ── 2단계 흐름(2026-07-23) — 프론트 MidtermDetail 과 필드명 일치 ──
  // 레거시 자가점검 주기의 행에는 값이 없으므로 전부 optional·nullable.

  /** 1차 평가자(개시 시 스냅샷). */
  @ApiPropertyOptional({ type: String, nullable: true })
  firstReviewerId?: string | null;

  /** 1차 평가자 총평. 체인 밖에는 노출되지 않는다(list 스코프 참조). */
  @ApiPropertyOptional({ type: String, nullable: true })
  firstComment?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  firstCommentedAt?: string | null;

  /** 본인 회신 사유(수정 0건이면 필수). */
  @ApiPropertyOptional({ type: String, nullable: true })
  memberNote?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  memberSubmittedAt?: string | null;

  /** 2차 검토자(개시 시 스냅샷). */
  @ApiPropertyOptional({ type: String, nullable: true })
  finalReviewerId?: string | null;

  /** 2차 판정 코멘트(반려 사유 포함). */
  @ApiPropertyOptional({ type: String, nullable: true })
  finalComment?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  decidedAt?: string | null;

  /** 본인 수정 제출 회차(스냅샷 라벨과 대응). */
  @ApiPropertyOptional()
  revisionRound?: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: [MidtermReviewCheckInDto] })
  kpiCheckIns!: MidtermReviewCheckInDto[];
}

// ── 보완 조치(GET/POST /action-items, PATCH :id, :id/status) ──

/** 보완 조치 1건 — ActionItemsService.toDto 와 일치. */
export class ActionItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  evaluateeId!: string;

  @ApiProperty({ type: String, nullable: true })
  evaluateeName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  kpiId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  kpiTitle!: string | null;

  @ApiProperty({ enum: ActionItemSource })
  source!: ActionItemSource;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  detail!: string | null;

  @ApiProperty()
  assigneeId!: string;

  @ApiProperty({ type: String, nullable: true })
  assigneeName!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  dueDate!: string | null;

  @ApiProperty({ enum: ActionItemStatus })
  status!: ActionItemStatus;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ type: String, nullable: true })
  createdByName!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  completionNote!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
