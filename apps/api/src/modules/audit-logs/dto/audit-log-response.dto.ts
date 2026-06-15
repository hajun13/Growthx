import { ApiProperty } from '@nestjs/swagger';

/**
 * 감사 로그 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 목록 봉투(@ApiOkEnvelopeArray)로 감싸진다. 값 형태는 AuditLogsService.list 반환과 일치.
 */
export class AuditLogDto {
  @ApiProperty()
  id!: string;

  /** 변경 대상 엔티티(RuleSet·EvaluationCycle·Kpi·Evaluation 등). */
  @ApiProperty()
  entity!: string;

  @ApiProperty()
  entityId!: string;

  /** 액션 식별자(rule_set.update·kpi.approve 등). */
  @ApiProperty()
  action!: string;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: '변경 전 스냅샷(자유 형태 JSON).',
  })
  before!: Record<string, unknown> | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: '변경 후 스냅샷(자유 형태 JSON).',
  })
  after!: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true, description: '행위자 사용자 ID(시스템 작업은 null).' })
  actorId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '행위자 이름(비정규화).' })
  actorName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  actorEmail!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ip!: string | null;

  @ApiProperty({ format: 'date-time' })
  at!: string;
}
