import { ForbiddenException, Injectable } from '@nestjs/common';
import { CycleStatus, Grade, GroupTier, Prisma, Role, VisibilityScope } from '@prisma/client';
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
  UpsertCompensationAdjustmentDto,
} from './dto/compensation.dto';
import { CompensationAdjustmentService } from './compensation-adjustment.service';
import { rosterBaseDate } from './career-derivation';
import {
  ChainAnchor,
  PrevSalary,
  SalaryChain,
  deriveSalaryChain,
  deriveSalaryChains,
} from './previous-salary.deriver';
import {
  derivePreviousCycleGrades,
  gatePreviousGrade,
} from './previous-grade.deriver';
import {
  buildSimulation,
  appliesRuleBasedSalaryCalculation,
  careerInputOf,
  clampRaiseRate,
  divisionNameOf,
  groupTierBonusMap,
  teamNameOf,
} from './simulation.builder';

/**
 * 보상 연동: 확정 등급 → 인상률(RuleSet.raiseRates). 전사 평균 ≈3% 모니터링.
 * 시뮬레이션(simulated=true) 또는 실제 연동(false).
 *
 * use-case 단위 분할(파일당 ~200줄 상한):
 *  - 전년도 연봉 파생 → previous-salary.deriver.ts
 *  - 직전 사이클 등급 파생 → previous-grade.deriver.ts
 *  - 시뮬레이션 행 빌드/파생 계산 → simulation.builder.ts (+ career-derivation.ts)
 * 본체는 compute/list/simulation 오케스트레이션과 prisma 결합 헬퍼(cycleYearOf·groupTierFor)만 보유.
 */
@Injectable()
export class CompensationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly adjustments: CompensationAdjustmentService,
  ) {}

  /** 보상 수기 조정 upsert(hr_admin 전용). 단계(stage) 게이팅 없음 — 최종 단계 전에도 미리 입력 가능. */
  async upsertAdjustment(dto: UpsertCompensationAdjustmentDto) {
    const data = await this.adjustments.upsert(dto);
    return { data };
  }

  /** cycleId → year 조회(파생 기준 연도). 없으면 null. */
  private async cycleYearOf(cycleId: string): Promise<number | null> {
    const c = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { year: true },
    });
    return c?.year ?? null;
  }

  /** cycleId → status 조회(결과 공개 게이트 판정용). 없으면 null(미공개 취급). */
  private async cycleStatusOf(cycleId: string): Promise<CycleStatus | null> {
    const c = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { status: true },
    });
    return c?.status ?? null;
  }

  /** userId → 연봉 체인 앵커(User 수기 입력 연봉). 가장 이른 사이클의 시작 연봉. */
  private anchorsOf(
    users: (
      | { id: string; currentSalary: number | null; previousSalary: number | null }
      | null
      | undefined
    )[],
  ): Map<string, ChainAnchor> {
    const map = new Map<string, ChainAnchor>();
    for (const u of users) {
      if (!u) continue;
      map.set(u.id, {
        currentSalary: u.currentSalary ?? null,
        previousSalary: u.previousSalary ?? null,
      });
    }
    return map;
  }

  /**
   * 결과 공개 게이트 — results.service(assertResultVisible)와 동일 규칙.
   * 확정 등급·등급 파생 값(인상률·예상연봉)의 노출 가능 여부를 판정한다.
   *  - hr_admin: 항상 true(집계·조정 업무).
   *  - 비HR 의 타인 결과: calibration·closed 에서만.
   *  - 비HR 의 본인 결과: closed 에서만("캘리브레이션이 끝나면 공개").
   * 미공개 단계 잔존 EvaluationResult/Compensation 행의 미확정 등급 누출을 차단한다.
   */
  private gradeVisibleForStatus(
    current: AuthUser,
    targetUserId: string,
    status: CycleStatus | null,
  ): boolean {
    if (current.role === Role.hr_admin) return true;
    const isSelf = current.id === targetUserId;
    return isSelf
      ? status === CycleStatus.closed
      : status === CycleStatus.calibration || status === CycleStatus.closed;
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

    // 결과 공개 게이트(비HR) — results.service resultVisibilityWhere 와 동일 규칙.
    // 미공개 단계(active/mid_review 등) 사이클의 잔존 행이 미확정 등급·인상률을 새지 않도록
    // 결과 열람 단계의 행만 반환(타인=calibration·closed, 본인=closed).
    if (current.role !== Role.hr_admin) {
      where.AND = [
        { cycle: { status: { in: [CycleStatus.calibration, CycleStatus.closed] } } },
        { OR: [{ cycle: { status: CycleStatus.closed } }, { userId: { not: current.id } }] },
      ];
    }

    const rows = await this.prisma.compensation.findMany({
      where,
      include: {
        user: { include: { department: true } },
        cycle: { select: { status: true } },
      },
    });

    // 전년도 연봉 파생: 행마다 그 행의 사이클 연도 기준으로 연봉 체인을 되짚어 파생.
    // 사이클별로 묶어 deriveSalaryChains 1회씩 호출(N+1 방지).
    const cycleYearCache = new Map<string, number | null>();
    const prevByRow = new Map<string, PrevSalary>();
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
      const chains = await deriveSalaryChains(
        this.prisma,
        cycleRows.map((r) => r.userId),
        year,
        this.anchorsOf(cycleRows.map((r) => r.user)),
      );
      for (const r of cycleRows) {
        prevByRow.set(r.id, chains.get(r.userId)?.previous ?? { value: null, source: 'none' });
      }
    }

    const data = rows.map((r) => {
      const prev = prevByRow.get(r.id) ?? { value: null, source: 'none' as const };
      // 절대 연봉 마스킹: /users 와 동일 정책(HR 또는 본인만). 부서장·팀장이 부하 연봉을
      // /compensations 로 우회 열람하던 갭 차단. 등급·인상률은 유지(부서 등급분포는 원래 허용).
      const canSeeSalary = current.role === Role.hr_admin || r.userId === current.id;
      // 결과 공개 게이트 2중 방어: where 에서 이미 미공개 행을 제외했지만,
      // 행 단위로도 등급·인상률(및 등급 파생 nextYearSalary)을 재검증해 마스킹.
      const canSeeGrade = this.gradeVisibleForStatus(current, r.userId, r.cycle?.status ?? null);
      return this.toDto(r, prev, canSeeSalary, canSeeGrade);
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
      cycle?: { status: CycleStatus } | null;
    },
    prev?: PrevSalary,
    // 절대 연봉 노출 여부(HR·본인만 true). 기본 true — compute/simulation 등 HR 경로 하위호환.
    canSeeSalary = true,
    // 등급·인상률 노출 여부(결과 공개 게이트). 기본 true — compute(hr_admin 전용) 경로 하위호환.
    canSeeGrade = true,
  ) {
    return {
      id: r.id,
      userId: r.userId,
      cycleId: r.cycleId,
      finalGrade: canSeeGrade ? r.finalGrade : null,
      raiseRate: canSeeGrade ? r.raiseRate : null,
      baseSalary: canSeeSalary ? (r.baseSalary ?? null) : null,
      // nextYearSalary 는 등급 인상률 파생값 — 등급 미공개 단계면 함께 마스킹(인상률 역산 차단).
      nextYearSalary: canSeeSalary && canSeeGrade ? (r.nextYearSalary ?? null) : null,
      // YoY2: previousSalary 는 누적 직전 사이클에서 파생(수기 fallback). source 로 출처 표시.
      previousSalary: canSeeSalary ? (prev?.value ?? null) : null,
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
    const tierBonusMap = groupTierBonusMap(rules.weightPolicy);
    const cycleYear = await this.cycleYearOf(dto.cycleId);
    const shouldApplyRaise = appliesRuleBasedSalaryCalculation(cycleYear);

    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: dto.cycleId, finalGrade: { not: null } },
    });

    // 연봉 체인(금년도 연봉 = 직전 사이클 제안연봉)을 트랜잭션 밖에서 일괄 파생(읽기 전용).
    const targetUsers = await this.prisma.user.findMany({
      where: { id: { in: results.map((r) => r.userId) } },
      select: { id: true, currentSalary: true, previousSalary: true, departmentId: true },
    });
    const chains = await deriveSalaryChains(
      this.prisma,
      targetUsers.map((u) => u.id),
      cycleYear,
      this.anchorsOf(targetUsers),
    );
    const userById = new Map(targetUsers.map((u) => [u.id, u]));

    // 건별 upsert 를 단일 트랜잭션으로 묶어 중간 실패 시 부분 커밋·잘못된 평균을 방지.
    const validUserIds = results.map((r) => r.userId);
    const { rows, raiseSum } = await this.prisma.$transaction(async (tx) => {
      // 재조정: 확정 등급이 사라진(이의 인용·재집계로 리셋된) 사용자의 고아 Compensation 행 제거.
      // 이게 없으면 compute 는 등급 있는 행만 upsert 하고 옛 행은 남아, GET /compensations 가
      // 근거 없는 인상률·연봉을 계속 노출한다. notIn:[] 이면 이 사이클 전체를 정리(정상).
      await tx.compensation.deleteMany({
        where: { cycleId: dto.cycleId, simulated, userId: { notIn: validUserIds } },
      });
      const rows: ReturnType<CompensationsService['toDto']>[] = [];
      let raiseSum = 0;
      for (const r of results) {
        const grade = r.finalGrade as Grade;
        let raiseRate = this.scoring.raiseRateForGrade(grade, rules.raiseRates);

        // groupTierBonus: 해당 user 의 정확한 그룹 GroupPerformance.tier 조회 → 보너스 합산
        const user = userById.get(r.userId);
        const adjustment = await tx.compensationAdjustment.findUnique({
          where: { userId_cycleId: { userId: r.userId, cycleId: dto.cycleId } },
          select: { adjustmentAmount: true },
        });
        const { bonus } = await this.groupTierFor(
          dto.cycleId,
          user?.departmentId,
          tierBonusMap,
          tx,
        );
        // 인상률 하한 0%(음수 보너스로 연봉 삭감 방지). 저장되는 raiseRate·nextYearSalary 모두 클램프 값 기준.
        raiseRate = clampRaiseRate(raiseRate + bonus);

        // 이 사이클의 금년도 연봉 = 직전 사이클 제안연봉(인상률+조정분 이월). 체인으로 실시간 파생.
        const baseSalary = chains.get(r.userId)?.currentSalary ?? null;

        // nextYearSalary 계산: 2026년부터 등급 인상률 적용 후 조정분을 더한다.
        // 2026년 이전 누적 데이터는 연봉 계산 시스템 도입 전이므로 currentSalary + 조정분만 보관한다.
        const salaryBeforeAdjustment =
          baseSalary != null
            ? shouldApplyRaise
              ? Math.round(baseSalary * (1 + raiseRate / 100))
              : baseSalary
            : null;
        const nextYearSalary =
          salaryBeforeAdjustment != null
            ? salaryBeforeAdjustment + (adjustment?.adjustmentAmount ?? 0)
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
    // 결과 공개 게이트: 미공개 단계(active/mid_review 등)의 미확정 등급을 시뮬레이션으로
    // 조기 노출하지 않는다. 등급 null → buildSimulation 이 raiseRate/projectedSalary/
    // finalProjectedSalary 를 null 처리(현재 연봉 등 비민감 정보·가상 등급 슬라이더는 유지).
    const gradeVisible = this.gradeVisibleForStatus(
      current,
      userId,
      await this.cycleStatusOf(query.cycleId),
    );
    const tierBonusMap = groupTierBonusMap(rules.weightPolicy);
    const { tier, bonus } = await this.groupTierFor(
      query.cycleId,
      user?.departmentId,
      tierBonusMap,
    );
    // 금년도 연봉 = 직전 사이클 제안연봉(인상률+조정분 이월), 전년도 연봉 = 직전 사이클 금년도 연봉.
    const cycleYear = await this.cycleYearOf(query.cycleId);
    const chain = await deriveSalaryChain(this.prisma, userId, cycleYear, {
      currentSalary: user?.currentSalary ?? null,
      previousSalary: user?.previousSalary ?? null,
    });
    // 연도별 평가등급: 직전 사이클 등급(도입연도 게이팅) 1회 조회.
    const { previousCycleYear, gradeByUser: prevGradeByUser } =
      await derivePreviousCycleGrades(this.prisma, cycleYear, [userId]);
    const adjustment = await this.adjustments.valuesFor(query.cycleId, userId);
    const data = buildSimulation(
      this.scoring,
      query.cycleId,
      {
        id: userId,
        name: user?.name ?? null,
        departmentName: user?.department?.name ?? null,
        currentSalary: chain.currentSalary,
        currentGrade: gradeVisible ? result?.finalGrade ?? null : null,
        position: user?.position ?? null,
        previousSalary: chain.previous.value,
        previousSalarySource: chain.previous.source,
        previousGrade: gatePreviousGrade(previousCycleYear, prevGradeByUser.get(userId)),
        previousCycleYear,
        divisionName: divisionNameOf(user?.department),
        teamName: teamNameOf(user?.department),
        ...careerInputOf(user),
      },
      rules.raiseRates,
      bonus,
      tier,
      adjustment,
      rosterBaseDate(cycleYear),
      cycleYear,
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
    // 결과 공개 게이트: 미공개 단계에는 팀원 미확정 등급을 노출하지 않는다.
    // (부서 범위 제한 canViewUser/isDepartmentUnder 는 위에서 이미 적용 — 사이클 단계만 추가 게이트.)
    // hr_admin 면제, 타인=calibration/closed, 본인 행=closed(gradeVisibleForStatus 가 행 단위 판정).
    const cycleStatus = await this.cycleStatusOf(query.cycleId);

    // 그룹 tier 보너스: 그룹 실적을 1회 조회해 groupId→tier 맵으로 캐시(N+1 방지).
    const tierBonusMap = groupTierBonusMap(rules.weightPolicy);
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

    // 연봉 체인 일괄 파생(직전 사이클 1회 탐색 + Compensation·Adjustment 각 1회 조회, N+1 방지).
    // 금년도 연봉 = 직전 사이클 제안연봉(인상률+조정분 이월), 전년도 연봉 = 직전 사이클 금년도 연봉.
    const cycleYear = await this.cycleYearOf(query.cycleId);
    const chainMap = await deriveSalaryChains(
      this.prisma,
      users.map((u) => u.id),
      cycleYear,
      this.anchorsOf(users),
    );
    const emptyChain: SalaryChain = { currentSalary: null, previous: { value: null, source: 'none' } };

    // 연도별 평가등급: 직전 사이클 등급 맵을 루프 밖에서 1회 조회(N+1 금지).
    const { previousCycleYear, gradeByUser: prevGradeByUser } =
      await derivePreviousCycleGrades(this.prisma, cycleYear, users.map((u) => u.id));

    // 보상 수기 조정 일괄 조회(N+1 금지: cycleId + userId in 1회).
    const adjustmentMap = await this.adjustments.mapForUsers(
      query.cycleId,
      users.map((u) => u.id),
    );

    const rows = await Promise.all(
      users.map(async (u) => {
        const { tier, bonus } = await resolveTier(u.departmentId);
        const chain = chainMap.get(u.id) ?? emptyChain;
        return buildSimulation(
          this.scoring,
          query.cycleId,
          {
            id: u.id,
            name: u.name,
            departmentName: u.department?.name ?? null,
            currentSalary: chain.currentSalary,
            currentGrade: this.gradeVisibleForStatus(current, u.id, cycleStatus)
              ? gradeByUser.get(u.id) ?? null
              : null,
            position: u.position ?? null,
            previousSalary: chain.previous.value,
            previousSalarySource: chain.previous.source,
            previousGrade: gatePreviousGrade(previousCycleYear, prevGradeByUser.get(u.id)),
            previousCycleYear,
            divisionName: divisionNameOf(u.department),
            teamName: teamNameOf(u.department),
            ...careerInputOf(u),
          },
          rules.raiseRates,
          bonus,
          tier,
          adjustmentMap.get(u.id) ?? CompensationAdjustmentService.empty(),
          rosterBaseDate(cycleYear),
          cycleYear,
        );
      }),
    );

    // 합계(현재 연봉 입력된 인원 기준).
    // 예산 합계는 조정분이 반영된 최종 제안연봉(finalProjectedSalary) 기준 — 실제 집행 예산.
    const withSalary = rows.filter((r) => r.currentSalary != null);
    const totalCurrent = withSalary.reduce((s, r) => s + (r.currentSalary ?? 0), 0);
    const totalProjected = withSalary.reduce(
      (s, r) => s + (r.finalProjectedSalary ?? r.projectedSalary ?? 0),
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
}
