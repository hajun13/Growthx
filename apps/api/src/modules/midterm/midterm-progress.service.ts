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
    // 요청한 대상을 그대로 쓴다. 예전에는 role==='employee' 면 userId 를 무시하고 본인 id 로
    // 갈아끼웠는데, 중간점검은 부서장을 계정 role 이 아니라 Department.headUserId 로 판정하므로
    // (role='employee' 인 부서장이 존재한다) 1차 평가자가 구성원 점검 화면을 열면 200 과 함께
    // **본인 KPI** 가 조용히 내려왔다. 남의 데이터를 달라는 요청은 허가되거나 명시적으로
    // 거절돼야 하고, 말없이 본인 것으로 바뀌어서는 안 된다.
    const userId = query.userId ?? current.id;
    if (userId !== current.id) {
      // 배정 우선 판정 — 계정 scope/role 이 구성원 부서보다 좁아도(부서장이 employee scope)
      // 그 사람의 중간점검 1차·2차로 배정돼 있으면 열람할 수 있어야 한다.
      const allowed =
        (await this.isMidtermReviewerOf(current.id, query.cycleId, userId)) ||
        (await canViewUser(this.prisma, current, userId));
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

    // KPI별 본인 자가점검(selfCheckIn) prefill — 해당 사용자의 중간점검 리뷰의 checkIns 로딩.
    const review = await this.prisma.midtermReview.findUnique({
      where: { cycleId_evaluateeId: { cycleId: query.cycleId, evaluateeId: userId } },
      include: { kpiCheckIns: true },
    });
    const checkInByKpi = new Map(
      (review?.kpiCheckIns ?? []).map((c) => [c.kpiId, c]),
    );

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
      // 정성 KPI(진실소스 isQualitative)는 달성률 개념이 없어 신호 산정 불가 → 중립(null).
      // '주의(at_risk)' 오염 방지 — 프론트 MidtermSignalBadge 는 null 을 '—'로 렌더.
      const signal = k.isQualitative
        ? null
        : this.signalOf(cumulativeRate, rules.gradeScale);

      const ci = checkInByKpi.get(k.id) ?? null;

      return {
        kpiId: k.id,
        // KPI 정의(본인평가처럼 전체 표시) ──
        csf: k.csf,
        title: k.title,
        group: k.group,
        category: k.category,
        measureType: k.measureType,
        measureMethod: k.measureMethod,
        isQualitative: k.isQualitative,
        // KPI 승인 상태. 중간점검 수정(KpiRevisionService.validate)은 confirmed 만 허용하고
        // 가중치 100% 검증도 confirmed 만 합산하므로, 화면이 편집 대상·합계 범위를 서버와
        // 똑같이 좁히려면 이 값이 필요하다(없으면 draft/submitted 까지 합산해 오탐).
        status: k.status,
        weight: k.weight,
        targetValue: k.targetValue,
        targetText: k.targetText,
        // 정성 등급기준 {S,A,B,C,D} 서술(KPI 정의의 일부 — 등급 "점수"가 아님).
        gradingCriteria: k.gradingCriteria,
        // 진척 ──
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
        // 본인 KPI별 자가점검(있으면) — 프론트 prefill용.
        selfCheckIn: ci
          ? {
              kpiId: ci.kpiId,
              selfActualText: ci.selfActualText,
              selfActualValue: ci.selfActualValue,
              selfNote: ci.selfNote,
              selfGrade: ci.selfGrade,
            }
          : null,
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
   * 배정 기반 열람 허용 — (cycleId, evaluateeId) 리뷰의 1차·2차 평가자면 true.
   * canViewUser(조직 가시범위) 로는 못 잡는 경로다: 부서장 판정이 명시 지정(headUserId)이라
   * 계정 role·scope 가 구성원 부서를 포함하지 않는 부서장이 정상적으로 존재한다.
   */
  private async isMidtermReviewerOf(
    viewerId: string,
    cycleId: string,
    evaluateeId: string,
  ): Promise<boolean> {
    const review = await this.prisma.midtermReview.findUnique({
      where: { cycleId_evaluateeId: { cycleId, evaluateeId } },
      select: { firstReviewerId: true, finalReviewerId: true },
    });
    if (!review) return false;
    return review.firstReviewerId === viewerId || review.finalReviewerId === viewerId;
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

    // month>=1 만 집계(month=0 = 전년도 2024 참고 sentinel 제외).
    // 집계=final: 중간점검 조직 진척(달성률·등급)은 확정(final) 실적만. draft(임시저장) 제외.
    const rows = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId, departmentId: { in: deptIds }, month: { gte: 1 }, status: 'final' },
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
   * 달성률 산출 불가(null: 목표값·실적 없음)는 진척과 무관하므로 중립(null) —
   * '주의'로 오표시하지 않는다.
   */
  private signalOf(rate: number | null, _gradeScale: GradeScaleBand[]): ProgressSignal | null {
    if (rate == null) return null;
    if (rate >= 90) return 'on_track';
    if (rate >= 70) return 'at_risk';
    return 'off_track';
  }
}
