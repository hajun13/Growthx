import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvaluationStatus,
  EvaluationType,
  Grade,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import {
  AggregateResultDto,
  ListResultsQuery,
  ResultDetailQuery,
} from './dto/result.dto';

/** byType 비교 항목 (self / downward1 팀장 / downward2 본부장). */
interface ByTypeEntry {
  score: number | null;
  grade: Grade | null;
  comment: string | null;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(current: AuthUser, query: ListResultsQuery) {
    const where: Prisma.EvaluationResultWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;
    if (current.role === Role.employee) where.userId = current.id;

    const rows = await this.prisma.evaluationResult.findMany({ where });
    // 행 수준 추가 필터 (team_lead/division_head)
    const visible: typeof rows = [];
    for (const r of rows) {
      if (await canViewUser(this.prisma, current, r.userId)) visible.push(r);
    }
    return { data: visible, meta: { page: 1, pageSize: visible.length, total: visible.length } };
  }

  async getDetail(current: AuthUser, userId: string, query: ResultDetailQuery) {
    const allowed = await canViewUser(this.prisma, current, userId);
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    const result = await this.prisma.evaluationResult.findUnique({
      where: { userId_cycleId: { userId, cycleId: query.cycleId } },
    });
    if (!result) throw new NotFoundException({ code: 'NOT_FOUND', message: '결과를 찾을 수 없어요.' });
    return result;
  }

  /**
   * 집계 (HR). finalized 평가들을 유형·round 별로 가중 집계해 EvaluationResult 산출.
   * - byType = { self(참고), downward1(팀장), downward2(본부장) } 점수·등급·코멘트
   * - finalScore = 부서장 평가 가중(2차 본부장 우선, 없으면 1차 팀장). self 는 참고만.
   * - finalGrade = finalScore → 등급(gradeScale)
   * - percentile = 같은 cycle 결과 대비 상위 %
   */
  async aggregate(dto: AggregateResultDto) {
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);

    const evals = await this.prisma.evaluation.findMany({
      where: {
        cycleId: dto.cycleId,
        evaluateeId: dto.userId,
        status: EvaluationStatus.finalized,
      },
      include: {
        kpiScores: true,
        comments: { orderBy: { createdAt: 'desc' } },
      },
    });

    // 유형·round 별 항목 산출 (self / downward round 1 / downward round 2)
    const entryFor = (
      type: EvaluationType,
      round: number | null,
    ): ByTypeEntry => {
      const list = evals.filter(
        (e) => e.type === type && (round === null || e.round === round),
      );
      const scored = list.filter((e) => e.totalScore != null);
      if (scored.length === 0) return { score: null, grade: null, comment: null };
      const score =
        Math.round(
          (scored.reduce((s, e) => s + (e.totalScore as number), 0) / scored.length) * 100,
        ) / 100;
      const grade = this.scoring.scoreToGrade(score, rules.gradeScale);
      const latestComment =
        list
          .flatMap((e) => e.comments)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.content ?? null;
      return { score, grade, comment: latestComment };
    };

    const byType = {
      self: entryFor(EvaluationType.self, null),
      downward1: entryFor(EvaluationType.downward, 1),
      downward2: entryFor(EvaluationType.downward, 2),
    };

    // 종합 점수: 2차 본부장 우선 → 1차 팀장 → self(참고) 순. 부서장 평가 가중이 확정 기준.
    const finalScore =
      byType.downward2.score ?? byType.downward1.score ?? byType.self.score ?? null;
    const finalGrade =
      finalScore != null ? this.scoring.scoreToGrade(finalScore, rules.gradeScale) : null;

    // percentile + companyAvg: 같은 cycle 결과 대비
    const allResults = await this.prisma.evaluationResult.findMany({
      where: { cycleId: dto.cycleId },
    });
    const scores = allResults
      .map((r) => r.finalScore)
      .filter((s): s is number => s != null);
    const companyAvg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
    let percentile: number | null = null;
    if (finalScore != null && scores.length) {
      const below = scores.filter((s) => s < finalScore).length;
      percentile = Math.round((1 - below / scores.length) * 100 * 100) / 100;
    }

    return this.prisma.evaluationResult.upsert({
      where: { userId_cycleId: { userId: dto.userId, cycleId: dto.cycleId } },
      create: {
        userId: dto.userId,
        cycleId: dto.cycleId,
        finalGrade,
        finalScore,
        percentile,
        byType: byType as unknown as Prisma.InputJsonValue,
        companyAvg,
      },
      update: {
        finalGrade,
        finalScore,
        percentile,
        byType: byType as unknown as Prisma.InputJsonValue,
        companyAvg,
      },
    });
  }
}
