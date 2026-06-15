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
