import { ApiProperty } from '@nestjs/swagger';
import { CycleStatus, CycleType } from '@prisma/client';

/**
 * 평가 주기 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 CyclesService(list/get/create/update/updateStatus)가 반환하는
 * EvaluationCycle 레코드와 일치.
 */
export class CycleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  year!: number;

  @ApiProperty({ format: 'date-time' })
  startDate!: string;

  @ApiProperty({ format: 'date-time' })
  endDate!: string;

  @ApiProperty({ enum: CycleStatus, enumName: 'CycleStatus' })
  status!: CycleStatus;

  @ApiProperty({ enum: CycleType, enumName: 'CycleType' })
  cycleType!: CycleType;

  @ApiProperty({ type: String, nullable: true })
  ruleSetId!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: '입사일 기준 평가 제외 기준일. 이 날짜 이후 입사자는 평가 대상에서 제외. null=제한 없음.',
  })
  hireCutoffDate!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 주기 삭제 결과 — `remove`가 봉투 내부에 담는 값. */
export class CycleDeleteResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;
}
