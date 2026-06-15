import { ApiProperty } from '@nestjs/swagger';
import { AppealStatus } from '@prisma/client';

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

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
