import { ForbiddenException, Injectable } from '@nestjs/common';
import { Grade, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, isDepartmentUnder, descendantDeptIds } from '../../common/access/access.util';
import {
  ComputeCompensationDto,
  ListCompensationsQuery,
  SimulationQuery,
  TeamSimulationQuery,
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
    nextYearSalary?: number | null;
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
      nextYearSalary: r.nextYearSalary ?? null,
      simulated: r.simulated,
      userName: r.user?.name ?? null,
      departmentName: r.user?.department?.name ?? null,
      createdAt: r.createdAt,
    };
  }

  /**
   * cycle 의 확정 결과 등급별 인상률 산정 + 전사 평균.
   * 결과별로 Compensation upsert 하고, 전사 평균 인상률(companyAvg)을 함께 반환.
   * groupTierBonus 반영 + nextYearSalary 계산.
   */
  async compute(dto: ComputeCompensationDto) {
    const simulated = dto.simulated ?? false;
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    const weightPolicy = (rules.weightPolicy as any);
    const groupTierBonus = weightPolicy?.groupTierBonus ?? { excellent: 2, standard: 0, poor: -1 };

    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: dto.cycleId, finalGrade: { not: null } },
    });

    // 건별 upsert 를 단일 트랜잭션으로 묶어 중간 실패 시 부분 커밋·잘못된 평균을 방지.
    const { rows, raiseSum } = await this.prisma.$transaction(async (tx) => {
      const rows: ReturnType<CompensationsService['toDto']>[] = [];
      let raiseSum = 0;
      for (const r of results) {
        const grade = r.finalGrade as Grade;
        let raiseRate = this.scoring.raiseRateForGrade(grade, rules.raiseRates);

        // groupTierBonus: 해당 user 의 그룹 GroupPerformance.tier 조회 → 보너스 합산
        const user = await tx.user.findUnique({
          where: { id: r.userId },
          select: { currentSalary: true, departmentId: true },
        });
        if (user?.departmentId) {
          // 최상위 group 부서 ID 찾기 (사용자 부서 또는 상위 group)
          const groupPerf = await tx.groupPerformance.findFirst({
            where: { cycleId: dto.cycleId },
            orderBy: { createdAt: 'asc' },
          });
          if (groupPerf) {
            const tierKey = groupPerf.tier as string; // 'excellent' | 'standard' | 'poor'
            const bonus = groupTierBonus[tierKey] ?? 0;
            raiseRate = raiseRate + bonus;
          }
        }

        // nextYearSalary 계산
        const nextYearSalary =
          user?.currentSalary != null
            ? Math.round(user.currentSalary * (1 + raiseRate / 100))
            : null;

        raiseSum += raiseRate;
        const comp = await tx.compensation.upsert({
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
            nextYearSalary,
            simulated,
          },
          update: { finalGrade: grade, raiseRate, nextYearSalary },
          include: { user: { include: { department: true } } },
        });
        rows.push(this.toDto(comp));
      }
      return { rows, raiseSum };
    });

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

  // ─────────────── M3 Item 8: 연봉 시뮬레이션 ───────────────

  /**
   * 개인 연봉 시뮬레이션. 현재 연봉 + 확정/예상 등급 → 인상률 → 예상 내년 연봉.
   * 등급별 비교(S/A/B/C/D 일 때 각각 얼마)도 함께 반환(슬라이더용).
   * 본인은 자기 것만, 관리자/부서장/팀장은 가시 범위 내.
   */
  async simulation(current: AuthUser, query: SimulationQuery) {
    const userId =
      current.role === Role.employee ? current.id : query.userId ?? current.id;
    if (userId !== current.id) {
      const allowed = await canViewUser(this.prisma, current, userId);
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '연봉 시뮬레이션 조회 권한이 없어요.',
        });
      }
    }
    const rules = await this.scoring.loadRuleSetForCycle(query.cycleId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    const result = await this.prisma.evaluationResult.findUnique({
      where: { userId_cycleId: { userId, cycleId: query.cycleId } },
    });
    const data = this.buildSimulation(
      query.cycleId,
      {
        id: userId,
        name: user?.name ?? null,
        departmentName: user?.department?.name ?? null,
        currentSalary: user?.currentSalary ?? null,
        currentGrade: result?.finalGrade ?? null,
      },
      rules.raiseRates,
    );
    return { data };
  }

  /**
   * 팀/부서 연봉 영향 시뮬레이션(관리자·부서장). departmentId 하위 트리 전원.
   * departmentId 미지정 시 hr_admin=전체, 부서장=본인 본부.
   */
  async simulationTeam(current: AuthUser, query: TeamSimulationQuery) {
    let deptId = query.departmentId;
    if (!deptId) {
      if (current.role === Role.hr_admin) {
        deptId = undefined; // 전체
      } else {
        // 소속 부서 없는 비관리자는 조회 불가(전사 데이터 노출 방지).
        if (current.departmentId == null) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: '소속 부서가 없어 팀 시뮬레이션을 조회할 수 없어요.',
          });
        }
        deptId = current.departmentId;
      }
    } else if (current.role !== Role.hr_admin) {
      // 부서장/팀장은 본인 부서 하위 트리에 속한 부서만.
      const within = await isDepartmentUnder(this.prisma, deptId, current.departmentId);
      if (!within && deptId !== current.departmentId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '해당 부서 시뮬레이션 조회 권한이 없어요.',
        });
      }
    }

    const deptIds = deptId
      ? await descendantDeptIds(this.prisma, deptId)
      : null;

    const users = await this.prisma.user.findMany({
      where: deptIds ? { departmentId: { in: deptIds } } : {},
      include: { department: true },
    });
    const rules = await this.scoring.loadRuleSetForCycle(query.cycleId);
    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: query.cycleId },
    });
    const gradeByUser = new Map(results.map((r) => [r.userId, r.finalGrade]));

    const rows = users.map((u) =>
      this.buildSimulation(
        query.cycleId,
        {
          id: u.id,
          name: u.name,
          departmentName: u.department?.name ?? null,
          currentSalary: u.currentSalary ?? null,
          currentGrade: gradeByUser.get(u.id) ?? null,
        },
        rules.raiseRates,
      ),
    );

    // 합계(현재 연봉 입력된 인원 기준).
    const withSalary = rows.filter((r) => r.currentSalary != null);
    const totalCurrent = withSalary.reduce((s, r) => s + (r.currentSalary ?? 0), 0);
    const totalProjected = withSalary.reduce(
      (s, r) => s + (r.projectedSalary ?? 0),
      0,
    );

    return {
      data: rows,
      meta: {
        page: 1,
        pageSize: rows.length,
        total: rows.length,
        totalCurrentSalary: Math.round(totalCurrent),
        totalProjectedSalary: Math.round(totalProjected),
        totalIncrease: Math.round(totalProjected - totalCurrent),
      },
    };
  }

  /** 등급 → 인상률 → 예상 연봉 + 등급별 비교 슬라이더 데이터. */
  private buildSimulation(
    cycleId: string,
    u: {
      id: string;
      name: string | null;
      departmentName: string | null;
      currentSalary: number | null;
      currentGrade: Grade | null;
    },
    raiseRates: Record<Grade, number>,
  ) {
    const grades: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];
    const project = (grade: Grade): number | null => {
      if (u.currentSalary == null) return null;
      const rate = this.scoring.raiseRateForGrade(grade, raiseRates);
      return Math.round(u.currentSalary * (1 + rate / 100));
    };
    const raiseRate =
      u.currentGrade != null
        ? this.scoring.raiseRateForGrade(u.currentGrade, raiseRates)
        : null;
    return {
      userId: u.id,
      userName: u.name,
      departmentName: u.departmentName,
      cycleId,
      currentSalary: u.currentSalary,
      currentGrade: u.currentGrade,
      raiseRate,
      projectedSalary: u.currentGrade != null ? project(u.currentGrade) : null,
      byGrade: grades.map((grade) => ({
        grade,
        raiseRate: this.scoring.raiseRateForGrade(grade, raiseRates),
        projectedSalary: project(grade),
      })),
    };
  }

}
