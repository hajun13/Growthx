import { ForbiddenException, Injectable } from '@nestjs/common';
import { Grade, MeasureType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  descendantDeptIds,
  groupRootOf,
  loadDeptTree,
  deptSnapshotFromTree,
} from '../../common/access/access.util';
import { CountGradeBand, GradeScaleBand } from '../../common/rules/rule-set.types';
import { MidtermProgressQuery } from './dto/midterm.dto';

/** 진척 신호: 순항/주의/위험. 누적 달성률 기준(기존 실적 재사용). */
type ProgressSignal = 'on_track' | 'at_risk' | 'off_track';
/** 추세: 직전 분기 대비 상승/유지/하락(또는 데이터 부족=flat). */
type ProgressTrend = 'up' | 'flat' | 'down';

/**
 * 6월 중간평가 — 진척 점검 데이터 조회(②).
 * 신규 실적 입력 모델을 만들지 않고 기존 Achievement(분기 실적)·MonthlyPerformance(월별 조직 실적)를 재사용.
 *  - 개인 KPI 진척: KPI별 [목표 / 현재실적 / 누적달성률 / 추세 / 신호].
 *  - 조직 진척: 사용자 그룹의 월별 실적 누적(MonthlyPerformance) 카테고리별 + 종합.
 */
@Injectable()
export class MidtermProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async progress(current: AuthUser, query: MidtermProgressQuery) {
    const userId =
      current.role === 'employee' ? current.id : query.userId ?? current.id;
    if (userId !== current.id) {
      const allowed = await canViewUser(this.prisma, current, userId);
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '진척 점검 조회 권한이 없어요.',
        });
      }
    }

    const rules = await this.scoring.loadRuleSetForCycle(query.cycleId);

    // ── 개인 KPI 진척 ──
    const kpis = await this.prisma.kpi.findMany({
      where: { cycleId: query.cycleId, userId },
      include: { achievements: { orderBy: { quarter: 'asc' } } },
      orderBy: [{ group: 'asc' }, { createdAt: 'asc' }],
    });

    const kpiProgress = kpis.map((k) => {
      // 누적 실적 = 분기 actualValue 합(amount/rate/count). 정성은 실적 누적 개념 없음.
      const cumActual = k.achievements.reduce((s, a) => s + a.actualValue, 0);
      // 누적 달성률: 최신 분기의 achievementRate 가 이미 누적/분기 기준으로 적재되었을 수 있어
      //  목표 대비 cumActual 로 재계산(targetValue 있을 때). 없으면 최신 분기 achievementRate.
      let cumulativeRate: number | null = null;
      if (k.targetValue && k.targetValue !== 0) {
        cumulativeRate = Math.round((cumActual / k.targetValue) * 1000) / 10;
      } else if (k.achievements.length) {
        cumulativeRate = k.achievements[k.achievements.length - 1].achievementRate;
      }

      // 현재(중간 시점) 등급 — 측정방식별. 정성은 산정 불가(null).
      const countGrading = (k.grading as CountGradeBand[] | null) ?? null;
      const currentGrade: Grade | null =
        k.measureType === MeasureType.qualitative
          ? null
          : this.scoring.measureToGrade(
              k.measureType,
              k.measureType === MeasureType.count ? cumActual : cumulativeRate,
              rules.gradingScales,
              countGrading,
              null,
              {
                useAbsoluteAmount: k.useAbsoluteAmount,
                actualAmount: k.useAbsoluteAmount ? cumActual : null,
                revenueGradeScale:
                  ((rules.weightPolicy as { revenueGradeScale?: { grade: Grade; minAmount: number }[] })
                    ?.revenueGradeScale) ?? null,
              },
            );

      const trend = this.trendOf(k.achievements.map((a) => a.achievementRate));
      const signal = this.signalOf(cumulativeRate, rules.gradeScale);

      return {
        kpiId: k.id,
        title: k.title,
        category: k.category,
        group: k.group,
        measureType: k.measureType,
        weight: k.weight,
        targetValue: k.targetValue,
        targetText: k.targetText,
        cumulativeActual: Math.round(cumActual * 100) / 100,
        cumulativeRate,
        currentGrade,
        trend,
        signal,
        quarters: k.achievements.map((a) => ({
          quarter: a.quarter,
          actualValue: a.actualValue,
          achievementRate: a.achievementRate,
        })),
      };
    });

    // 종합 신호 — KPI 신호 worst-case 집계(off_track 있으면 off_track 등).
    const overallSignal: ProgressSignal = kpiProgress.some((k) => k.signal === 'off_track')
      ? 'off_track'
      : kpiProgress.some((k) => k.signal === 'at_risk')
        ? 'at_risk'
        : 'on_track';

    // ── 조직 진척(사용자 그룹의 월별 실적 누적) ──
    const orgProgress = await this.orgProgress(query.cycleId, userId);

    return {
      data: {
        cycleId: query.cycleId,
        userId,
        overallSignal,
        kpis: kpiProgress,
        org: orgProgress,
      },
    };
  }

  /**
   * 사용자 소속 그룹의 MonthlyPerformance(월별 group/division 실적) 누적.
   * 그룹 루트 산정 → 그 그룹(부서)의 월별 실적을 카테고리별·월별 누적 → 달성률.
   */
  private async orgProgress(cycleId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (!user?.departmentId) return null;

    const groupId = await groupRootOf(this.prisma, user.departmentId);
    const tree = await loadDeptTree(this.prisma);
    const snap = deptSnapshotFromTree(tree, user.departmentId);
    const scopeId = groupId ?? user.departmentId;
    const deptIds = await descendantDeptIds(this.prisma, scopeId);

    const rows = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId, departmentId: { in: deptIds } },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    if (!rows.length) {
      return {
        departmentId: scopeId,
        departmentName: snap.groupName ?? null,
        targetAmount: 0,
        actualAmount: 0,
        achievementRate: 0,
        byCategory: [],
        monthlyTrend: [],
      };
    }

    const rate = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 1000) / 10 : 0);

    const byCategoryMap = new Map<string, { target: number; actual: number }>();
    let targetTotal = 0;
    let actualTotal = 0;
    for (const r of rows) {
      targetTotal += r.targetAmount;
      actualTotal += r.actualAmount;
      const b = byCategoryMap.get(r.category) ?? { target: 0, actual: 0 };
      b.target += r.targetAmount;
      b.actual += r.actualAmount;
      byCategoryMap.set(r.category, b);
    }

    const byCategory = Array.from(byCategoryMap.entries()).map(([category, b]) => ({
      category,
      targetAmount: Math.round(b.target * 100) / 100,
      actualAmount: Math.round(b.actual * 100) / 100,
      achievementRate: rate(b.actual, b.target),
    }));

    // 월별 누적 추세.
    const monthMap = new Map<number, { target: number; actual: number }>();
    for (const r of rows) {
      const m = monthMap.get(r.month) ?? { target: 0, actual: 0 };
      m.target += r.targetAmount;
      m.actual += r.actualAmount;
      monthMap.set(r.month, m);
    }
    let cumT = 0;
    let cumA = 0;
    const monthlyTrend: { month: number; achievementRate: number }[] = [];
    for (let month = 1; month <= 12; month++) {
      const m = monthMap.get(month);
      if (!m) continue;
      cumT += m.target;
      cumA += m.actual;
      monthlyTrend.push({ month, achievementRate: rate(cumA, cumT) });
    }

    return {
      departmentId: scopeId,
      departmentName: snap.groupName ?? null,
      targetAmount: Math.round(targetTotal * 100) / 100,
      actualAmount: Math.round(actualTotal * 100) / 100,
      achievementRate: rate(actualTotal, targetTotal),
      byCategory,
      monthlyTrend,
    };
  }

  /** 분기별 달성률 시퀀스 → 추세(마지막 두 값 비교). */
  private trendOf(rates: number[]): ProgressTrend {
    if (rates.length < 2) return 'flat';
    const last = rates[rates.length - 1];
    const prev = rates[rates.length - 2];
    if (last > prev + 0.5) return 'up';
    if (last < prev - 0.5) return 'down';
    return 'flat';
  }

  /**
   * 누적 달성률 → 신호. gradeScale 의 B 하한 등으로 경계를 잡되,
   * 단순·안정적으로 90%↑ 순항 / 70~90% 주의 / 70%미만 위험.
   */
  private signalOf(rate: number | null, _gradeScale: GradeScaleBand[]): ProgressSignal {
    if (rate == null) return 'at_risk';
    if (rate >= 90) return 'on_track';
    if (rate >= 70) return 'at_risk';
    return 'off_track';
  }
}
