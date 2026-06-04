import { Injectable } from '@nestjs/common';
import {
  AppealStatus,
  EvaluationStatus,
  EvaluationType,
  Grade,
  MeasureType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import { groupRootOf } from '../../common/access/access.util';

/** HR 대시보드 위젯 집계 (C-3). 한 응답으로 진행률·분포·미제출·이의제기·인상률.
 * M3 Item 7: groupGrades·teamGoal·monthlyTrend 추가(가시 범위별). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  /** cycleId 미지정 시 가장 최근 active 주기를 사용. current 로 가시 범위별 위젯 추가. */
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
          progress: { self: emptyPhase(), downward1: emptyPhase(), downward2: emptyPhase() },
          gradeDistribution: { company: zeroGrades(), byGroup: [] },
          unsubmittedCount: 0,
          appeals: { submitted: 0, under_review: 0, answered: 0, closed: 0, total: 0 },
          avgRaiseRate: null,
          groupGrades: [],
          teamGoal: null,
          monthlyTrend: [],
        },
      };
    }

    // ── 진행률(유형·round 별 제출/확정 현황) ──
    const evals = await this.prisma.evaluation.findMany({
      where: { cycleId: cycle.id },
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

    // 미제출자 수(아직 submitted/finalized 가 아닌 평가).
    const unsubmittedCount = evals.filter(
      (e) =>
        e.status !== EvaluationStatus.submitted &&
        e.status !== EvaluationStatus.finalized,
    ).length;

    // ── 등급 분포(전사 + 그룹별) ──
    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId: cycle.id },
      include: { user: { include: { department: true } } },
    });
    const company = zeroGrades();
    for (const r of results) if (r.finalGrade) company[r.finalGrade]++;

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

    // ── 이의제기 현황 ──
    const appealRows = await this.prisma.appeal.findMany({
      where: { result: { cycleId: cycle.id } },
      select: { status: true },
    });
    const appeals = {
      submitted: appealRows.filter((a) => a.status === AppealStatus.submitted).length,
      under_review: appealRows.filter((a) => a.status === AppealStatus.under_review).length,
      answered: appealRows.filter((a) => a.status === AppealStatus.answered).length,
      closed: appealRows.filter((a) => a.status === AppealStatus.closed).length,
      total: appealRows.length,
    };

    // ── 평균 인상률 ──
    const comps = await this.prisma.compensation.findMany({
      where: { cycleId: cycle.id, simulated: false },
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

    // 가시 범위: 전사 진행률·분포·이의제기·인상률은 hr_admin 전용. 그 외는 null 로 가린다.
    const isAdmin = !current || current.role === Role.hr_admin;

    return {
      data: {
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleStatus: cycle.status,
        progress: isAdmin ? progress : null,
        gradeDistribution: isAdmin ? { company, byGroup } : null,
        unsubmittedCount: isAdmin ? unsubmittedCount : null,
        appeals: isAdmin ? appeals : null,
        avgRaiseRate: isAdmin ? avgRaiseRate : null,
        groupGrades,
        teamGoal,
        monthlyTrend,
      },
    };
  }

  /**
   * 전사 목표 대비 달성률 집계.
   * 모든 GroupPerformance 를 대상으로 totalTarget, totalActual 합산 → achievementRate 반환.
   */
  async getCompanyAchievement(cycleId?: string) {
    const where: any = {};
    if (cycleId) where.cycleId = cycleId;

    const rows = await this.prisma.groupPerformance.findMany({ where });
    const totalTarget = rows.reduce((s, r) => s + (r.revenue ?? 0) + (r.orders ?? 0), 0);
    const totalActual = rows.reduce((s, r) => s + (r.revenue ?? 0) + (r.orders ?? 0) + (r.profit ?? 0), 0);
    // 단순 달성률 = achievementRate 평균
    const avgAchievementRate = rows.length
      ? Math.round((rows.reduce((s, r) => s + r.achievementRate, 0) / rows.length) * 100) / 100
      : 0;

    return {
      data: {
        cycleId: cycleId ?? null,
        groupCount: rows.length,
        totalTarget: Math.round(totalTarget * 100) / 100,
        totalActual: Math.round(totalActual * 100) / 100,
        achievementRate: avgAchievementRate,
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

    const allMonthly = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId },
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
