import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvaluationStatus,
  EvaluationType,
  Grade,
  KpiGroup,
  Prisma,
  Role,
  VisibilityScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { ExcelService } from '../excel/excel.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  visibleDeptIds,
  loadDeptTree,
  deptSnapshotFromTree,
} from '../../common/access/access.util';
import {
  AggregateResultDto,
  ExportResultQuery,
  ListResultsQuery,
  ResultDetailQuery,
} from './dto/result.dto';

/** byType 비교 항목 (self / downward1 팀장 / downward2 본부장 / downward3 대표). */
interface ByTypeEntry {
  score: number | null;
  grade: Grade | null;
  comment: string | null;
}

/** B-3d: KPI 그룹별 점수·등급 (performance_core / collaboration_growth). */
interface ByGroupEntry {
  score: number | null;
  grade: Grade | null;
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly excel: ExcelService,
  ) {}

  /**
   * M3 Item 9: 개인 평가 결과 내보내기(접근 권한 검사 후 buffer/html 반환).
   * format=excel → { kind:'excel', buffer }, 그 외(pdf) → { kind:'html', html }.
   */
  async export(current: AuthUser, userId: string, query: ExportResultQuery) {
    const allowed = await canViewUser(this.prisma, current, userId);
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '내보내기 권한이 없어요.' });
    }
    if (query.format === 'excel') {
      const buffer = await this.excel.exportUserResult(userId, query.cycleId);
      return { kind: 'excel' as const, buffer };
    }
    const html = await this.excel.exportUserResultHtml(userId, query.cycleId);
    return { kind: 'html' as const, html };
  }

  async list(current: AuthUser, query: ListResultsQuery) {
    const where: Prisma.EvaluationResultWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;

    // 행 수준 스코프를 DB 레벨에서 적용 — N×전체부서 스캔 방지.
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

    const rows = await this.prisma.evaluationResult.findMany({
      where,
      include: { user: { include: { department: true } } },
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async getDetail(current: AuthUser, userId: string, query: ResultDetailQuery) {
    const allowed = await canViewUser(this.prisma, current, userId);
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    const result = await this.prisma.evaluationResult.findUnique({
      where: { userId_cycleId: { userId, cycleId: query.cycleId } },
      include: { user: { include: { department: true } } },
    });
    if (!result) throw new NotFoundException({ code: 'NOT_FOUND', message: '결과를 찾을 수 없어요.' });
    return this.toDto(result);
  }

  /**
   * byType json 에 `source` 판별자를 보장한다(손실 없는 보강).
   * - 임포트 결과: `source:'import'` + {round1,round2,final} (이미 source 보유 → 그대로).
   * - 라이브 집계: {self/downward1/downward2/...} (source 없음 → 'live' 기본 주입).
   * 라이브 평가자 키를 임포트 결과에 가짜로 채우지 않는다(키 구조 불변).
   * source 가 이미 있으면 절대 덮어쓰지 않는다.
   */
  private withSource(byType: unknown): unknown {
    if (!byType || typeof byType !== 'object') return byType;
    const o = byType as Record<string, unknown>;
    if (typeof o.source === 'string' && o.source.length > 0) return byType;
    // source 누락 → 라이브 집계로 간주(import 는 항상 source 를 기록).
    return { ...o, source: 'live' };
  }

  /** EvaluationResult 행 → camelCase DTO. B-3c userName·departmentName, B-3d byGroup 동봉. */
  private toDto(
    r: {
      id: string;
      userId: string;
      cycleId: string;
      finalGrade: Grade | null;
      finalScore: number | null;
      percentile: number | null;
      byType: unknown;
      byGroup: unknown;
      companyAvg: number | null;
      createdAt: Date;
      updatedAt: Date;
      user?: { name: string; department?: { name: string } | null } | null;
    },
  ) {
    return {
      id: r.id,
      userId: r.userId,
      cycleId: r.cycleId,
      finalGrade: r.finalGrade,
      finalScore: r.finalScore,
      percentile: r.percentile,
      byType: this.withSource(r.byType),
      byGroup: r.byGroup,
      companyAvg: r.companyAvg,
      userName: r.user?.name ?? null,
      departmentName: r.user?.department?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  /**
   * 집계 (HR). finalized 평가들을 유형·round 별로 가중 집계해 EvaluationResult 산출.
   * - byType = { self(참고), downward1(팀장), downward2(본부장) } 점수·등급·코멘트
   * - finalScore = 부서장 평가 가중(2차 본부장 우선, 없으면 1차 팀장). self 는 참고만.
   * - finalGrade = finalScore → 등급(gradeScale)
   * - percentile = 같은 cycle 결과 대비 상위 %
   */
  async aggregate(current: AuthUser, dto: AggregateResultDto) {
    if (current.role !== Role.hr_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '집계 권한이 없어요.' });
    }
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

    // KPI id → group 매핑(B-3d 그룹별 집계용).
    const kpiByGroup = await this.prisma.kpi.findMany({
      where: { cycleId: dto.cycleId, userId: dto.userId },
      select: { id: true, group: true },
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
      downward3: entryFor(EvaluationType.downward, 3),
      source: 'live' as const, // 출처 판별자(임포트 'import' 와 대칭). 소비 측 분기용.
    };

    // 종합 점수: 3단계 가중 평균 (팀장 0.5, 본부장 0.3, 대표 0.2)
    const weightPolicy = (rules.weightPolicy as any);
    const weights = weightPolicy?.evaluatorWeights ?? { teamLeader: 0.5, divisionHead: 0.3, ceo: 0.2 };
    const s1 = byType.downward1.score;  // 팀장 점수
    const s2 = byType.downward2.score;  // 본부장 점수
    const s3 = byType.downward3.score;  // 대표 점수 (round=3)
    let finalScore: number | null = null;
    if (s1 != null || s2 != null || s3 != null) {
      let weighted = 0;
      let totalWeight = 0;
      if (s1 != null) { weighted += s1 * weights.teamLeader;   totalWeight += weights.teamLeader; }
      if (s2 != null) { weighted += s2 * weights.divisionHead; totalWeight += weights.divisionHead; }
      if (s3 != null) { weighted += s3 * weights.ceo;          totalWeight += weights.ceo; }
      finalScore = totalWeight > 0 ? Math.round(weighted / totalWeight) : null;
    }
    const finalGrade =
      finalScore != null ? this.scoring.scoreToGrade(finalScore, rules.gradeScale) : null;

    // ── B-3d: KPI 그룹별(성과중심·협업성장) 점수·등급 집계 ──
    // 확정 기준 평가(downward2 → downward1 → self) 의 KpiScore 를 group 별로 가중 집계.
    const primaryEval =
      evals.find((e) => e.type === EvaluationType.downward && e.round === 3) ??
      evals.find((e) => e.type === EvaluationType.downward && e.round === 2) ??
      evals.find((e) => e.type === EvaluationType.downward && e.round === 1) ??
      evals.find((e) => e.type === EvaluationType.self) ??
      null;

    const groupEntry = (group: KpiGroup): ByGroupEntry => {
      if (!primaryEval) return { score: null, grade: null };
      const kpiIds = primaryEval.kpiScores.map((s) => s.kpiId);
      const kpisInGroup = kpiByGroup.filter(
        (k) => kpiIds.includes(k.id) && k.group === group,
      );
      const scores = primaryEval.kpiScores.filter((s) =>
        kpisInGroup.some((k) => k.id === s.kpiId),
      );
      if (scores.length === 0) return { score: null, grade: null };
      const score = this.scoring.computeTotalScore(
        scores.map((s) => ({ score: s.score, weight: s.weight })),
      );
      return { score, grade: this.scoring.scoreToGrade(score, rules.gradeScale) };
    };

    const byGroup = {
      performance_core: groupEntry(KpiGroup.performance_core),
      collaboration_growth: groupEntry(KpiGroup.collaboration_growth),
    };

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

    // 결함 #7: 라이브 결과도 조직 스냅샷(name + id)을 채운다(distribution 정확 집계).
    //   대상 user 의 현재 departmentId 조상에서 group/division/team 산정. 부서 없으면 모두 null.
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { departmentId: true },
    });
    const deptTree = await loadDeptTree(this.prisma);
    const orgSnap = deptSnapshotFromTree(deptTree, targetUser?.departmentId ?? null);

    const saved = await this.prisma.evaluationResult.upsert({
      where: { userId_cycleId: { userId: dto.userId, cycleId: dto.cycleId } },
      create: {
        userId: dto.userId,
        cycleId: dto.cycleId,
        finalGrade,
        finalScore,
        percentile,
        byType: byType as unknown as Prisma.InputJsonValue,
        byGroup: byGroup as unknown as Prisma.InputJsonValue,
        companyAvg,
        groupSnapshot: orgSnap.groupName,
        divisionSnapshot: orgSnap.divisionName,
        teamSnapshot: orgSnap.teamName,
        groupIdSnapshot: orgSnap.groupId,
        divisionIdSnapshot: orgSnap.divisionId,
        teamIdSnapshot: orgSnap.teamId,
      },
      update: {
        finalGrade,
        finalScore,
        percentile,
        byType: byType as unknown as Prisma.InputJsonValue,
        byGroup: byGroup as unknown as Prisma.InputJsonValue,
        companyAvg,
        groupSnapshot: orgSnap.groupName,
        divisionSnapshot: orgSnap.divisionName,
        teamSnapshot: orgSnap.teamName,
        groupIdSnapshot: orgSnap.groupId,
        divisionIdSnapshot: orgSnap.divisionId,
        teamIdSnapshot: orgSnap.teamId,
      },
      include: { user: { include: { department: true } } },
    });
    return this.toDto(saved);
  }
}
