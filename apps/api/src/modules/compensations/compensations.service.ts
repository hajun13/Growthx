import { Injectable } from '@nestjs/common';
import { Grade, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  ComputeCompensationDto,
  ListCompensationsQuery,
} from './dto/compensation.dto';

/**
 * 보상 연동: 확정 등급 → 인상률(RuleSet.raiseRates). 전사 평균 ≈3% 모니터링.
 * 시뮬레이션(simulated=true) 또는 실제 연동(false).
 */
@Injectable()
export class CompensationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(current: AuthUser, query: ListCompensationsQuery) {
    const where: Prisma.CompensationWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;
    if (current.role === Role.employee) where.userId = current.id;

    const rows = await this.prisma.compensation.findMany({
      where,
      include: { user: { include: { department: true } } },
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** Compensation 행 → camelCase DTO. B-3c userName·departmentName 동봉(없으면 null). */
  private toDto(r: {
    id: string;
    userId: string;
    cycleId: string;
    finalGrade: Grade;
    raiseRate: number;
    simulated: boolean;
    createdAt: Date;
    user?: { name: string; department?: { name: string } | null } | null;
  }) {
    return {
      id: r.id,
      userId: r.userId,
      cycleId: r.cycleId,
      finalGrade: r.finalGrade,
      raiseRate: r.raiseRate,
      simulated: r.simulated,
      userName: r.user?.name ?? null,
      departmentName: r.user?.department?.name ?? null,
      createdAt: r.createdAt,
    };
  }

  /**
   * cycle 의 확정 결과 등급별 인상률 산정 + 전사 평균.
   * 결과별로 Compensation upsert 하고, 전사 평균 인상률(companyAvg)을 함께 반환.
   */
  async compute(dto: ComputeCompensationDto) {
    const simulated = dto.simulated ?? false;
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);

    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: dto.cycleId, finalGrade: { not: null } },
    });

    const rows: ReturnType<CompensationsService['toDto']>[] = [];
    let raiseSum = 0;
    for (const r of results) {
      const grade = r.finalGrade as Grade;
      const raiseRate = this.scoring.raiseRateForGrade(grade, rules.raiseRates);
      raiseSum += raiseRate;
      const comp = await this.prisma.compensation.upsert({
        where: {
          userId_cycleId_simulated: {
            userId: r.userId,
            cycleId: dto.cycleId,
            simulated,
          },
        },
        create: {
          userId: r.userId,
          cycleId: dto.cycleId,
          finalGrade: grade,
          raiseRate,
          simulated,
        },
        update: { finalGrade: grade, raiseRate },
        include: { user: { include: { department: true } } },
      });
      rows.push(this.toDto(comp));
    }

    const companyAvgRaise =
      results.length ? Math.round((raiseSum / results.length) * 100) / 100 : 0;

    return {
      data: rows,
      meta: {
        page: 1,
        pageSize: rows.length,
        total: rows.length,
        companyAvgRaise,
        // 전사 평균 ≈3% 초과 경고
        exceedsTarget: companyAvgRaise > 3,
      },
    };
  }
}
