import { ApiProperty } from '@nestjs/swagger';

/**
 * 알림 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다. 값 형태는 NotificationsService 반환과 일치.
 */
export class NotificationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  /** 알림 유형(deadline_d7·kpi_rejected 등 트리거 문자열). */
  @ApiProperty()
  type!: string;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: 'message·cycleId 등 자유 payload',
  })
  payload!: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  readAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** 미읽음 카운트(뱃지). */
export class UnreadCountDto {
  @ApiProperty()
  count!: number;
}

/** 모두 읽음 처리 결과. */
export class MarkAllReadResultDto {
  @ApiProperty()
  updated!: number;
}

/** HR 테스트 발송 결과. mode: smtp(실발송)·console(폴백)·allowlist-skip·error. */
export class TestMailResultDto {
  @ApiProperty()
  to!: string;

  @ApiProperty({ description: 'SMTP 실발송 성공 여부' })
  sent!: boolean;

  @ApiProperty({ description: '발송 경로', enum: ['smtp', 'console', 'allowlist-skip', 'error'] })
  mode!: string;

  @ApiProperty({ description: 'SMTP_HOST·PORT 설정으로 발송이 활성화됐는지' })
  smtpEnabled!: boolean;
}
