import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradePool, Grade, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { ComputeGradePoolDto, ListGradePoolsQuery } from './dto/grade-pool.dto';

/**
 * 그룹 등급 풀 산정/조회.
 * 그룹 실적 tier → RuleSet.poolRatios 의 분포 상한(S/A/B/C/D)을 적용해 GradePool 생성.
 * B-3b: 응답에 headcount(그룹 정원) + 등급별 절대 상한 caps:Record<Grade,number> 동봉.
 */
@Injectable()
export class GradePoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListGradePoolsQuery) {
    const where: Prisma.GradePoolWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.groupId) where.groupId = query.groupId;
    const rows = await this.prisma.gradePool.findMany({
      where,
      include: { group: true },
    });
    const data = await Promise.all(rows.map((r) => this.toDto(r)));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** 그룹 실적 tier 기준으로 풀(분포 상한) 산정. 실적 미입력 시 400. */
  async compute(dto: ComputeGradePoolDto, actor?: AuthUser) {
    const perf = await this.prisma.groupPerformance.findUnique({
      where: { groupId_cycleId: { groupId: dto.groupId, cycleId: dto.cycleId } },
    });
    if (!perf) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '그룹 실적을 먼저 입력해야 풀을 산정할 수 있어요.',
      });
    }
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    const row = rules.poolRatios[perf.tier];
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '해당 tier 의 풀 비율을 찾을 수 없어요.',
      });
    }

    const pool = await this.prisma.gradePool.upsert({
      where: { cycleId_groupId: { cycleId: dto.cycleId, groupId: dto.groupId } },
      create: {
        cycleId: dto.cycleId,
        groupId: dto.groupId,
        tier: perf.tier,
        sRatio: row.S,
        aRatio: row.A,
        bRatio: row.B,
        cRatio: row.C,
        dRatio: row.D,
      },
      update: {
        tier: perf.tier,
        sRatio: row.S,
        aRatio: row.A,
        bRatio: row.B,
        cRatio: row.C,
        dRatio: row.D,
      },
      include: { group: true },
    });

    await this.audit.record({
      entity: 'GradePool',
      entityId: pool.id,
      action: 'grade_pool.compute',
      actorId: actor?.id,
      after: { tier: pool.tier, ratios: row },
    });

    return this.toDto(pool);
  }

  /** GradePool + headcount + 절대 caps 동봉(B-3b). */
  private async toDto(pool: GradePool & { group?: { name: string } | null }) {
    const headcount = await this.countGroupMembers(pool.groupId);
    const caps: Record<Grade, number> = {
      S: Math.ceil((pool.sRatio / 100) * headcount),
      A: Math.ceil((pool.aRatio / 100) * headcount),
      B: Math.ceil((pool.bRatio / 100) * headcount),
      C: Math.ceil((pool.cRatio / 100) * headcount),
      D: Math.ceil((pool.dRatio / 100) * headcount),
    };
    return {
      id: pool.id,
      cycleId: pool.cycleId,
      groupId: pool.groupId,
      groupName: pool.group?.name ?? null,
      tier: pool.tier,
      sRatio: pool.sRatio,
      aRatio: pool.aRatio,
      bRatio: pool.bRatio,
      cRatio: pool.cRatio,
      dRatio: pool.dRatio,
      headcount,
      caps,
    };
  }

  /** group 하위 트리(division·team)에 속한 사용자 수. */
  private async countGroupMembers(groupId: string): Promise<number> {
    const deptIds = [groupId];
    let frontier = [groupId];
    for (let depth = 0; depth < 5 && frontier.length; depth++) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      deptIds.push(...childIds);
      frontier = childIds;
    }
    return this.prisma.user.count({ where: { departmentId: { in: deptIds } } });
  }
}
