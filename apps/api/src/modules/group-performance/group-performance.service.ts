import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import {
  ListGroupPerformanceQuery,
  UpsertGroupPerformanceDto,
} from './dto/group-performance.dto';

/**
 * 그룹 실적 입력 + tier 자동 분류 (excellent/standard/poor).
 * tier 는 그룹 실적 달성률로 ScoringService 가 분류한다(business-rules §3).
 */
@Injectable()
export class GroupPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(query: ListGroupPerformanceQuery) {
    const where: Prisma.GroupPerformanceWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.groupId) where.groupId = query.groupId;
    const rows = await this.prisma.groupPerformance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 그룹 실적 입력(upsert). 달성률 → tier 분류. */
  async upsert(dto: UpsertGroupPerformanceDto) {
    const group = await this.prisma.department.findUnique({ where: { id: dto.groupId } });
    if (!group || group.type !== 'group') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '그룹(group) 타입 조직만 실적을 입력할 수 있어요.',
      });
    }
    const tier = this.scoring.achievementRateToTier(dto.achievementRate);

    return this.prisma.groupPerformance.upsert({
      where: { groupId_cycleId: { groupId: dto.groupId, cycleId: dto.cycleId } },
      create: {
        groupId: dto.groupId,
        cycleId: dto.cycleId,
        revenue: dto.revenue ?? null,
        orders: dto.orders ?? null,
        profit: dto.profit ?? null,
        achievementRate: dto.achievementRate,
        tier,
      },
      update: {
        revenue: dto.revenue ?? null,
        orders: dto.orders ?? null,
        profit: dto.profit ?? null,
        achievementRate: dto.achievementRate,
        tier,
      },
    });
  }
}
