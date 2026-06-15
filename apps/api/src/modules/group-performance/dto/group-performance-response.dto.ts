import { ApiProperty } from '@nestjs/swagger';
import { GroupTier } from '@prisma/client';

/**
 * 그룹 실적 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 GroupPerformanceService.list/upsert 반환(Prisma GroupPerformance 행)과 일치.
 */
export class GroupPerformanceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  cycleId!: string;

  /** 매출액(억). 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  revenue!: number | null;

  /** 수주(억). 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  orders!: number | null;

  /** 이익률(%). 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  profit!: number | null;

  /** 그룹 실적 달성률(%). */
  @ApiProperty()
  achievementRate!: number;

  /** 달성률로 백엔드가 분류한 그룹 tier. */
  @ApiProperty({ enum: GroupTier, enumName: 'GroupTier' })
  tier!: GroupTier;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
