import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Evaluation,
  EvaluationStatus,
  Grade,
  MeasureType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { CountGradeBand } from '../../common/rules/rule-set.types';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import {
  assertTransition,
  EVALUATION_TRANSITIONS,
} from '../../common/state/transitions';
import {
  AddCommentDto,
  CreateEvaluationDto,
  ListEvaluationsQuery,
  PatchEvaluationDto,
} from './dto/evaluation.dto';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(current: AuthUser, query: ListEvaluationsQuery) {
    const where: Prisma.EvaluationWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.evaluatorId) where.evaluatorId = query.evaluatorId;
    if (query.evaluateeId) where.evaluateeId = query.evaluateeId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    // 행 수준: employee 는 본인이 평가자/피평가자인 것만
    if (current.role === Role.employee) {
      where.OR = [{ evaluatorId: current.id }, { evaluateeId: current.id }];
    }
    const rows = await this.prisma.evaluation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  async getDetail(current: AuthUser, id: string) {
    const ev = await this.prisma.evaluation.findUnique({
      where: { id },
      include: { kpiScores: true, comments: true },
    });
    if (!ev) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가를 찾을 수 없어요.' });
    const allowed =
      ev.evaluatorId === current.id ||
      (await canViewUser(this.prisma, current, ev.evaluateeId));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    return ev;
  }

  async create(current: AuthUser, dto: CreateEvaluationDto) {
    // downward 는 round(1 팀장·2 본부장) 필수, self 는 round 없음.
    const round = dto.type === 'downward' ? (dto.round ?? null) : null;
    if (dto.type === 'downward' && round == null) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: '부서장 평가(downward)는 round(1 팀장·2 본부장)가 필요해요.',
      });
    }
    const existing = await this.prisma.evaluation.findFirst({
      where: {
        cycleId: dto.cycleId,
        evaluatorId: current.id,
        evaluateeId: dto.evaluateeId,
        type: dto.type,
        round,
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'ALREADY_EXISTS', message: '이미 생성된 평가예요.' });
    }
    return this.prisma.evaluation.create({
      data: {
        cycleId: dto.cycleId,
        evaluatorId: current.id,
        evaluateeId: dto.evaluateeId,
        type: dto.type,
        round,
        status: EvaluationStatus.not_started,
      },
    });
  }

  /**
   * KpiScore 입력 + 측정방식별 등급/점수·totalScore 백엔드 재계산.
   * not_started → in_progress.
   * 평가는 KpiScore(과제별 성과)로만 구성된다(역량 항목 없음).
   */
  async patch(current: AuthUser, id: string, dto: PatchEvaluationDto) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    if (ev.status === EvaluationStatus.submitted || ev.status === EvaluationStatus.finalized) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '제출 이후에는 수정할 수 없어요.',
      });
    }

    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.kpiScores) {
        await tx.kpiScore.deleteMany({ where: { evaluationId: id } });
        for (const ks of dto.kpiScores) {
          const kpi = await tx.kpi.findUnique({ where: { id: ks.kpiId } });
          if (!kpi) {
            throw new NotFoundException({
              code: 'NOT_FOUND',
              message: 'KPI를 찾을 수 없어요.',
            });
          }
          // 측정방식별 raw 등급 → 점수 (백엔드 단일 책임)
          const grade = this.scoring.measureToGrade(
            kpi.measureType as MeasureType,
            ks.achievementRate ?? null,
            rules.gradingScales,
            (kpi.grading as unknown as CountGradeBand[] | null) ?? null,
            ks.directGrade ?? null,
          );
          const score = this.scoring.gradeToScore(grade, rules.gradeScale);
          await tx.kpiScore.create({
            data: {
              evaluationId: id,
              kpiId: ks.kpiId,
              achievementRate: ks.achievementRate ?? null,
              grade,
              score,
              weight: ks.weight,
            },
          });
        }
      }

      // totalScore = Σ(score × weight/100) — KPI 과제 집계
      const kpiScores = await tx.kpiScore.findMany({ where: { evaluationId: id } });
      const totalScore = this.scoring.computeTotalScore(
        kpiScores.map((k) => ({ score: k.score, weight: k.weight })),
      );

      await tx.evaluation.update({
        where: { id },
        data: {
          status:
            ev.status === EvaluationStatus.not_started
              ? EvaluationStatus.in_progress
              : ev.status,
          totalScore,
        },
      });
    });

    return this.prisma.evaluation.findUnique({
      where: { id },
      include: { kpiScores: true, comments: true },
    });
  }

  /** 평가 코멘트 추가 (본부장/팀장 필수). */
  async addComment(current: AuthUser, id: string, dto: AddCommentDto) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    return this.prisma.comment.create({
      data: {
        evaluationId: id,
        authorId: current.id,
        quarter: dto.quarter,
        content: dto.content,
      },
    });
  }

  /**
   * in_progress → submitted.
   * - 본부장/팀장 평가자(downward)는 코멘트 필수(없으면 422 COMMENT_REQUIRED).
   * - 그룹 등급 풀 상한 검증(초과 시 422 POOL_EXCEEDED, 제출 차단).
   */
  async submit(current: AuthUser, id: string) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.submitted);

    // 코멘트 필수 (downward: 본부장/팀장)
    if (
      ev.type === 'downward' &&
      (current.role === Role.division_head || current.role === Role.team_lead)
    ) {
      const commentCount = await this.prisma.comment.count({ where: { evaluationId: id } });
      if (commentCount === 0) {
        throw new UnprocessableEntityException({
          code: 'COMMENT_REQUIRED',
          message: '평가 코멘트를 작성해야 제출할 수 있어요.',
        });
      }
    }

    // 그룹 등급 풀 상한 검증 (피평가자가 속한 그룹 기준)
    await this.assertPoolNotExceeded(ev);

    return this.prisma.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.submitted },
    });
  }

  /** submitted → finalized (HR, 캘리브레이션 후). 최종 등급 산출. */
  async finalize(id: string) {
    const ev = await this.findOrThrow(id);
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.finalized);
    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);
    const finalGrade =
      ev.totalScore != null
        ? this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale)
        : null;
    return this.prisma.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.finalized, finalGrade },
    });
  }

  // ── 그룹 풀 상한 검증 ──
  private async assertPoolNotExceeded(ev: Evaluation): Promise<void> {
    const evaluatee = await this.prisma.user.findUnique({
      where: { id: ev.evaluateeId },
      include: { department: true },
    });
    if (!evaluatee?.departmentId) return;

    // 피평가자가 속한 최상위 그룹(group) 찾기: team→division→group 상향 탐색
    const groupId = await this.resolveGroupId(evaluatee.departmentId);
    if (!groupId) return;

    const pool = await this.prisma.gradePool.findUnique({
      where: { cycleId_groupId: { cycleId: ev.cycleId, groupId } },
    });
    if (!pool) return; // 풀 미산정 시 통과

    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);

    // 그룹에 속한 모든 사용자(그룹 하위 트리 전체) 수집
    const memberIds = await this.collectGroupMemberIds(groupId);

    const submitted = await this.prisma.evaluation.findMany({
      where: {
        cycleId: ev.cycleId,
        type: ev.type,
        round: ev.round,
        evaluateeId: { in: memberIds },
        status: { in: [EvaluationStatus.submitted, EvaluationStatus.finalized] },
      },
    });

    const grades: Grade[] = submitted
      .filter((e) => e.totalScore != null)
      .map((e) => this.scoring.scoreToGrade(e.totalScore as number, rules.gradeScale));
    // 이번 제출 건 등급 추가
    if (ev.totalScore != null) {
      grades.push(this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale));
    }

    const result = this.scoring.checkPool(grades, pool.tier, rules.poolRatios);
    if (!result.ok) {
      throw new UnprocessableEntityException({
        code: 'POOL_EXCEEDED',
        message: '그룹 등급 풀 상한을 초과해 제출할 수 없어요. 캘리브레이션이 필요해요.',
        details: result.violations,
      });
    }
  }

  /** 부서 id 에서 상위로 올라가며 group 타입 부서 id 를 찾는다. */
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

  /** group 하위 트리(division·team)에 속한 모든 사용자 id. */
  private async collectGroupMemberIds(groupId: string): Promise<string[]> {
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
    const users = await this.prisma.user.findMany({
      where: { departmentId: { in: deptIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // ── helpers ──
  private async findOrThrow(id: string): Promise<Evaluation> {
    const ev = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가를 찾을 수 없어요.' });
    return ev;
  }

  private assertEvaluator(current: AuthUser, ev: Evaluation): void {
    if (ev.evaluatorId !== current.id && current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '배정된 평가자만 작성할 수 있어요.',
      });
    }
  }
}
