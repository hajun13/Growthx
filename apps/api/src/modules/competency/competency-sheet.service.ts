import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationType, Grade, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { WeightPolicy } from '../../common/rules/rule-set.types';
import { isFinalStage } from '../../common/state/cycle-stage';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, resolveDownwardEvaluators } from '../../common/access/access.util';
import {
  COMPETENCY_EVALUATOR_STAGES,
  CompetencyStage,
  resolveCompetencyTargetGroup,
  resolveWriterStage,
} from './competency-stage.util';

const GRADE_SCORE: Record<Grade, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

/**
 * 역량평가서(시트) 조회 — 엑셀 역량평가서 재현에 필요한 모든 데이터를 한 번에 구성.
 * 문항 + 본인/1차/2차/최종 응답 + 종합의견 + 평가선(체인) + 평가점수 환산.
 * 환산 규칙(엑셀 각주 그대로): 평가자별 Σ(점수×문항가중치)/만점×100 →
 * 1차 50%·2차 30%·최종 20% 합산, 평가자 동일인 예외①(1차=최종→100%)·②(2차=최종→70/30).
 * 본인평가는 환산에 미반영(참고 표기). 점수 결합은 실적평가와 동일 로직(ScoringService) 재사용.
 */
@Injectable()
export class CompetencySheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async getSheet(current: AuthUser, query: { cycleId: string; userId?: string }) {
    const targetUserId = query.userId ?? current.id;
    const [cycle, target] = await Promise.all([
      this.prisma.evaluationCycle.findUnique({
        where: { id: query.cycleId },
        select: { id: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          role: true,
          position: true,
          department: { select: { name: true } },
        },
      }),
    ]);
    if (!cycle) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 주기를 찾을 수 없어요.' });
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: '대상 사용자를 찾을 수 없어요.' });

    const myStage = await resolveWriterStage(this.prisma, cycle.id, current.id, targetUserId);
    const isHr = current.role === Role.hr_admin || current.scope === VisibilityScope.company;
    const isSelfView = current.id === targetUserId;

    // 접근: HR/전사 스코프·평가선 구성원은 전체 열람. 본인은 자기 시트(평가자 열은 완료 후 공개).
    // 그 외에는 가시 범위 내 관리자만(일반 직원의 타인 시트 열람 차단).
    if (!isHr && !isSelfView && myStage === null) {
      const allowed =
        current.role !== Role.employee &&
        (await canViewUser(this.prisma, current, targetUserId));
      if (!allowed) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '역량평가서를 볼 권한이 없어요.' });
      }
    }
    // 본인 조기열람 게이트: 평가자 열·종합의견·환산 점수는 주기 완료(closed) 후 공개.
    const scoresVisible = !isSelfView || isHr || cycle.status === 'closed';

    // 문항: 피평가자 대상군 기준 — 한 사람에게 정확히 한 세트만(직책 is_management 우선, 없으면 role 폴백).
    const targetGroup = await resolveCompetencyTargetGroup(this.prisma, target);
    const questions = await this.prisma.competencyQuestion.findMany({
      where: {
        cycleId: cycle.id,
        isActive: true,
        targetGroup: { in: [targetGroup, 'all'] },
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const [rowsAll, opinionRows, chain] = await Promise.all([
      this.prisma.competencyResponse.findMany({
        where: { cycleId: cycle.id, userId: targetUserId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.competencyOpinion.findMany({
        where: { cycleId: cycle.id, userId: targetUserId },
        include: { evaluator: { select: { name: true } } },
      }),
      resolveDownwardEvaluators(this.prisma, targetUserId),
    ]);

    // 평가선 슬롯(1차/2차/최종) 이름 조회.
    const chainIds = [chain.round1, chain.round2, chain.round3].filter(
      (id): id is string => !!id,
    );
    const chainUsers = chainIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: chainIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(chainUsers.map((u) => [u.id, u.name]));
    const chainSlots = COMPETENCY_EVALUATOR_STAGES.map((stage) => {
      const userId = chain[stage] ?? null;
      return { stage, userId, name: userId ? (nameOf.get(userId) ?? null) : null };
    });

    const visibleRows = scoresVisible ? rowsAll : rowsAll.filter((r) => r.stage === 'self');
    const visibleOpinions = scoresVisible ? opinionRows : [];

    const conversion = scoresVisible
      ? await this.computeConversion(cycle.id, questions, rowsAll, chain)
      : null;

    return {
      data: {
        cycleId: cycle.id,
        cycleStatus: cycle.status,
        evaluatee: {
          id: target.id,
          name: target.name,
          role: target.role,
          position: target.position ?? null,
          departmentName: target.department?.name ?? null,
        },
        chain: chainSlots,
        myStage,
        canEdit: myStage !== null && isFinalStage(cycle.status),
        scoresVisible,
        questions: questions.map((q) => ({
          id: q.id,
          cycleId: q.cycleId,
          order: q.order,
          text: q.text,
          hint: q.hint,
          categoryId: q.categoryId,
          categoryName: q.category?.name ?? null,
          options: q.options ?? [],
          weight: q.weight,
          targetGroup: q.targetGroup,
          isActive: q.isActive,
          createdById: q.createdById,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        })),
        responses: visibleRows.map((r) => ({
          id: r.id,
          questionId: r.questionId,
          userId: r.userId,
          cycleId: r.cycleId,
          stage: r.stage,
          evaluatorId: r.evaluatorId,
          grade: r.grade,
          comment: r.comment,
          submittedAt: r.submittedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        opinions: visibleOpinions.map((o) => ({
          stage: o.stage,
          evaluatorId: o.evaluatorId,
          evaluatorName: o.evaluator?.name ?? null,
          comment: o.comment,
          updatedAt: o.updatedAt,
        })),
        conversion,
      },
    };
  }

  /**
   * 평가점수 환산 — 엑셀 '역량평가(환산표)2' 재현.
   * 평가자별 점수 = Σ(문항점수 1~5 × 문항가중치)/(5×Σ가중치)×100 (가중치 전부 0이면 균등).
   * 결합 = 실적평가와 동일한 단계가중(기본 50/30/20)+예외①②(RuleSet.weightPolicy 설정 존중).
   */
  private async computeConversion(
    cycleId: string,
    questions: { id: string; weight: number }[],
    rows: { questionId: string; stage: string; grade: Grade }[],
    chain: { round1?: string; round2?: string; round3?: string; finalAlsoSecond?: boolean },
  ) {
    const useWeights = questions.some((q) => q.weight > 0);
    const weightOf = new Map(questions.map((q) => [q.id, useWeights ? q.weight : 1]));

    const stageScore = (stage: CompetencyStage): number | null => {
      let num = 0;
      let den = 0;
      for (const r of rows) {
        if (r.stage !== stage) continue;
        const w = weightOf.get(r.questionId);
        if (!w || w <= 0) continue;
        num += GRADE_SCORE[r.grade] * w;
        den += 5 * w;
      }
      if (den === 0) return null;
      return Math.round((num / den) * 100 * 100) / 100;
    };

    const scores = {
      round1: stageScore('round1'),
      round2: stageScore('round2'),
      round3: stageScore('round3'),
    };
    const self = stageScore('self');

    const rules = await this.scoring.loadRuleSetForCycle(cycleId);
    const wp = rules.weightPolicy as WeightPolicy;
    // 예외② 겸직(그룹장이 2차 자리 겸직) 인식 — 결과 집계와 동일하게 가상 round2 평가자 주입.
    const evaluators = {
      round1: chain.round1 ?? null,
      round2: chain.round2 ?? (chain.finalAlsoSecond ? (chain.round3 ?? null) : null),
      round3: chain.round3 ?? null,
    };
    const combined = this.scoring.combineStagesWithExceptions(
      scores,
      evaluators,
      wp.stageWeights ?? wp.evaluatorWeights ?? null,
      wp.stageExceptionWeights ?? null,
    );

    return {
      self,
      round1: scores.round1,
      round2: scores.round2,
      round3: scores.round3,
      combined: combined.score != null ? Math.round(combined.score * 100) / 100 : null,
      mode: combined.mode,
    };
  }

  /** 내가 평가자로 배정된 역량평가 대상 목록(하향 평가 배정과 동일 평가선) + 내 열 작성 진행. */
  async listTargets(current: AuthUser, cycleId: string) {
    const assignments = await this.prisma.evaluation.findMany({
      where: { cycleId, evaluatorId: current.id, type: EvaluationType.downward },
      select: {
        round: true,
        evaluatee: {
          select: {
            id: true,
            name: true,
            role: true,
            position: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { round: 'asc' },
    });
    // 동일 대상 다중 배정(이론상) 시 최고 단계 유지.
    const byUser = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments) {
      if (!a.evaluatee || !a.round) continue;
      const prev = byUser.get(a.evaluatee.id);
      if (!prev || (prev.round ?? 0) < a.round) byUser.set(a.evaluatee.id, a);
    }

    const questionCounts = await this.questionCountByGroup(cycleId);
    const targetIds = Array.from(byUser.keys());
    const myRows = targetIds.length
      ? await this.prisma.competencyResponse.findMany({
          where: { cycleId, evaluatorId: current.id, userId: { in: targetIds } },
          select: { userId: true, stage: true, submittedAt: true },
        })
      : [];

    const entries = Array.from(byUser.values());
    const targetGroups = await Promise.all(
      entries.map((a) => resolveCompetencyTargetGroup(this.prisma, a.evaluatee!)),
    );

    const data = entries
      .map((a, i) => {
        const u = a.evaluatee!;
        const stage = `round${a.round}` as CompetencyStage;
        const mine = myRows.filter((r) => r.userId === u.id && r.stage === stage);
        const questionCount =
          targetGroups[i] === 'manager' ? questionCounts.manager : questionCounts.nonManager;
        return {
          userId: u.id,
          name: u.name,
          departmentName: u.department?.name ?? null,
          position: u.position ?? null,
          myStage: stage,
          questionCount,
          answeredCount: mine.length,
          submitted: mine.length > 0 && mine.every((r) => r.submittedAt != null),
        };
      })
      .sort(
        (a, b) =>
          (a.departmentName ?? '').localeCompare(b.departmentName ?? '', 'ko') ||
          (a.name ?? '').localeCompare(b.name ?? '', 'ko'),
      );
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 결합 환산 점수 단독 산출 — 결과 집계(EvaluationResult.byType.compScore)용.
   * 평가자(1차/2차/최종) 제출 응답만으로 엑셀 환산 규칙을 적용한다(본인 제외).
   * 평가자 응답이 하나도 없으면 null(미실시).
   */
  async convertedCombinedScore(cycleId: string, userId: string): Promise<number | null> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, position: true },
    });
    if (!target) return null;
    const targetGroup = await resolveCompetencyTargetGroup(this.prisma, target);
    const [questions, rows] = await Promise.all([
      this.prisma.competencyQuestion.findMany({
        where: {
          cycleId,
          isActive: true,
          targetGroup: { in: [targetGroup, 'all'] },
        },
        select: { id: true, weight: true },
      }),
      this.prisma.competencyResponse.findMany({
        where: { cycleId, userId, submittedAt: { not: null } },
        select: { questionId: true, stage: true, grade: true },
      }),
    ]);
    if (!rows.some((r) => r.stage !== 'self')) return null;
    const chain = await resolveDownwardEvaluators(this.prisma, userId);
    const conv = await this.computeConversion(cycleId, questions, rows, chain);
    return conv.combined;
  }

  /**
   * 종합의견 저장 — 엑셀 [종합의견] 블록. 평가자 단계(1차/2차/최종)별 1건 upsert.
   * 본인(self)은 종합의견이 없다(엑셀 양식 동일). 빈 내용 저장 = 삭제.
   */
  async saveOpinion(
    current: AuthUser,
    dto: { cycleId: string; userId: string; comment: string },
  ) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { status: true },
    });
    if (!cycle || !isFinalStage(cycle.status)) {
      throw new BadRequestException(
        '중간 점검 단계에서는 역량평가를 진행하지 않습니다. 최종평가(조정/완료) 단계에서만 가능해요.',
      );
    }
    const stage = await resolveWriterStage(this.prisma, dto.cycleId, current.id, dto.userId);
    if (!stage || stage === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '종합의견은 이 사용자의 1차/2차/최종 평가자만 작성할 수 있어요.',
      });
    }
    const comment = dto.comment.trim();
    const key = {
      cycleId_userId_stage: { cycleId: dto.cycleId, userId: dto.userId, stage },
    };
    if (!comment) {
      await this.prisma.competencyOpinion.deleteMany({
        where: { cycleId: dto.cycleId, userId: dto.userId, stage },
      });
      return { data: null };
    }
    const row = await this.prisma.competencyOpinion.upsert({
      where: key,
      create: {
        cycleId: dto.cycleId,
        userId: dto.userId,
        stage,
        evaluatorId: current.id,
        comment,
      },
      update: { evaluatorId: current.id, comment },
      include: { evaluator: { select: { name: true } } },
    });
    return {
      data: {
        stage: row.stage,
        evaluatorId: row.evaluatorId,
        evaluatorName: row.evaluator?.name ?? null,
        comment: row.comment,
        updatedAt: row.updatedAt,
      },
    };
  }

  private async questionCountByGroup(cycleId: string) {
    const rows = await this.prisma.competencyQuestion.findMany({
      where: { cycleId, isActive: true },
      select: { targetGroup: true },
    });
    const all = rows.length;
    const manager = rows.filter((r) => r.targetGroup !== 'non_manager').length;
    const nonManager = rows.filter((r) => r.targetGroup !== 'manager').length;
    return { all, manager, nonManager };
  }
}
