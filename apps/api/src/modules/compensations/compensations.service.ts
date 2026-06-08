import { ForbiddenException, Injectable } from '@nestjs/common';
import { DepartmentType, Grade, GroupTier, Prisma, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { assertFinalStage } from '../../common/state/cycle-stage';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  isDepartmentUnder,
  descendantDeptIds,
  visibleDeptIds,
  groupRootOf,
} from '../../common/access/access.util';
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
/** groupTierBonus 미설정 시 기본값(business-rules §5, 2026 seed). */
const DEFAULT_GROUP_TIER_BONUS: Record<'excellent' | 'standard' | 'poor', number> = {
  excellent: 2,
  standard: 0,
  poor: -1,
};

@Injectable()
export class CompensationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  // ─────────────── YoY2: 전년도 연봉 자동 파생 ───────────────

  /**
   * 단일 user 의 전년도 연봉을 직전 사이클 누적 기록에서 파생.
   * 우선순위: 직전 사이클(simulated=false Compensation 존재 & year<현재) 의 baseSalary →
   *           그 Compensation 의 nextYearSalary(이월) → User.previousSalary(수기 fallback) → null.
   * @param currentCycleYear 현재(조회 대상) 사이클 연도. 그보다 작은 최대 year 사이클을 직전으로 본다.
   */
  private async derivePreviousSalary(
    userId: string,
    currentCycleYear: number,
    manualFallback: number | null | undefined,
  ): Promise<{ value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }> {
    const prior = await this.prisma.compensation.findFirst({
      where: {
        userId,
        simulated: false,
        cycle: { year: { lt: currentCycleYear } },
      },
      orderBy: { cycle: { year: 'desc' } },
      select: { baseSalary: true, nextYearSalary: true },
    });
    return this.resolvePrevSalary(prior, manualFallback);
  }

  /**
   * 직전 사이클 Compensation(없으면 null) + 수기 fallback 으로 전년도 연봉을 결정.
   * derivePreviousSalary(단건) 와 deriveTeamMap(일괄)이 공유하는 우선순위 로직.
   */
  private resolvePrevSalary(
    prior: { baseSalary: number | null; nextYearSalary: number | null } | null,
    manualFallback: number | null | undefined,
  ): { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' } {
    if (prior?.baseSalary != null) return { value: prior.baseSalary, source: 'derived' };
    if (prior?.nextYearSalary != null) return { value: prior.nextYearSalary, source: 'carryover' };
    if (manualFallback != null) return { value: Math.round(manualFallback), source: 'manual' };
    return { value: null, source: 'none' };
  }

  /**
   * 다수 user 의 전년도 연봉을 일괄 파생(N+1 방지).
   * 직전 사이클 1회 탐색(year<현재 중 최대, simulated=false Compensation 존재) → 그 사이클 Compensation 일괄 조회 → userId 맵.
   * 직전 사이클이 여럿(서로 다른 user 가 다른 직전 사이클을 가질 수 있음)일 수 있으므로 user별 최신 직전 Compensation 을 한 번에 조회.
   * @returns userId → { value, source } 맵.
   */
  private async deriveTeamPrevSalaryMap(
    userIds: string[],
    currentCycleYear: number,
    manualByUser: Map<string, number | null | undefined>,
  ): Promise<Map<string, { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }>> {
    const map = new Map<string, { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }>();
    if (!userIds.length) return map;

    // user별 직전(year<현재) simulated=false Compensation 을 한 번에 조회(연도 내림차순) → 첫 행만 채택.
    const priors = await this.prisma.compensation.findMany({
      where: {
        userId: { in: userIds },
        simulated: false,
        cycle: { year: { lt: currentCycleYear } },
      },
      orderBy: { cycle: { year: 'desc' } },
      select: { userId: true, baseSalary: true, nextYearSalary: true },
    });
    const priorByUser = new Map<string, { baseSalary: number | null; nextYearSalary: number | null }>();
    for (const p of priors) {
      if (!priorByUser.has(p.userId)) {
        priorByUser.set(p.userId, { baseSalary: p.baseSalary, nextYearSalary: p.nextYearSalary });
      }
    }
    for (const uid of userIds) {
      map.set(uid, this.resolvePrevSalary(priorByUser.get(uid) ?? null, manualByUser.get(uid)));
    }
    return map;
  }

  /** cycleId → year 조회(파생 기준 연도). 없으면 null. */
  private async cycleYearOf(cycleId: string): Promise<number | null> {
    const c = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { year: true },
    });
    return c?.year ?? null;
  }

  /**
   * 최종 적용 인상률 하한 0%(음수 보너스로 연봉 삭감 방지).
   * grade 인상률 + tierBonus 합산값이 음수면 0으로 클램프. 표시용 groupTierBonus 자체는 음수 유지.
   */
  private clampRaiseRate(rate: number): number {
    return Math.max(0, rate);
  }

  /** weightPolicy 에서 groupTierBonus 맵을 읽는다(미설정 시 기본값). */
  private groupTierBonusMap(weightPolicy: unknown): Record<string, number> {
    const wp = weightPolicy as { groupTierBonus?: Record<string, number> } | null;
    return { ...DEFAULT_GROUP_TIER_BONUS, ...(wp?.groupTierBonus ?? {}) };
  }

  /**
   * 사용자 부서 → 최상위 그룹의 GroupPerformance.tier 와 그 보너스(%)를 산출.
   * departmentId 없거나 그룹 실적 미입력 시 { tier:null, bonus:0 }.
   * @param tierBonus  weightPolicy.groupTierBonus 맵(groupTierBonusMap 결과). 호출부에서 재사용.
   * @param tx         트랜잭션 클라이언트(없으면 this.prisma).
   */
  private async groupTierFor(
    cycleId: string,
    departmentId: string | null | undefined,
    tierBonus: Record<string, number>,
    tx?: Prisma.TransactionClient,
  ): Promise<{ tier: GroupTier | null; bonus: number }> {
    if (!departmentId) return { tier: null, bonus: 0 };
    const client = (tx ?? this.prisma) as PrismaService;
    const groupId = await groupRootOf(client, departmentId);
    if (!groupId) return { tier: null, bonus: 0 };
    const groupPerf = await client.groupPerformance.findFirst({
      where: { cycleId, groupId },
    });
    if (!groupPerf) return { tier: null, bonus: 0 };
    const tier = groupPerf.tier as GroupTier;
    const bonus = tierBonus[tier as string] ?? 0;
    return { tier, bonus };
  }

  async list(current: AuthUser, query: ListCompensationsQuery) {
    const where: Prisma.CompensationWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;

    // 행 수준 스코프(보상은 민감):
    //  - employee: 본인만.
    //  - hr_admin / company scope: 전체.
    //  - 그 외(division_head/team_lead): 본인 OR 가시 부서 소속 사용자.
    if (current.role === Role.employee) {
      where.userId = current.id;
    } else if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null) {
        const userOr: Prisma.UserWhereInput[] = [{ id: current.id }];
        if (deptIds.length) userOr.push({ departmentId: { in: deptIds } });
        where.user = { OR: userOr };
      }
    }

    const rows = await this.prisma.compensation.findMany({
      where,
      include: { user: { include: { department: true } } },
    });

    // 전년도 연봉 파생: 행마다 그 행의 사이클 연도 기준 직전 사이클 baseSalary 등으로 파생.
    // 사이클별로 묶어 deriveTeamPrevSalaryMap 1회씩 호출(N+1 방지).
    const cycleYearCache = new Map<string, number | null>();
    const prevByRow = new Map<string, { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }>();
    const byCycle = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byCycle.get(r.cycleId) ?? [];
      arr.push(r);
      byCycle.set(r.cycleId, arr);
    }
    for (const [cycleId, cycleRows] of byCycle) {
      let year = cycleYearCache.get(cycleId);
      if (year === undefined) {
        year = await this.cycleYearOf(cycleId);
        cycleYearCache.set(cycleId, year);
      }
      const userIds = cycleRows.map((r) => r.userId);
      const manualByUser = new Map<string, number | null | undefined>(
        cycleRows.map((r) => [r.userId, r.user?.previousSalary ?? null]),
      );
      const derived = year != null
        ? await this.deriveTeamPrevSalaryMap(userIds, year, manualByUser)
        : new Map<string, { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }>();
      for (const r of cycleRows) {
        prevByRow.set(
          r.id,
          derived.get(r.userId) ?? this.resolvePrevSalary(null, r.user?.previousSalary ?? null),
        );
      }
    }

    const data = rows.map((r) => {
      const prev = prevByRow.get(r.id) ?? { value: null, source: 'none' as const };
      return this.toDto(r, prev);
    });
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * Compensation 행 → camelCase DTO. B-3c userName·departmentName 동봉(없으면 null).
   * @param prev YoY2: 파생된 전년도 연봉(value)·출처(source). 미지정 시 'none'.
   */
  private toDto(
    r: {
      id: string;
      userId: string;
      cycleId: string;
      finalGrade: Grade;
      raiseRate: number;
      baseSalary?: number | null;
      nextYearSalary?: number | null;
      simulated: boolean;
      createdAt: Date;
      user?: { name: string; department?: { name: string } | null } | null;
    },
    prev?: { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' },
  ) {
    return {
      id: r.id,
      userId: r.userId,
      cycleId: r.cycleId,
      finalGrade: r.finalGrade,
      raiseRate: r.raiseRate,
      baseSalary: r.baseSalary ?? null,
      nextYearSalary: r.nextYearSalary ?? null,
      // YoY2: previousSalary 는 누적 직전 사이클에서 파생(수기 fallback). source 로 출처 표시.
      previousSalary: prev?.value ?? null,
      previousSalarySource: prev?.source ?? 'none',
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
    // Model B 게이팅: 중간 점검(mid_review) 등 비최종 단계에서는 보상 산정 차단.
    await assertFinalStage(
      this.prisma,
      dto.cycleId,
      '최종평가(조정/완료) 단계에서만 등급·보상을 산정할 수 있어요.',
    );
    const simulated = dto.simulated ?? false;
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    const tierBonusMap = this.groupTierBonusMap(rules.weightPolicy);

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

        // groupTierBonus: 해당 user 의 정확한 그룹 GroupPerformance.tier 조회 → 보너스 합산
        const user = await tx.user.findUnique({
          where: { id: r.userId },
          select: { currentSalary: true, departmentId: true },
        });
        const { bonus } = await this.groupTierFor(
          dto.cycleId,
          user?.departmentId,
          tierBonusMap,
          tx,
        );
        // 인상률 하한 0%(음수 보너스로 연봉 삭감 방지). 저장되는 raiseRate·nextYearSalary 모두 클램프 값 기준.
        raiseRate = this.clampRaiseRate(raiseRate + bonus);

        // YoY2: 이 사이클의 연봉 산정 기준 = 그 시점 currentSalary. 다음 사이클이 전년도연봉으로 읽어감(체이닝).
        const baseSalary =
          user?.currentSalary != null ? Math.round(user.currentSalary) : null;

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
            baseSalary,
            nextYearSalary,
            simulated,
          },
          update: { finalGrade: grade, raiseRate, baseSalary, nextYearSalary },
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
      include: { department: { include: { parent: true } } },
    });
    const result = await this.prisma.evaluationResult.findUnique({
      where: { userId_cycleId: { userId, cycleId: query.cycleId } },
    });
    const tierBonusMap = this.groupTierBonusMap(rules.weightPolicy);
    const { tier, bonus } = await this.groupTierFor(
      query.cycleId,
      user?.departmentId,
      tierBonusMap,
    );
    // YoY2: 전년도 연봉을 직전 사이클 누적에서 파생(수기 fallback).
    const cycleYear = await this.cycleYearOf(query.cycleId);
    const prev = cycleYear != null
      ? await this.derivePreviousSalary(userId, cycleYear, user?.previousSalary ?? null)
      : this.resolvePrevSalary(null, user?.previousSalary ?? null);
    const data = this.buildSimulation(
      query.cycleId,
      {
        id: userId,
        name: user?.name ?? null,
        departmentName: user?.department?.name ?? null,
        currentSalary: user?.currentSalary ?? null,
        currentGrade: result?.finalGrade ?? null,
        position: user?.position ?? null,
        previousSalary: prev.value,
        previousSalarySource: prev.source,
        divisionName: this.divisionNameOf(user?.department),
        teamName: this.teamNameOf(user?.department),
      },
      rules.raiseRates,
      bonus,
      tier,
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

    // 재직자만 예산 합계에 포함(퇴사자/비활성자 제외). deptIds 가 null(hr_admin 전체)이어도 재직 필터는 항상 적용.
    // comparison·excel 모듈과 동일하게 isActive=true 컨벤션 사용(퇴사 처리 시 isActive=false 로 내려감).
    const users = await this.prisma.user.findMany({
      where: deptIds
        ? { isActive: true, departmentId: { in: deptIds } }
        : { isActive: true },
      include: { department: { include: { parent: true } } },
    });
    const rules = await this.scoring.loadRuleSetForCycle(query.cycleId);
    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: query.cycleId },
    });
    const gradeByUser = new Map(results.map((r) => [r.userId, r.finalGrade]));

    // 그룹 tier 보너스: 그룹 실적을 1회 조회해 groupId→tier 맵으로 캐시(N+1 방지).
    const tierBonusMap = this.groupTierBonusMap(rules.weightPolicy);
    const groupPerfs = await this.prisma.groupPerformance.findMany({
      where: { cycleId: query.cycleId },
    });
    const tierByGroup = new Map<string, GroupTier>(
      groupPerfs.map((gp) => [gp.groupId, gp.tier as GroupTier]),
    );
    // departmentId→groupId 도 캐시(부서별 1회 상향 탐색).
    const groupIdByDept = new Map<string, string | null>();
    const resolveTier = async (
      departmentId: string | null | undefined,
    ): Promise<{ tier: GroupTier | null; bonus: number }> => {
      if (!departmentId) return { tier: null, bonus: 0 };
      let groupId = groupIdByDept.get(departmentId);
      if (groupId === undefined) {
        groupId = await groupRootOf(this.prisma, departmentId);
        groupIdByDept.set(departmentId, groupId);
      }
      const tier = groupId ? tierByGroup.get(groupId) ?? null : null;
      const bonus = tier ? tierBonusMap[tier as string] ?? 0 : 0;
      return { tier, bonus };
    };

    // YoY2: 전년도 연봉 일괄 파생(직전 사이클 1회 탐색 + Compensation 일괄 조회, N+1 방지).
    const cycleYear = await this.cycleYearOf(query.cycleId);
    const manualByUser = new Map<string, number | null | undefined>(
      users.map((u) => [u.id, u.previousSalary ?? null]),
    );
    const prevMap = cycleYear != null
      ? await this.deriveTeamPrevSalaryMap(users.map((u) => u.id), cycleYear, manualByUser)
      : new Map<string, { value: number | null; source: 'derived' | 'carryover' | 'manual' | 'none' }>();

    const rows = await Promise.all(
      users.map(async (u) => {
        const { tier, bonus } = await resolveTier(u.departmentId);
        const prev = prevMap.get(u.id) ?? this.resolvePrevSalary(null, u.previousSalary ?? null);
        return this.buildSimulation(
          query.cycleId,
          {
            id: u.id,
            name: u.name,
            departmentName: u.department?.name ?? null,
            currentSalary: u.currentSalary ?? null,
            currentGrade: gradeByUser.get(u.id) ?? null,
            position: u.position ?? null,
            previousSalary: prev.value,
            previousSalarySource: prev.source,
            divisionName: this.divisionNameOf(u.department),
            teamName: this.teamNameOf(u.department),
          },
          rules.raiseRates,
          bonus,
          tier,
        );
      }),
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

  /**
   * 등급 → 인상률(+그룹 tier 보너스) → 예상 연봉 + 등급별 비교 슬라이더 데이터.
   * @param tierBonus  그룹 실적 tier 보너스(%). 모든 raiseRate·projectedSalary 에 가산.
   * @param groupTier  표시용 그룹 tier(없으면 null).
   */
  private buildSimulation(
    cycleId: string,
    u: {
      id: string;
      name: string | null;
      departmentName: string | null;
      currentSalary: number | null;
      currentGrade: Grade | null;
      position: string | null;
      previousSalary: number | null;
      previousSalarySource: 'derived' | 'carryover' | 'manual' | 'none';
      divisionName: string | null;
      teamName: string | null;
    },
    raiseRates: Record<Grade, number>,
    tierBonus: number,
    groupTier: GroupTier | null,
  ) {
    const grades: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];
    // 인상률 하한 0%(음수 보너스로 연봉 삭감 방지). 표시용 groupTierBonus 는 음수 유지하되 적용 인상률은 클램프.
    const rateForGrade = (grade: Grade): number =>
      this.clampRaiseRate(this.scoring.raiseRateForGrade(grade, raiseRates) + tierBonus);
    const project = (grade: Grade): number | null => {
      if (u.currentSalary == null) return null;
      return Math.round(u.currentSalary * (1 + rateForGrade(grade) / 100));
    };
    const raiseRate = u.currentGrade != null ? rateForGrade(u.currentGrade) : null;
    return {
      userId: u.id,
      userName: u.name,
      departmentName: u.departmentName,
      cycleId,
      currentSalary: u.currentSalary,
      currentGrade: u.currentGrade,
      raiseRate,
      projectedSalary: u.currentGrade != null ? project(u.currentGrade) : null,
      position: u.position,
      previousSalary: u.previousSalary,
      previousSalarySource: u.previousSalarySource,
      divisionName: u.divisionName,
      teamName: u.teamName,
      groupTier,
      groupTierBonus: tierBonus,
      byGrade: grades.map((grade) => ({
        grade,
        raiseRate: rateForGrade(grade),
        projectedSalary: project(grade),
      })),
    };
  }

  /**
   * 부서(department)로부터 본부(division) 이름을 도출.
   * type='division' → 자신의 name; type='team' → 부모가 division 이면 부모 name;
   * 그 외(group 직속·부모가 group)면 null.
   */
  private divisionNameOf(
    dept:
      | { name: string; type: DepartmentType; parent?: { name: string; type: DepartmentType } | null }
      | null
      | undefined,
  ): string | null {
    if (!dept) return null;
    if (dept.type === DepartmentType.division) return dept.name;
    if (dept.type === DepartmentType.team) {
      return dept.parent?.type === DepartmentType.division ? dept.parent.name : null;
    }
    return null;
  }

  /** 부서가 팀(team)이면 팀 이름, 아니면 null. */
  private teamNameOf(
    dept: { name: string; type: DepartmentType } | null | undefined,
  ): string | null {
    return dept?.type === DepartmentType.team ? dept.name : null;
  }

}
