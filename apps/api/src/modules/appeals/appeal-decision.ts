import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Appeal,
  AppealDecisionType,
  AppealStatus,
  EvaluationResult,
  EvaluationStatus,
  EvaluationType,
  Grade,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { assertFinalStage } from '../../common/state/cycle-stage';
import { CompensationsService } from '../compensations/compensations.service';
import { AuthUser } from '../../common/decorators/current-user';
import { groupRootOf } from '../../common/access/access.util';
import { DecideAppealDto } from './dto/appeal.dto';

/** 결정 시 appeal 에 기록할 공통 필드(어느 경로든 동일 shape). */
export function appealDecisionData(
  dto: DecideAppealDto,
  actorId: string,
  nextStatus: AppealStatus,
  decidedAt: Date,
): Prisma.AppealUpdateInput {
  return {
    status: nextStatus,
    decision: dto.reason,
    decisionType: dto.decisionType,
    newScore: dto.newScore ?? null,
    newGrade: dto.newGrade ?? null,
    decidedBy: { connect: { id: actorId } },
    decidedAt,
  };
}

/**
 * 이의제기 HR 최종 결정 캐스케이드 (3B-3, 고위험).
 * 확정 결과·보상 사후 변경은 전 경로 audit 필수 + 원자성($transaction).
 * appeals.service 의 decide() 가 위임 — 파일당 ~200줄 상한 준수를 위해 분리.
 */
export class AppealDecisionCascade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly scoring: ScoringService,
    private readonly compensations: CompensationsService,
  ) {}

  /**
   * 결정 유형별 분기.
   * 반환 appealPersisted=true 면 캐스케이드가 tx 안에서 appeal 을 이미 갱신함(decide() 는 재갱신 금지).
   * - uphold/reject: 변경 없음 → closed (appeal 갱신은 decide() 담당).
   * - score_adjust: [final-stage 선검사] → tx{result.update + appeal.update} → audit → 보상 재계산.
   * - grade_adjust: [final-stage 선검사] → tx{result.update + appeal.update} → audit(풀 위반 경고) → 보상 재계산.
   * - reevaluate: [409 선검사] → tx{downward 재오픈 + appeal.update(answered)} → audit.
   */
  async apply(
    current: AuthUser,
    appeal: Appeal,
    dto: DecideAppealDto,
    decidedAt: Date,
  ): Promise<{ nextStatus: AppealStatus; poolOverride: boolean; appealPersisted: boolean }> {
    switch (dto.decisionType) {
      case AppealDecisionType.uphold:
      case AppealDecisionType.reject:
        return { nextStatus: AppealStatus.closed, poolOverride: false, appealPersisted: false };
      case AppealDecisionType.score_adjust:
        await this.scoreAdjust(current, appeal, dto, decidedAt);
        return { nextStatus: AppealStatus.closed, poolOverride: false, appealPersisted: true };
      case AppealDecisionType.grade_adjust: {
        const poolOverride = await this.gradeAdjust(current, appeal, dto, decidedAt);
        return { nextStatus: AppealStatus.closed, poolOverride, appealPersisted: true };
      }
      case AppealDecisionType.reevaluate:
        await this.reevaluate(current, appeal, dto, decidedAt);
        // 재평가는 진행 중 — appeal 은 answered 유지(재집계 후 HR 이 재결정으로 closed).
        return { nextStatus: AppealStatus.answered, poolOverride: false, appealPersisted: true };
      default:
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '알 수 없는 결정 유형이에요.',
        });
    }
  }

  /**
   * 점수수정: [final-stage 선게이팅] → tx{finalScore/finalGrade + appeal closed} → audit → 보상 재계산.
   * 선게이팅으로 비최종 사이클에선 어떤 mutation 도 발생하지 않음(부분 변경 방지).
   */
  private async scoreAdjust(
    current: AuthUser,
    appeal: Appeal,
    dto: DecideAppealDto,
    decidedAt: Date,
  ): Promise<void> {
    if (dto.newScore == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '점수수정에는 새 점수(newScore)가 필요해요.',
      });
    }
    const result = await this.loadResult(appeal.resultId);
    await this.assertFinalStageForResult(result);
    const rules = await this.scoring.loadRuleSetForCycle(result.cycleId);
    const newGrade = this.scoring.scoreToGrade(dto.newScore, rules.gradeScale);

    // 원자성: 결과 수정 + appeal 종료를 한 트랜잭션으로(부분 실패 방지).
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.evaluationResult.update({
        where: { id: result.id },
        data: { finalScore: dto.newScore, finalGrade: newGrade },
      });
      await tx.appeal.update({
        where: { id: appeal.id },
        data: appealDecisionData(dto, current.id, AppealStatus.closed, decidedAt),
      });
      return r;
    });

    await this.audit.record({
      entity: 'EvaluationResult',
      entityId: result.id,
      action: 'evaluation_result.appeal_score_adjust',
      actorId: current.id,
      before: { finalScore: result.finalScore, finalGrade: result.finalGrade },
      after: {
        finalScore: updated.finalScore,
        finalGrade: updated.finalGrade,
        appealId: appeal.id,
      },
    });
    await this.recomputeCompensation(current, result, appeal.id);
  }

  /**
   * 등급수정: [final-stage 선게이팅] → tx{finalGrade override + appeal closed} → audit(풀 위반 경고) → 보상 재계산.
   * 풀 상한 위반=차단 안 함(HR override), 감사에 poolOverride 경고.
   */
  private async gradeAdjust(
    current: AuthUser,
    appeal: Appeal,
    dto: DecideAppealDto,
    decidedAt: Date,
  ): Promise<boolean> {
    if (dto.newGrade == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '등급수정에는 새 등급(newGrade)이 필요해요.',
      });
    }
    const result = await this.loadResult(appeal.resultId);
    await this.assertFinalStageForResult(result);
    const poolOverride = await this.exceedsPoolCap(result, dto.newGrade);

    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.evaluationResult.update({
        where: { id: result.id },
        data: { finalGrade: dto.newGrade },
      });
      await tx.appeal.update({
        where: { id: appeal.id },
        data: appealDecisionData(dto, current.id, AppealStatus.closed, decidedAt),
      });
      return r;
    });

    await this.audit.record({
      entity: 'EvaluationResult',
      entityId: result.id,
      action: 'evaluation_result.appeal_grade_adjust',
      actorId: current.id,
      before: { finalGrade: result.finalGrade },
      after: {
        finalGrade: updated.finalGrade,
        appealId: appeal.id,
        // 풀 상한 초과여도 HR override 허용 — 경고만 기록.
        poolOverride,
      },
    });
    await this.recomputeCompensation(current, result, appeal.id);
    return poolOverride;
  }

  /**
   * 재평가: 대상 (cycleId,userId) 의 finalized downward 평가(들)를 in_progress 로 재오픈.
   * [409 선검사] → tx{downward 재오픈 + appeal answered 유지} → 평가별 audit(HR override).
   */
  private async reevaluate(
    current: AuthUser,
    appeal: Appeal,
    dto: DecideAppealDto,
    decidedAt: Date,
  ): Promise<void> {
    const result = await this.loadResult(appeal.resultId);
    const downward = await this.prisma.evaluation.findMany({
      where: {
        cycleId: result.cycleId,
        evaluateeId: result.userId,
        type: EvaluationType.downward,
        status: EvaluationStatus.finalized,
      },
      select: { id: true, status: true },
    });
    // 409 는 tx 진입 전에(재오픈 대상 없으면 appeal 도 안 건드림).
    if (downward.length === 0) {
      throw new ConflictException({
        code: 'NO_REOPENABLE_EVALUATION',
        message: '재오픈할 확정된 부서장 평가가 없어요.',
      });
    }

    // 원자성: 다건 재오픈 + appeal 갱신을 한 트랜잭션으로.
    await this.prisma.$transaction(async (tx) => {
      for (const ev of downward) {
        // HR override: finalized → in_progress 는 정상 전이 맵에 없음(전용 경로).
        await tx.evaluation.update({
          where: { id: ev.id },
          data: { status: EvaluationStatus.in_progress },
        });
      }
      await tx.appeal.update({
        where: { id: appeal.id },
        data: appealDecisionData(dto, current.id, AppealStatus.answered, decidedAt),
      });
    });

    // 부수효과(audit)는 tx 후 순차 기록.
    for (const ev of downward) {
      await this.audit.record({
        entity: 'Evaluation',
        entityId: ev.id,
        action: 'evaluation.reopen_by_appeal',
        actorId: current.id,
        before: { status: ev.status },
        after: { status: EvaluationStatus.in_progress, appealId: appeal.id, override: true },
      });
    }
  }

  /**
   * 보상 재계산(cycle 전체 재산정, 멱등). 수동 CompensationAdjustment 는 compute 가 위에 얹어 보존.
   * compute 는 자체 $transaction·멱등이라 final-stage 선검사 후엔 안전(부수효과로 tx 밖 호출).
   */
  private async recomputeCompensation(
    current: AuthUser,
    result: EvaluationResult,
    appealId: string,
  ): Promise<void> {
    // 사후변경 추적: 재계산 전 이 사용자의 실제 Compensation 스냅샷을 audit before 에 기록.
    const before = await this.prisma.compensation.findFirst({
      where: { cycleId: result.cycleId, userId: result.userId, simulated: false },
      select: { finalGrade: true, raiseRate: true, nextYearSalary: true },
    });
    // 실제 연동(simulated=false)만 확정 결과에 반영. compute 는 CompensationAdjustment 를
    // 조회해 salaryBeforeAdjustment 위에 더할 뿐 삭제/덮어쓰지 않으므로 수동 조정분 보존.
    await this.compensations.compute({ cycleId: result.cycleId, simulated: false });
    const after = await this.prisma.compensation.findFirst({
      where: { cycleId: result.cycleId, userId: result.userId, simulated: false },
      select: { finalGrade: true, raiseRate: true, nextYearSalary: true },
    });
    await this.audit.record({
      entity: 'Compensation',
      entityId: `${result.cycleId}:${result.userId}`,
      action: 'compensation.recompute_by_appeal',
      actorId: current.id,
      before: before ?? null,
      after: { ...(after ?? {}), cycleId: result.cycleId, userId: result.userId, appealId },
    });
  }

  private async loadResult(resultId: string): Promise<EvaluationResult> {
    const result = await this.prisma.evaluationResult.findUnique({
      where: { id: resultId },
    });
    if (!result) {
      throw new BadRequestException({
        code: 'NOT_FOUND',
        message: '이의제기 대상 평가 결과를 찾을 수 없어요.',
      });
    }
    return result;
  }

  /** 확정 결과·등급 수정은 최종단계(calibration/closed) 사이클에서만. 비최종=400(mutation 0). */
  private async assertFinalStageForResult(result: EvaluationResult): Promise<void> {
    await assertFinalStage(
      this.prisma,
      result.cycleId,
      '최종평가(조정/완료) 단계에서만 이의제기 결과·등급을 수정할 수 있어요.',
    );
  }

  /**
   * 풀 상한 위반 여부(경고용, 차단 안 함). 대상 그룹의 GradePool 이 산정돼 있으면
   * 새 등급 cap 대비 현재 보유자 수를 비교. 풀 미산정 시 false(경고 없음).
   */
  private async exceedsPoolCap(
    result: EvaluationResult,
    newGrade: Grade,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
      select: { departmentId: true },
    });
    const groupId = user?.departmentId
      ? await groupRootOf(this.prisma, user.departmentId)
      : null;
    if (!groupId) return false;
    const pool = await this.prisma.gradePool.findUnique({
      where: { cycleId_groupId: { cycleId: result.cycleId, groupId } },
    });
    if (!pool) return false;
    const deptIds = await this.groupDeptIds(groupId);
    const headcount = await this.prisma.user.count({
      where: { departmentId: { in: deptIds }, isActive: true, evaluationExempt: false },
    });
    const ratio: Record<Grade, number> = {
      S: pool.sRatio,
      A: pool.aRatio,
      B: pool.bRatio,
      C: pool.cRatio,
      D: pool.dRatio,
    };
    const cap = Math.ceil((ratio[newGrade] / 100) * headcount);
    // 이 그룹에서 newGrade 를 이미 보유한 결과 수(이번 대상 제외).
    const holders = await this.prisma.evaluationResult.count({
      where: {
        cycleId: result.cycleId,
        finalGrade: newGrade,
        id: { not: result.id },
        user: { departmentId: { in: deptIds } },
      },
    });
    return holders + 1 > cap;
  }

  /** 그룹 하위 전체 부서 id(BFS). */
  private async groupDeptIds(groupId: string): Promise<string[]> {
    const deptIds = [groupId];
    let frontier = [groupId];
    for (let depth = 0; depth < 5 && frontier.length; depth++) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      deptIds.push(...childIds);
      frontier = childIds;
    }
    return deptIds;
  }
}
