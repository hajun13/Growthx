import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import { groupRootOf } from '../../common/access/access.util';
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

  async list(current: AuthUser, query: ListGroupPerformanceQuery) {
    const where: Prisma.GroupPerformanceWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.groupId) where.groupId = query.groupId;

    // 소속 검증: 비 hr_admin(또는 company scope 아님)은 본인 소속 그룹 실적만 조회.
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const ownGroupId = current.departmentId
        ? await groupRootOf(this.prisma, current.departmentId)
        : null;
      where.groupId = ownGroupId ?? '__none__';
    }

    if (query.cycleId) {
      const sourceGroupIds = await this.syncVisibleMonthlySources(
        query.cycleId,
        where.groupId,
      );
      if (sourceGroupIds.length === 0) {
        return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
      }
      where.groupId = { in: sourceGroupIds };
    }

    const rows = await this.prisma.groupPerformance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /**
   * 월별 실적(MonthlyPerformance)을 그룹 실적의 원천으로 사용한다.
   * seed/수동 GroupPerformance 값이 남아 있어도 조회·등급풀 산정 직전에 실제 월별 입력값으로 맞춘다.
   */
  async syncFromMonthlyPerformance(cycleId: string, groupId: string) {
    const aggregate = await this.aggregateMonthlyPerformance(cycleId, groupId);
    if (!aggregate) {
      await this.prisma.groupPerformance.deleteMany({ where: { cycleId, groupId } });
      return null;
    }

    return this.prisma.groupPerformance.upsert({
      where: { groupId_cycleId: { groupId, cycleId } },
      create: {
        groupId,
        cycleId,
        revenue: aggregate.revenue,
        orders: null,
        profit: aggregate.profit,
        achievementRate: aggregate.achievementRate,
        tier: aggregate.tier,
      },
      update: {
        revenue: aggregate.revenue,
        orders: null,
        profit: aggregate.profit,
        achievementRate: aggregate.achievementRate,
        tier: aggregate.tier,
      },
    });
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
    // 갭#1: tier 경계를 RuleSet(weightPolicy.groupTierThresholds)에서 읽어 적용(폴백 {100,90}).
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    const tier = this.scoring.achievementRateToTier(
      dto.achievementRate,
      rules.weightPolicy.groupTierThresholds ?? null,
    );

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

  private async syncVisibleMonthlySources(
    cycleId: string,
    groupFilter: Prisma.GroupPerformanceWhereInput['groupId'],
  ): Promise<string[]> {
    let groupIds: string[];
    if (typeof groupFilter === 'string') {
      groupIds = [groupFilter];
    } else if (
      groupFilter &&
      typeof groupFilter === 'object' &&
      'in' in groupFilter &&
      Array.isArray(groupFilter.in)
    ) {
      groupIds = groupFilter.in.filter((id): id is string => typeof id === 'string');
    } else {
      const groups = await this.prisma.department.findMany({
        where: { type: 'group' },
        select: { id: true },
      });
      groupIds = groups.map((group) => group.id);
    }

    const syncedIds: string[] = [];
    for (const groupId of groupIds) {
      const synced = await this.syncFromMonthlyPerformance(cycleId, groupId);
      if (synced) syncedIds.push(groupId);
    }
    return syncedIds;
  }

  private async aggregateMonthlyPerformance(cycleId: string, groupId: string) {
    const group = await this.prisma.department.findUnique({
      where: { id: groupId },
      select: { type: true },
    });
    if (group?.type !== 'group') return null;

    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { year: true },
    });
    if (!cycle) return null;

    // 집계=final: 그룹 실적 tier(등급 풀 산정 원천)는 확정(final) 월별 실적만 반영.
    // draft(임시저장)는 제외 — 미확정 실적이 등급 풀 상한에 새지 않게.
    const rows = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId, departmentId: groupId, year: cycle.year, month: { gte: 1 }, status: 'final' },
      select: { targetAmount: true, actualAmount: true, costActual: true },
    });
    if (rows.length === 0) return null;

    const revenueTarget = rows.reduce((sum, row) => sum + row.targetAmount, 0);
    const revenueActual = rows.reduce((sum, row) => sum + row.actualAmount, 0);
    const hasCost = rows.some((row) => row.costActual !== null);
    const costActual = rows.reduce((sum, row) => sum + (row.costActual ?? 0), 0);
    const hasMeaningfulInput =
      revenueTarget !== 0 ||
      revenueActual !== 0 ||
      rows.some((row) => (row.costActual ?? 0) !== 0);
    if (!hasMeaningfulInput) return null;

    const achievementRate =
      revenueTarget > 0 ? Math.round((revenueActual / revenueTarget) * 1000) / 10 : 0;
    const profit =
      hasCost && revenueActual > 0
        ? Math.round(((revenueActual - costActual) / revenueActual) * 1000) / 10
        : null;
    const rules = await this.scoring.loadRuleSetForCycle(cycleId);
    const tier = this.scoring.achievementRateToTier(
      achievementRate,
      rules.weightPolicy.groupTierThresholds ?? null,
    );

    return { revenue: revenueActual, profit, achievementRate, tier };
  }

  /**
   * M3 Item 10: 본인 소속 그룹의 목표/실적(읽기 전용).
   * 사용자 부서 → 최상위 group 으로 상향 탐색 후 해당 그룹의 GroupPerformance 반환.
   */
  async myGroup(current: AuthUser, cycleId: string) {
    if (!current.departmentId) {
      return { data: { groupId: null, groupName: null, cycleId, performance: null } };
    }
    const groupId = await this.resolveGroupId(current.departmentId);
    if (!groupId) {
      return { data: { groupId: null, groupName: null, cycleId, performance: null } };
    }
    const group = await this.prisma.department.findUnique({ where: { id: groupId } });
    const perf = await this.prisma.groupPerformance.findUnique({
      where: { groupId_cycleId: { groupId, cycleId } },
    });
    return {
      data: {
        groupId,
        groupName: group?.name ?? null,
        cycleId,
        performance: perf
          ? {
              revenue: perf.revenue,
              orders: perf.orders,
              profit: perf.profit,
              achievementRate: perf.achievementRate,
              tier: perf.tier,
            }
          : null,
      },
    };
  }

  /** 부서 → 최상위 group 부서 id (없으면 null). */
  private async resolveGroupId(deptId: string): Promise<string | null> {
    let cursor: string | null = deptId;
    for (let i = 0; i < 10 && cursor; i++) {
      const dept = await this.prisma.department.findUnique({ where: { id: cursor } });
      if (!dept) return null;
      if (dept.type === 'group') return dept.id;
      cursor = dept.parentId;
    }
    return null;
  }
}
