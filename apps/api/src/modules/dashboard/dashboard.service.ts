import { Injectable } from '@nestjs/common';
import {
  AppealStatus,
  EvaluationStatus,
  EvaluationType,
  Grade,
  KpiCategory,
  MeasureType,
  Prisma,
  Role,
  VisibilityScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import { groupRootOf, visibleDeptIds } from '../../common/access/access.util';

/** HR 대시보드 위젯 집계 (C-3). 한 응답으로 진행률·분포·미제출·이의제기·인상률.
 * M3 Item 7: groupGrades·teamGoal·monthlyTrend 추가(가시 범위별). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  /** cycleId 미지정 시 가장 최근 active 주기를 사용.
   * M4: 4역할 게이팅 폐기 → viewer 의 VisibilityScope 로 모든 위젯을 행수준 스코프.
   *   company(HR·대표이사)=전사 / group(그룹장) / division(본부장) / team(팀장) / self(팀원=본인). */
  async summary(cycleId?: string, current?: AuthUser) {
    const cycle = cycleId
      ? await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } })
      : await this.prisma.evaluationCycle.findFirst({
          where: { status: 'active' },
          orderBy: { year: 'desc' },
        });

    if (!cycle) {
      return {
        data: {
          cycleId: null,
          scope: 'self',
          scopeLabel: '본인',
          progress: { self: emptyPhase(), downward1: emptyPhase(), downward2: emptyPhase() },
          myTasks: { total: 0, pending: 0 },
          gradeDistribution: { company: zeroGrades(), byGroup: [] },
          unsubmittedCount: 0,
          appeals: { submitted: 0, under_review: 0, answered: 0, closed: 0, total: 0 },
          avgRaiseRate: null,
          me: null,
          groupGrades: [],
          teamGoal: null,
          monthlyTrend: [],
        },
      };
    }

    // ── 가시 범위 산정 ──
    // effScope: hr_admin 은 company 동등. deptIds: null=전사(제한 없음), 그 외=가시 부서 집합.
    const effScope =
      !current || current.role === Role.hr_admin
        ? VisibilityScope.company
        : current.scope;
    const deptIds =
      effScope === VisibilityScope.company
        ? null
        : current
          ? await visibleDeptIds(this.prisma, current)
          : [];
    const scopeLabel = await this.resolveScopeLabel(effScope, current);

    // 평가(evaluatee 기준) 스코프 where.
    const evalScopeWhere: Prisma.EvaluationWhereInput =
      effScope === VisibilityScope.company
        ? {}
        : effScope === VisibilityScope.self
          ? { evaluateeId: current?.id ?? '__none__' }
          : { evaluatee: { departmentId: { in: deptIds ?? [] } } };
    // 결과·이의·보상(user 기준) 스코프 where.
    const userScopeWhere: Prisma.UserWhereInput | undefined =
      effScope === VisibilityScope.company
        ? undefined
        : effScope === VisibilityScope.self
          ? { id: current?.id ?? '__none__' }
          : { departmentId: { in: deptIds ?? [] } };

    // ── 진행률(유형·round 별 제출/확정 현황) — 가시 범위 내 평가 ──
    const evals = await this.prisma.evaluation.findMany({
      where: { cycleId: cycle.id, ...evalScopeWhere },
      select: { type: true, round: true, status: true },
    });
    const phase = (type: EvaluationType, round: number | null) => {
      const list = evals.filter(
        (e) => e.type === type && (round === null || e.round === round),
      );
      const total = list.length;
      const submitted = list.filter(
        (e) =>
          e.status === EvaluationStatus.submitted ||
          e.status === EvaluationStatus.finalized,
      ).length;
      const finalized = list.filter((e) => e.status === EvaluationStatus.finalized).length;
      const rate = total ? Math.round((submitted / total) * 1000) / 10 : 0;
      return { total, submitted, finalized, rate };
    };
    const progress = {
      self: phase(EvaluationType.self, null),
      downward1: phase(EvaluationType.downward, 1),
      downward2: phase(EvaluationType.downward, 2),
    };

    // 미제출 수(가시 범위 내, 아직 submitted/finalized 가 아닌 평가).
    const unsubmittedCount = evals.filter(
      (e) =>
        e.status !== EvaluationStatus.submitted &&
        e.status !== EvaluationStatus.finalized,
    ).length;

    // ── 내가 할 일: 본인이 평가자(팀장 1차·본부장 2차·팀원 self)인 미완료 건 ──
    const myEvals = current
      ? await this.prisma.evaluation.findMany({
          where: { cycleId: cycle.id, evaluatorId: current.id },
          select: { status: true },
        })
      : [];
    const myTasks = {
      total: myEvals.length,
      pending: myEvals.filter(
        (e) =>
          e.status !== EvaluationStatus.submitted &&
          e.status !== EvaluationStatus.finalized,
      ).length,
    };

    // ── 등급 분포(가시 범위 + 그룹별) ──
    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: cycle.id, ...(userScopeWhere ? { user: userScopeWhere } : {}) },
      include: { user: { include: { department: true } } },
    });
    const company = zeroGrades();
    for (const r of results) if (r.finalGrade) company[r.finalGrade]++;

    // ── self(팀원): 본인 평가 상태 + 결과 요약 ──
    const me =
      effScope === VisibilityScope.self && current
        ? await this.buildMeBlock(cycle.id, current.id, results)
        : null;

    // 그룹별: 사용자의 최상위 group 부서로 매핑
    // N+1 방지: deptId → groupId 결과를 요청 스코프 캐시에 보관(매 행마다 트리 상향 쿼리 제거).
    const groupCache = new Map<string, string | null>();
    const resolveGroupIdCached = async (deptId: string): Promise<string | null> => {
      if (groupCache.has(deptId)) return groupCache.get(deptId) as string | null;
      const gid = await groupRootOf(this.prisma, deptId);
      groupCache.set(deptId, gid);
      return gid;
    };
    const groupBuckets = new Map<string, { groupName: string; grades: Record<Grade, number> }>();
    for (const r of results) {
      if (!r.finalGrade || !r.user?.departmentId) continue;
      const groupId = await resolveGroupIdCached(r.user.departmentId);
      if (!groupId) continue;
      let bucket = groupBuckets.get(groupId);
      if (!bucket) {
        const dept = await this.prisma.department.findUnique({ where: { id: groupId } });
        bucket = { groupName: dept?.name ?? groupId, grades: zeroGrades() };
        groupBuckets.set(groupId, bucket);
      }
      bucket.grades[r.finalGrade]++;
    }
    const byGroup = Array.from(groupBuckets.entries()).map(([groupId, b]) => ({
      groupId,
      groupName: b.groupName,
      grades: b.grades,
    }));

    // ── 이의제기 현황 (가시 범위) ──
    const appealRows = await this.prisma.appeal.findMany({
      where: {
        result: { cycleId: cycle.id, ...(userScopeWhere ? { user: userScopeWhere } : {}) },
      },
      select: { status: true },
    });
    const appeals = {
      submitted: appealRows.filter((a) => a.status === AppealStatus.submitted).length,
      under_review: appealRows.filter((a) => a.status === AppealStatus.under_review).length,
      answered: appealRows.filter((a) => a.status === AppealStatus.answered).length,
      closed: appealRows.filter((a) => a.status === AppealStatus.closed).length,
      total: appealRows.length,
    };

    // ── 평균 인상률 (가시 범위) ──
    const comps = await this.prisma.compensation.findMany({
      where: {
        cycleId: cycle.id,
        simulated: false,
        ...(userScopeWhere ? { user: userScopeWhere } : {}),
      },
      select: { raiseRate: true },
    });
    const avgRaiseRate = comps.length
      ? Math.round((comps.reduce((s, c) => s + c.raiseRate, 0) / comps.length) * 100) / 100
      : null;

    // ── M3 Item 7: 그룹 등급 카드 + 팀 목표 + 월별 트렌드 (가시 범위별) ──
    const { groupGrades, teamGoal, monthlyTrend } = await this.performanceWidgets(
      cycle.id,
      current,
    );

    // 가시 범위(scope)로 이미 행수준 필터됨 — 추가 게이팅 없이 그대로 반환.
    return {
      data: {
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleStatus: cycle.status,
        scope: effScope,
        scopeLabel,
        progress,
        myTasks,
        gradeDistribution: { company, byGroup },
        unsubmittedCount,
        appeals,
        avgRaiseRate,
        me,
        groupGrades,
        teamGoal,
        monthlyTrend,
      },
    };
  }

  /** viewer 의 scope 범위 표시 라벨(전사 / ○○그룹 / ○○본부 / ○○팀 / 본인). */
  private async resolveScopeLabel(
    scope: VisibilityScope,
    current?: AuthUser,
  ): Promise<string> {
    if (scope === VisibilityScope.company) return '전사';
    if (scope === VisibilityScope.self) return '본인';
    if (!current?.departmentId) return '본인';

    // scope 에 해당하는 조상 부서 유형을 찾아 그 이름을 라벨로.
    const wantType =
      scope === VisibilityScope.group
        ? 'group'
        : scope === VisibilityScope.division
          ? 'division'
          : 'team';
    let cursor: string | null = current.departmentId;
    for (let i = 0; i < 10 && cursor; i++) {
      const dept = await this.prisma.department.findUnique({ where: { id: cursor } });
      if (!dept) break;
      if (dept.type === wantType) return dept.name;
      cursor = dept.parentId;
    }
    // 일치 유형이 없으면 본인 부서명으로 폴백.
    const own = await this.prisma.department.findUnique({
      where: { id: current.departmentId },
    });
    return own?.name ?? '본인';
  }

  /** self(팀원) 전용: 본인 self 평가 상태 + 결과 요약. */
  private async buildMeBlock(
    cycleId: string,
    userId: string,
    results: Array<{
      userId: string;
      finalGrade: Grade | null;
      finalScore: number | null;
      percentile: number | null;
    }>,
  ): Promise<MeBlock> {
    const selfEval = await this.prisma.evaluation.findFirst({
      where: { cycleId, evaluateeId: userId, type: EvaluationType.self },
      select: { status: true },
    });
    const result = results.find((r) => r.userId === userId) ?? null;
    return {
      selfStatus: selfEval?.status ?? EvaluationStatus.not_started,
      selfSubmitted:
        selfEval?.status === EvaluationStatus.submitted ||
        selfEval?.status === EvaluationStatus.finalized,
      hasResult: !!result?.finalGrade,
      finalGrade: result?.finalGrade ?? null,
      finalScore: result?.finalScore ?? null,
      percentile: result?.percentile ?? null,
    };
  }

  /** 전사 목표 대비 달성률 집계. MonthlyPerformance(revenue) 기준. */
  async getCompanyAchievement(cycleId?: string, current?: AuthUser) {
    const where: Prisma.MonthlyPerformanceWhereInput = {
      month: { gte: 1 },
      category: KpiCategory.revenue,
      // 집계=final: 대시보드 전사 달성률은 확정(final) 실적만. draft(임시저장) 제외.
      status: 'final',
    };
    if (cycleId) where.cycleId = cycleId;

    // 가시 범위: 비 hr_admin(또는 company scope 아님)은 본인 소속 그룹으로 한정.
    let scopedToGroup = false;
    if (current && current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const ownGroupId = current.departmentId
        ? await groupRootOf(this.prisma, current.departmentId)
        : null;
      where.departmentId = ownGroupId ?? '__none__';
      scopedToGroup = true;
    }

    const rows = await this.prisma.monthlyPerformance.findMany({ where });
    const totalTarget = rows.reduce((s, r) => s + r.targetAmount, 0);
    const totalActual = rows.reduce((s, r) => s + r.actualAmount, 0);
    const achievementRate = totalTarget > 0
      ? Math.round((totalActual / totalTarget) * 1000) / 10
      : 0;

    return {
      data: {
        cycleId: cycleId ?? null,
        groupCount: new Set(rows.map((r) => r.departmentId)).size,
        totalTarget: Math.round(totalTarget * 100) / 100,
        totalActual: Math.round(totalActual * 100) / 100,
        achievementRate,
        // 비 hr_admin 은 본인 그룹 범위만 집계됨을 알린다(전사 아님).
        scopedToGroup,
      },
    };
  }

  /**
   * M3 Item 7: MonthlyPerformance 기반 위젯.
   * - groupGrades: 그룹별 누적 달성률 → 현재 등급 (관리자=전체, 본부장/팀장=본인 그룹, 임직원=본인 그룹).
   * - teamGoal: 본인 부서(팀/본부)의 목표·실적·달성률·등급.
   * - monthlyTrend: 가시 그룹 기준 월별 누적 달성률.
   */
  private async performanceWidgets(cycleId: string, current?: AuthUser) {
    const empty = { groupGrades: [] as GroupGradeCard[], teamGoal: null as TeamGoal | null, monthlyTrend: [] as TrendPoint[] };
    let rules;
    try {
      rules = await this.scoring.loadRuleSetForCycle(cycleId);
    } catch {
      return empty;
    }

    const gradeFor = (rate: number): Grade =>
      this.scoring.measureToGrade(MeasureType.amount, rate, rules.gradingScales, null, null);
    const rate = (actual: number, target: number) =>
      target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;

    // month>=1 만 집계(month=0 = 전년도 2024 참고 sentinel 행 제외).
    // 경영실적 그리드는 category=revenue 단일 행을 SSOT로 쓰므로, 과거 seed/구버전
    // orders·construction 행이 남아 있어도 대시보드 목표보드에는 섞지 않는다.
    // 집계=final: 대시보드 그룹 등급 카드·목표보드는 확정(final) 실적만. draft(임시저장) 제외.
    const allMonthly = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId, month: { gte: 1 }, category: KpiCategory.revenue, status: 'final' },
    });

    // 가시 그룹 결정.
    const visibleGroupId =
      current && current.role !== Role.hr_admin && current.departmentId
        ? await groupRootOf(this.prisma, current.departmentId)
        : null;

    // ── 그룹 등급 카드 ──
    const groups = await this.prisma.department.findMany({ where: { type: 'group' } });
    const groupGrades: GroupGradeCard[] = [];
    for (const g of groups) {
      if (visibleGroupId && g.id !== visibleGroupId) continue; // 비관리자: 본인 그룹만
      const rows = allMonthly.filter((m) => m.departmentId === g.id);
      const target = rows.reduce((s, m) => s + m.targetAmount, 0);
      const actual = rows.reduce((s, m) => s + m.actualAmount, 0);
      const achievementRate = rate(actual, target);
      groupGrades.push({
        groupId: g.id,
        groupName: g.name,
        currentGrade: target > 0 ? gradeFor(achievementRate) : null,
        achievementRate,
        targetAmount: Math.round(target * 100) / 100,
        actualAmount: Math.round(actual * 100) / 100,
      });
    }

    // ── 팀 목표 카드 (본인 부서 단위) ──
    let teamGoal: TeamGoal | null = null;
    if (current?.departmentId) {
      const rows = allMonthly.filter((m) => m.departmentId === current.departmentId);
      if (rows.length) {
        const target = rows.reduce((s, m) => s + m.targetAmount, 0);
        const actual = rows.reduce((s, m) => s + m.actualAmount, 0);
        const achievementRate = rate(actual, target);
        teamGoal = {
          departmentId: current.departmentId,
          targetAmount: Math.round(target * 100) / 100,
          actualAmount: Math.round(actual * 100) / 100,
          achievementRate,
          currentGrade: target > 0 ? gradeFor(achievementRate) : null,
        };
      }
    }

    // ── 월별 트렌드 (가시 그룹, 없으면 전체 합산) ──
    const trendRows = visibleGroupId
      ? allMonthly.filter((m) => m.departmentId === visibleGroupId)
      : allMonthly;
    const monthMap = new Map<number, { target: number; actual: number }>();
    for (const m of trendRows) {
      const acc = monthMap.get(m.month) ?? { target: 0, actual: 0 };
      acc.target += m.targetAmount;
      acc.actual += m.actualAmount;
      monthMap.set(m.month, acc);
    }
    let cumT = 0;
    let cumA = 0;
    const monthlyTrend: TrendPoint[] = [];
    for (let month = 1; month <= 12; month++) {
      const m = monthMap.get(month);
      if (!m) continue;
      cumT += m.target;
      cumA += m.actual;
      const achievementRate = rate(cumA, cumT);
      monthlyTrend.push({ month, achievementRate, grade: cumT > 0 ? gradeFor(achievementRate) : null });
    }

    return { groupGrades, teamGoal, monthlyTrend };
  }
}

function zeroGrades(): Record<Grade, number> {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 };
}

function emptyPhase() {
  return { total: 0, submitted: 0, finalized: 0, rate: 0 };
}

export interface GroupGradeCard {
  groupId: string;
  groupName: string;
  currentGrade: Grade | null;
  achievementRate: number;
  targetAmount: number;
  actualAmount: number;
}

export interface TeamGoal {
  departmentId: string;
  targetAmount: number;
  actualAmount: number;
  achievementRate: number;
  currentGrade: Grade | null;
}

export interface TrendPoint {
  month: number;
  achievementRate: number;
  grade: Grade | null;
}

export interface MeBlock {
  selfStatus: EvaluationStatus;
  selfSubmitted: boolean;
  hasResult: boolean;
  finalGrade: Grade | null;
  finalScore: number | null;
  percentile: number | null;
}
