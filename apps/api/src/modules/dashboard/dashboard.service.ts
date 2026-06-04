import { Injectable } from '@nestjs/common';
import {
  AppealStatus,
  EvaluationStatus,
  EvaluationType,
  Grade,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** HR 대시보드 위젯 집계 (C-3). 한 응답으로 진행률·분포·미제출·이의제기·인상률. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** cycleId 미지정 시 가장 최근 active 주기를 사용. */
  async summary(cycleId?: string) {
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
    const groupBuckets = new Map<string, { groupName: string; grades: Record<Grade, number> }>();
    for (const r of results) {
      if (!r.finalGrade || !r.user?.departmentId) continue;
      const groupId = await this.resolveGroupId(r.user.departmentId);
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

    return {
      data: {
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleStatus: cycle.status,
        progress,
        gradeDistribution: { company, byGroup },
        unsubmittedCount,
        appeals,
        avgRaiseRate,
      },
    };
  }

  private async resolveGroupId(deptId: string): Promise<string | null> {
    let cursor: string | null = deptId;
    for (let i = 0; i < 10 && cursor; i++) {
      const dept = await this.prisma.department.findUnique({ where: { id: cursor } });
      if (!dept) return null;
      if (dept.type === 'group') return dept.id;
      cursor = dept.parentId;
    }
    return null;
  }
}

function zeroGrades(): Record<Grade, number> {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 };
}

function emptyPhase() {
  return { total: 0, submitted: 0, finalized: 0, rate: 0 };
}
