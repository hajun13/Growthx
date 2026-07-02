import { ApiProperty } from '@nestjs/swagger';
import { AppealDecisionType, AppealStatus, Grade } from '@prisma/client';

/**
 * 이의제기 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 *
 * 값 형태는 AppealsService.list 의 enrich() 반환과 일치
 * (userName·departmentName 비정규화 포함). 목록 화면이 소비.
 */
export class AppealDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  resultId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: AppealStatus, enumName: 'AppealStatus' })
  status!: AppealStatus;

  /** 부서장 1차 답변(미답변 시 null). */
  @ApiProperty({ type: String, nullable: true })
  response!: string | null;

  @ApiProperty({ type: String, nullable: true })
  respondedById!: string | null;

  /** HR 최종 결정 사유(미결정 시 null). */
  @ApiProperty({ type: String, nullable: true })
  decision!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedById!: string | null;

  /** 3B-3: 구조화된 결정 유형(미결정 시 null). */
  @ApiProperty({
    enum: AppealDecisionType,
    enumName: 'AppealDecisionType',
    nullable: true,
  })
  decisionType!: AppealDecisionType | null;

  /** score_adjust 시 적용한 새 총점(그 외 null). */
  @ApiProperty({ type: Number, nullable: true })
  newScore!: number | null;

  /** grade_adjust 시 적용한 새 등급(그 외 null). */
  @ApiProperty({ enum: Grade, enumName: 'Grade', nullable: true })
  newGrade!: Grade | null;

  /** 진행단계: 검토 시작 시각(미착수 null). */
  @ApiProperty({ format: 'date-time', nullable: true })
  reviewStartedAt!: string | null;

  /** 진행단계: 부서장 답변 시각(미답변 null). */
  @ApiProperty({ format: 'date-time', nullable: true })
  respondedAt!: string | null;

  /** 진행단계: HR 결정 시각(미결정 null). */
  @ApiProperty({ format: 'date-time', nullable: true })
  decidedAt!: string | null;

  /** 비정규화 — 신청자 이름(없으면 null). */
  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  /** 비정규화 — 신청자 소속 부서명(없으면 null). */
  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * 이의제기 첨부 메타데이터 DTO (바이트 제외).
 * 업로드 응답·목록 조회에서 사용. 다운로드는 별도 바이너리 응답.
 */
export class AppealAttachmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  appealId!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  uploadedById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/**
 * 단일 이의제기 레코드 DTO — create/respond/decide mutation 응답.
 * 서비스가 Prisma Appeal 레코드를 그대로 반환하므로 비정규화 필드
 * (userName·departmentName)는 없다.
 */
export class AppealRecordDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  resultId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: AppealStatus, enumName: 'AppealStatus' })
  status!: AppealStatus;

  @ApiProperty({ type: String, nullable: true })
  response!: string | null;

  @ApiProperty({ type: String, nullable: true })
  respondedById!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decision!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedById!: string | null;

  @ApiProperty({
    enum: AppealDecisionType,
    enumName: 'AppealDecisionType',
    nullable: true,
  })
  decisionType!: AppealDecisionType | null;

  @ApiProperty({ type: Number, nullable: true })
  newScore!: number | null;

  @ApiProperty({ enum: Grade, enumName: 'Grade', nullable: true })
  newGrade!: Grade | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  reviewStartedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  respondedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
