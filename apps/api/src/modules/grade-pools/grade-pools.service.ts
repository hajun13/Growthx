import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { ComputeGradePoolDto, ListGradePoolsQuery } from './dto/grade-pool.dto';

/**
 * 그룹 등급 풀 산정/조회.
 * 그룹 실적 tier → RuleSet.poolRatios 의 분포 상한(S/A/B/C/D)을 적용해 GradePool 생성.
 */
@Injectable()
export class GradePoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(query: ListGradePoolsQuery) {
    const where: Prisma.GradePoolWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.groupId) where.groupId = query.groupId;
    const rows = await this.prisma.gradePool.findMany({ where });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 그룹 실적 tier 기준으로 풀(분포 상한) 산정. 실적 미입력 시 400. */
  async compute(dto: ComputeGradePoolDto) {
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

    return this.prisma.gradePool.upsert({
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
    });
  }
}
