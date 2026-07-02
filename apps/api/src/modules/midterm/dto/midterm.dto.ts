import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActionItemStatus, Grade, RebaselineRequestStatus } from '@prisma/client';

// ─────────────── 진척 점검 (progress) ───────────────

export class MidtermProgressQuery {
  @IsString()
  cycleId!: string;

  /** 대상 사용자. 미지정 시 현재 로그인 사용자. */
  @IsOptional() @IsString() userId?: string;
}

// ─────────────── 진척 점검 리뷰 (MidtermReview) ───────────────

export class ListMidtermReviewsQuery {
  @IsString()
  cycleId!: string;

  @IsOptional() @IsString() evaluateeId?: string;
}

/** KPI(지표)별 중간 자가점검 1건. (midtermReviewId, kpiId) 단위 upsert. */
export class MidtermKpiCheckInDto {
  @IsString()
  kpiId!: string;

  /** 상반기 실적/진척 자유서술(정성·정량). */
  @IsOptional() @IsString() @MaxLength(4000) selfActualText?: string;

  /** 선택 수치 진척값. */
  @IsOptional() @IsNumber() selfActualValue?: number;

  /** KPI별 자가점검 코멘트. */
  @IsOptional() @IsString() @MaxLength(4000) selfNote?: string;

  /** 선택 자가 등급(S/A/B/C/D). 참고용(등급/보상 미반영). */
  @IsOptional() @IsEnum(Grade) selfGrade?: Grade;
}

/** 본인 자가점검 제출(upsert). cycle×evaluatee(=current) 단위. */
export class SubmitMidtermSelfReviewDto {
  @IsString()
  cycleId!: string;

  @IsOptional() @IsString() @MaxLength(4000) selfNote?: string;

  /** KPI(지표)별 자가점검. 지정된 항목만 upsert(미지정 KPI는 변경 안 함). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MidtermKpiCheckInDto)
  kpiCheckIns?: MidtermKpiCheckInDto[];
}

/** 검토자 KPI별 판정 1건 — confirm/sendBack 시 함께 저장(참고용, 등급/보상 미반영). */
export class MidtermKpiReviewDto {
  @IsString()
  kpiId!: string;

  /** 수락(accepted) | 재조정 필요(rebaseline). */
  @IsOptional() @IsIn(['accepted', 'rebaseline']) decision?: 'accepted' | 'rebaseline';

  /** KPI별 검토 코멘트. */
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

/** 부서장 확인. reviewerNote 와 함께 confirmed 로 전이. */
export class ConfirmMidtermReviewDto {
  @IsOptional() @IsString() @MaxLength(4000) reviewerNote?: string;

  /** KPI별 판정·코멘트(선택). check-in 에 upsert. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MidtermKpiReviewDto)
  kpiReviews?: MidtermKpiReviewDto[];
}

/** 상급자 반려/재조정 요청. reviewerNote(사유) 필수, status 는 컨트롤러 경로로 결정. */
export class SendBackMidtermReviewDto {
  /** 반려/재조정 요청 사유(필수). reviewerNote 컬럼 재활용. */
  @IsString() @IsNotEmpty() @MaxLength(4000) reviewerNote!: string;

  /** KPI별 판정·코멘트(선택). check-in 에 upsert. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MidtermKpiReviewDto)
  kpiReviews?: MidtermKpiReviewDto[];
}

// ─────────────── 보완 조치 (ActionItem) ───────────────

export class ListActionItemsQuery {
  @IsString()
  cycleId!: string;

  @IsOptional() @IsString() evaluateeId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsEnum(ActionItemStatus) status?: ActionItemStatus;
}

export class CreateActionItemDto {
  @IsString()
  cycleId!: string;

  /** 대상 구성원(피평가자). */
  @IsString()
  evaluateeId!: string;

  /** 선택 연결 KPI. */
  @IsOptional() @IsString() kpiId?: string;

  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000) detail?: string;

  /** 담당. 미지정 시 evaluateeId 로 기본 설정(보통 본인). */
  @IsOptional() @IsString() assigneeId?: string;

  /** 이행 목표 시점(ISO 8601). */
  @IsOptional() @IsISO8601() dueDate?: string;
}

export class UpdateActionItemDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) detail?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() kpiId?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
}

/** 상태 전이(planned→in_progress→done, +canceled). done 시 completionNote 권장. */
export class TransitionActionItemDto {
  @IsEnum(ActionItemStatus)
  status!: ActionItemStatus;

  @IsOptional() @IsString() @MaxLength(4000) completionNote?: string;
}

// ─────────────── ④ 중간 KPI 목표 재조정 요청 (re-baseline workflow) ───────────────
// 본인 제안 → 부서장 검토 → 승인 시 반영. 즉시-적용(RebaselineDto)은 폐기.

/** 재조정 제안 KPI 1건의 변경 필드. 최소 1개 필드는 지정해야 의미가 있음(서비스에서 검증). */
export class RebaselineItemDto {
  @IsString()
  kpiId!: string;

  /** 새 정량 목표값. null 명시 가능(목표값 제거). 미지정(undefined)이면 변경 안 함. */
  @IsOptional() @IsNumber() targetValue?: number | null;

  /** 새 서술형 목표. null 명시 가능. 미지정이면 변경 안 함. */
  @IsOptional() @IsString() @MaxLength(2000) targetText?: string | null;

  /** 새 가중치(정수 0~100). 미지정이면 변경 안 함. */
  @IsOptional() @IsInt() @Min(0) @Max(100) weight?: number;
}

/**
 * POST /midterm/rebaseline-requests — 본인(피평가자)이 재조정을 제안·제출.
 * evaluateeId 는 보내지 않는다(서버가 current.id 로 강제). reason 필수.
 */
export class CreateRebaselineRequestDto {
  @IsString()
  cycleId!: string;

  /** 재조정 사유(필수). 요청·승인 시 AuditLog·스냅샷 라벨에 기록. */
  @IsString() @MinLength(1) @MaxLength(1000)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RebaselineItemDto)
  items!: RebaselineItemDto[];
}

/**
 * PATCH /midterm/rebaseline-requests/:id — 본인이 items/reason 수정.
 * submitted(검토 전) 또는 rejected(반려 후→재제출) 상태에서만. 둘 다 선택(부분 수정).
 */
export class UpdateRebaselineRequestDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(1000) reason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RebaselineItemDto)
  items?: RebaselineItemDto[];
}

/** PATCH /midterm/rebaseline-requests/:id/review — 부서장 검토(승인/반려). */
export class ReviewRebaselineRequestDto {
  @IsIn(['approve', 'reject'], { message: 'decision 은 approve|reject 여야 해요.' })
  decision!: 'approve' | 'reject';

  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

/** GET /midterm/rebaseline-requests — 목록 조회 쿼리. */
export class ListRebaselineRequestsQuery {
  @IsString()
  cycleId!: string;

  /** 특정 구성원 조회(가시 권한 검증). */
  @IsOptional() @IsString() evaluateeId?: string;

  /** 상태 필터(submitted/approved/rejected). */
  @IsOptional() @IsEnum(RebaselineRequestStatus) status?: RebaselineRequestStatus;

  /** 부서장 검토 큐(내가 부서장인 구성원들의 미결 요청). truthy 시 활성. */
  @IsOptional() forReview?: string | boolean;
}

/** 재조정 이력/diff 조회. */
export class RebaselineHistoryQuery {
  @IsString()
  cycleId!: string;

  @IsString()
  evaluateeId!: string;
}
