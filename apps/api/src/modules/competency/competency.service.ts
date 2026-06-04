import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetencyQuestion,
  CompetencyResponse,
  CycleType,
  Grade,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import {
  BulkCompetencyResponseDto,
  CompetencyResponseSummaryQuery,
  CreateCompetencyQuestionDto,
  ListCompetencyQuestionsQuery,
  ListCompetencyResponsesQuery,
  UpdateCompetencyQuestionDto,
} from './dto/competency.dto';

/**
 * 역량 평가 문항 관리 + 응답 (M3 Item 6).
 * 성과 평가(KPI)와 별개. 연봉 미반영(참고 데이터). 질문은 hr_admin 설정, 응답은 임직원.
 */
@Injectable()
export class CompetencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───────────── 질문(Question) ─────────────

  async listQuestions(query: ListCompetencyQuestionsQuery) {
    const rows = await this.prisma.competencyQuestion.findMany({
      where: { cycleId: query.cycleId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const data = rows.map((q) => this.toQuestionDto(q));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async createQuestion(current: AuthUser, dto: CreateCompetencyQuestionDto) {
    // MIDTERM 주기에는 역량평가 사용 불가
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { cycleType: true },
    });
    if (cycle?.cycleType === CycleType.MIDTERM) {
      throw new BadRequestException('중간평가(MIDTERM) 주기에는 역량평가를 사용할 수 없습니다');
    }

    // 해당 cycleId 기존 문항 수 체크 (최대 10개)
    const existingCount = await this.prisma.competencyQuestion.count({
      where: { cycleId: dto.cycleId },
    });
    if (existingCount >= 10) {
      throw new BadRequestException('역량평가 문항은 최대 10개까지 등록할 수 있습니다');
    }

    const row = await this.prisma.competencyQuestion.create({
      data: {
        cycleId: dto.cycleId,
        text: dto.text,
        hint: dto.hint ?? null,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        createdById: current.id,
      },
    });
    await this.audit.record({
      entity: 'CompetencyQuestion',
      entityId: row.id,
      action: 'competency_question.create',
      actorId: current.id,
      after: { text: row.text },
    });
    return this.toQuestionDto(row);
  }

  async updateQuestion(
    current: AuthUser,
    id: string,
    dto: UpdateCompetencyQuestionDto,
  ) {
    await this.findQuestionOrThrow(id);
    const row = await this.prisma.competencyQuestion.update({
      where: { id },
      data: {
        text: dto.text ?? undefined,
        hint: dto.hint ?? undefined,
        order: dto.order ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.record({
      entity: 'CompetencyQuestion',
      entityId: id,
      action: 'competency_question.update',
      actorId: current.id,
      after: { ...dto },
    });
    return this.toQuestionDto(row);
  }

  async removeQuestion(current: AuthUser, id: string) {
    await this.findQuestionOrThrow(id);
    await this.prisma.competencyQuestion.delete({ where: { id } });
    await this.audit.record({
      entity: 'CompetencyQuestion',
      entityId: id,
      action: 'competency_question.delete',
      actorId: current.id,
    });
    return { id, deleted: true };
  }

  // ───────────── 응답(Response) ─────────────

  async listResponses(current: AuthUser, query: ListCompetencyResponsesQuery) {
    // 대상 userId 결정: employee 는 본인만, 그 외는 query.userId(가시 범위 검사).
    let targetUserId = query.userId;
    if (current.role === Role.employee) {
      targetUserId = current.id;
    } else if (targetUserId) {
      const allowed = await canViewUser(this.prisma, current, targetUserId);
      if (!allowed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '응답 조회 권한이 없어요.',
        });
      }
    }

    const where: Prisma.CompetencyResponseWhereInput = { cycleId: query.cycleId };
    if (targetUserId) where.userId = targetUserId;

    const rows = await this.prisma.competencyResponse.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const data = rows.map((r) => this.toResponseDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** 일괄 응답 제출(본인만). questionId·userId·cycleId 단위 upsert. submit=true → submittedAt 기록. */
  async bulkRespond(current: AuthUser, dto: BulkCompetencyResponseDto) {
    // MIDTERM 주기에는 역량평가 사용 불가
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { cycleType: true },
    });
    if (cycle?.cycleType === CycleType.MIDTERM) {
      throw new BadRequestException('중간평가(MIDTERM) 주기에는 역량평가를 사용할 수 없습니다');
    }

    const submittedAt = dto.submit ? new Date() : null;

    // 질문 유효성: 해당 cycle 의 활성 질문 집합 내인지 검증.
    const questions = await this.prisma.competencyQuestion.findMany({
      where: { cycleId: dto.cycleId },
      select: { id: true },
    });
    const validIds = new Set(questions.map((q) => q.id));

    const saved: CompetencyResponse[] = [];
    for (const item of dto.responses) {
      if (!validIds.has(item.questionId)) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: `질문 '${item.questionId}' 을 찾을 수 없어요.`,
        });
      }
      const row = await this.prisma.competencyResponse.upsert({
        where: {
          questionId_userId_cycleId: {
            questionId: item.questionId,
            userId: current.id,
            cycleId: dto.cycleId,
          },
        },
        create: {
          questionId: item.questionId,
          userId: current.id,
          cycleId: dto.cycleId,
          grade: item.grade,
          comment: item.comment ?? null,
          submittedAt,
        },
        update: {
          grade: item.grade,
          comment: item.comment ?? null,
          ...(submittedAt ? { submittedAt } : {}),
        },
      });
      saved.push(row);
    }

    await this.audit.record({
      entity: 'CompetencyResponse',
      entityId: current.id,
      action: dto.submit ? 'competency_response.submit' : 'competency_response.save',
      actorId: current.id,
      after: { cycleId: dto.cycleId, count: saved.length },
    });

    const data = saved.map((r) => this.toResponseDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 집계 (관리자/부서장). 질문별 등급 분포 + 응답자 수.
   * departmentId 지정 시 해당 부서(하위 트리) 소속 응답만 — 가시 범위는 호출 컨트롤러 RBAC 로 1차 제한.
   */
  async summary(current: AuthUser, query: CompetencyResponseSummaryQuery) {
    const userFilter: Prisma.CompetencyResponseWhereInput['user'] = query.departmentId
      ? { departmentId: query.departmentId }
      : undefined;

    const rows = await this.prisma.competencyResponse.findMany({
      where: {
        cycleId: query.cycleId,
        ...(userFilter ? { user: userFilter } : {}),
      },
      include: { question: { select: { id: true, text: true, order: true } } },
    });

    // 질문별 등급 분포.
    const byQuestionMap = new Map<
      string,
      {
        questionId: string;
        text: string;
        order: number;
        grades: Record<Grade, number>;
        responseCount: number;
      }
    >();
    const respondents = new Set<string>();
    for (const r of rows) {
      respondents.add(r.userId);
      const key = r.questionId;
      let bucket = byQuestionMap.get(key);
      if (!bucket) {
        bucket = {
          questionId: r.questionId,
          text: r.question?.text ?? r.questionId,
          order: r.question?.order ?? 0,
          grades: zeroGrades(),
          responseCount: 0,
        };
        byQuestionMap.set(key, bucket);
      }
      bucket.grades[r.grade]++;
      bucket.responseCount++;
    }

    const byQuestion = Array.from(byQuestionMap.values()).sort(
      (a, b) => a.order - b.order,
    );

    return {
      data: {
        cycleId: query.cycleId,
        departmentId: query.departmentId ?? null,
        respondentCount: respondents.size,
        totalResponses: rows.length,
        note: '본 평가는 연봉에 반영되지 않습니다.',
        byQuestion,
      },
    };
  }

  // ── helpers ──
  private async findQuestionOrThrow(id: string): Promise<CompetencyQuestion> {
    const q = await this.prisma.competencyQuestion.findUnique({ where: { id } });
    if (!q) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '역량 평가 질문을 찾을 수 없어요.',
      });
    }
    return q;
  }

  private toQuestionDto(q: CompetencyQuestion) {
    return {
      id: q.id,
      cycleId: q.cycleId,
      order: q.order,
      text: q.text,
      hint: q.hint,
      isActive: q.isActive,
      createdById: q.createdById,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }

  private toResponseDto(r: CompetencyResponse) {
    return {
      id: r.id,
      questionId: r.questionId,
      userId: r.userId,
      cycleId: r.cycleId,
      grade: r.grade,
      comment: r.comment,
      submittedAt: r.submittedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

function zeroGrades(): Record<Grade, number> {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 };
}
