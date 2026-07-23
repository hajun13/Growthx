import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetencyQuestion,
  CompetencyResponse,
  Grade,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isFinalStage } from '../../common/state/cycle-stage';
import { resolveWriterStage } from './competency-stage.util';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, visibleDeptIds } from '../../common/access/access.util';
import {
  BulkCompetencyResponseDto,
  CompetencyResponseSummaryQuery,
  CopyFromCycleDto,
  CreateCompetencyCategoryDto,
  CreateCompetencyQuestionDto,
  ListCompetencyQuestionsQuery,
  ListCompetencyResponsesQuery,
  UpdateCompetencyCategoryDto,
  UpdateCompetencyQuestionDto,
} from './dto/competency.dto';

/** toQuestionDto 입력 — category join 은 선택(있으면 categoryName 채움). */
type QuestionWithCategory = CompetencyQuestion & {
  category?: { id: string; name: string } | null;
};

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

  // ───────────── 카테고리(Category) ─────────────

  async listCategories() {
    const rows = await this.prisma.competencyCategory.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  async createCategory(current: AuthUser, dto: CreateCompetencyCategoryDto) {
    const exists = await this.prisma.competencyCategory.findUnique({
      where: { name: dto.name },
    });
    if (exists) {
      throw new BadRequestException('이미 존재하는 카테고리 이름입니다');
    }
    const row = await this.prisma.competencyCategory.create({
      data: {
        name: dto.name,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.record({
      entity: 'CompetencyCategory',
      entityId: row.id,
      action: 'competency_category.create',
      actorId: current.id,
      after: { name: row.name },
    });
    return row;
  }

  async updateCategory(
    current: AuthUser,
    id: string,
    dto: UpdateCompetencyCategoryDto,
  ) {
    await this.findCategoryOrThrow(id);
    if (dto.name !== undefined) {
      const dup = await this.prisma.competencyCategory.findUnique({
        where: { name: dto.name },
      });
      if (dup && dup.id !== id) {
        throw new BadRequestException('이미 존재하는 카테고리 이름입니다');
      }
    }
    const row = await this.prisma.competencyCategory.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        order: dto.order ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.audit.record({
      entity: 'CompetencyCategory',
      entityId: id,
      action: 'competency_category.update',
      actorId: current.id,
      after: { ...dto },
    });
    return row;
  }

  async removeCategory(current: AuthUser, id: string) {
    await this.findCategoryOrThrow(id);
    const usedBy = await this.prisma.competencyQuestion.count({
      where: { categoryId: id },
    });
    if (usedBy > 0) {
      throw new BadRequestException(
        `이 카테고리를 사용하는 문항이 ${usedBy}개 있어 삭제할 수 없습니다`,
      );
    }
    await this.prisma.competencyCategory.delete({ where: { id } });
    await this.audit.record({
      entity: 'CompetencyCategory',
      entityId: id,
      action: 'competency_category.delete',
      actorId: current.id,
    });
    return { id, deleted: true };
  }

  // ───────────── 질문(Question) ─────────────

  async listQuestions(query: ListCompetencyQuestionsQuery) {
    const rows = await this.prisma.competencyQuestion.findMany({
      where: {
        ...(query.cycleId ? { cycleId: query.cycleId } : {}),
        // 'all'(전체 대상) 문항은 특정 대상군(manager·non_manager) 요청에도 항상 포함.
        // 정확 일치만 하면 기본값 'all'로 등록한 문항이 비HR 사용자에게 안 보임.
        ...(query.targetGroup
          ? { targetGroup: { in: [query.targetGroup, 'all'] } }
          : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const data = rows.map((q) => this.toQuestionDto(q));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async createQuestion(current: AuthUser, dto: CreateCompetencyQuestionDto) {
    // Model B: 역량평가는 최종평가(calibration/closed) 단계에서만. 중간 점검 단계 이전에는 차단.
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { status: true },
    });
    if (!cycle || !isFinalStage(cycle.status)) {
      throw new BadRequestException(
        '중간 점검 단계에서는 역량평가를 진행하지 않습니다. 최종평가(조정/완료) 단계에서만 가능해요.',
      );
    }

    // 해당 cycleId 기존 문항 수 체크 (최대 10개)
    const existingCount = await this.prisma.competencyQuestion.count({
      where: { cycleId: dto.cycleId },
    });
    if (existingCount >= 10) {
      throw new BadRequestException('역량평가 문항은 최대 10개까지 등록할 수 있습니다');
    }

    this.assertOptionsLength(dto.options);
    await this.assertCategoryExists(dto.categoryId);

    const row = await this.prisma.competencyQuestion.create({
      data: {
        cycleId: dto.cycleId,
        text: dto.text,
        hint: dto.hint ?? null,
        categoryId: dto.categoryId,
        options: dto.options ?? [],
        weight: dto.weight ?? 0,
        targetGroup: dto.targetGroup ?? 'all',
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        createdById: current.id,
      },
      include: { category: { select: { id: true, name: true } } },
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
    if (dto.options !== undefined) this.assertOptionsLength(dto.options);
    if (dto.categoryId !== undefined) await this.assertCategoryExists(dto.categoryId);
    const row = await this.prisma.competencyQuestion.update({
      where: { id },
      data: {
        text: dto.text ?? undefined,
        hint: dto.hint ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        options: dto.options ?? undefined,
        weight: dto.weight ?? undefined,
        targetGroup: dto.targetGroup ?? undefined,
        order: dto.order ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
      include: { category: { select: { id: true, name: true } } },
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

  /** 이전 사이클 문항 전체를 현재 사이클로 복사(연도별 문항 이력 재사용). 대상 사이클은 비어 있어야 함. */
  async copyFromCycle(current: AuthUser, dto: CopyFromCycleDto) {
    const sourceQuestions = await this.prisma.competencyQuestion.findMany({
      where: { cycleId: dto.sourceCycleId },
      orderBy: { order: 'asc' },
    });
    if (!sourceQuestions.length) {
      throw new NotFoundException('소스 사이클에 문항이 없습니다');
    }

    const targetCount = await this.prisma.competencyQuestion.count({
      where: { cycleId: dto.targetCycleId },
    });
    if (targetCount > 0) {
      throw new BadRequestException(
        '대상 사이클에 이미 문항이 있습니다. 기존 문항을 먼저 삭제하세요.',
      );
    }

    const created = await this.prisma.$transaction(
      sourceQuestions.map((q) =>
        this.prisma.competencyQuestion.create({
          data: {
            cycleId: dto.targetCycleId,
            text: q.text,
            hint: q.hint,
            categoryId: q.categoryId,
            options: q.options,
            weight: q.weight,
            targetGroup: q.targetGroup,
            order: q.order,
            isActive: q.isActive,
            createdById: current.id,
          },
          include: { category: { select: { id: true, name: true } } },
        }),
      ),
    );

    await this.audit.record({
      entity: 'CompetencyQuestion',
      entityId: dto.targetCycleId,
      action: 'competency_question.copy_from_cycle',
      actorId: current.id,
      after: {
        sourceCycleId: dto.sourceCycleId,
        targetCycleId: dto.targetCycleId,
        count: created.length,
      },
    });

    const data = created.map((q) => this.toQuestionDto(q));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
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
    if (query.stage) where.stage = query.stage;
    // 본인 조기열람 게이트: 자기 시트의 평가자(1차/2차/최종) 열은 주기 완료(closed) 후에만 공개.
    if ((targetUserId ?? current.id) === current.id && current.role !== Role.hr_admin) {
      const cycle = await this.prisma.evaluationCycle.findUnique({
        where: { id: query.cycleId },
        select: { status: true },
      });
      if (cycle?.status !== 'closed') where.stage = 'self';
    }
    if (targetUserId) {
      where.userId = targetUserId;
    } else {
      // userId 미지정: hr_admin/company scope 는 전사(무제한), 그 외는
      // 가시 부서 범위(본인 포함)로 축소 — 전사 응답 노출 방지.
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null) {
        const scopeOr: Prisma.CompetencyResponseWhereInput[] = [{ userId: current.id }];
        if (deptIds.length) {
          scopeOr.push({ user: { departmentId: { in: deptIds } } });
        }
        where.OR = scopeOr;
      }
    }

    // 미제출(draft) 평가자 응답 노출 차단 — getSheet 의 노출 규칙과 동일(제출분 또는 내가 작성한 행).
    // 레거시 목록 API 도 시트와 같은 게이트를 적용해 공개(closed) 후 타 평가자 초안 유출을 막는다.
    // hr_admin 은 보정 목적 예외.
    if (current.role !== Role.hr_admin) {
      where.AND = [{ OR: [{ submittedAt: { not: null } }, { evaluatorId: current.id }] }];
    }

    const rows = await this.prisma.competencyResponse.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const data = rows.map((r) => this.toResponseDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 일괄 응답 저장/제출 — 본인(self) 또는 평가자(1차/2차/최종) 열.
   * targetUserId 미지정(또는 본인)=본인평가, 지정=그 사용자의 시트에 내 단계 열 작성.
   * 단계는 하향 평가 배정(Evaluation)에서 판정 — 배정 없는 사용자는 403.
   * questionId·피평가자·cycleId·stage 단위 upsert. submit=true → submittedAt 기록.
   * grade 미지정(코멘트 단독) 항목도 허용: 기존 행이 있으면 코멘트만 갱신(등급 유지),
   * 기존 행이 없으면 이번 저장에선 건너뜀(DB grade NOT NULL — 등급 선택 시 함께 저장됨).
   */
  async bulkRespond(current: AuthUser, dto: BulkCompetencyResponseDto) {
    // Model B: 역량평가는 최종평가(calibration/closed) 단계에서만. 중간 점검 단계 이전에는 차단.
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { status: true },
    });
    if (!cycle || !isFinalStage(cycle.status)) {
      throw new BadRequestException(
        '중간 점검 단계에서는 역량평가를 진행하지 않습니다. 최종평가(조정/완료) 단계에서만 가능해요.',
      );
    }
    // 완료(closed) 주기 쓰기 게이트 — 평가/KPI 의 closed 쓰기 차단과 동일 정책(종결 연도 불변성).
    // 공개(완료) 후에도 평가자가 제출 등급·코멘트를 고칠 수 있던 구멍. hr_admin 만 보정 목적 예외.
    if (cycle.status === 'closed' && current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'CYCLE_CLOSED',
        message: '완료된 평가 주기에서는 역량평가를 수정할 수 없어요.',
      });
    }

    const targetUserId = dto.targetUserId ?? current.id;
    const stage = await resolveWriterStage(this.prisma, dto.cycleId, current.id, targetUserId);
    if (!stage) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '이 사용자의 역량평가 평가자로 배정되어 있지 않아요.',
      });
    }

    const submittedAt = dto.submit ? new Date() : null;

    // 평가자 교체(재배정) 대응: 이전 평가자가 제출(submittedAt)했던 같은 단계 행을 새 평가자가
    // 임시저장하면, 남아 있는 이전 제출 표식 때문에 새 평가자 화면이 '제출완료'로 잠기던 문제.
    // 임시저장(비제출) 시, 이 단계에서 다른 평가자가 남긴 제출 표식을 초기화한다(내 작성 상태만 잠금).
    if (!dto.submit) {
      await this.prisma.competencyResponse.updateMany({
        where: {
          userId: targetUserId,
          cycleId: dto.cycleId,
          stage,
          evaluatorId: { not: current.id },
          submittedAt: { not: null },
        },
        data: { submittedAt: null },
      });
    }

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
      const uniqueKey = {
        questionId_userId_cycleId_stage: {
          questionId: item.questionId,
          userId: targetUserId,
          cycleId: dto.cycleId,
          stage,
        },
      };
      if (!item.grade) {
        // 코멘트 단독 저장: 등급 미선택 문항의 코멘트가 유실되지 않도록 기존 행의 코멘트만 갱신.
        const existing = await this.prisma.competencyResponse.findUnique({
          where: uniqueKey,
        });
        if (existing) {
          const row = await this.prisma.competencyResponse.update({
            where: { id: existing.id },
            data: {
              comment: item.comment ?? null,
              ...(submittedAt ? { submittedAt } : {}),
            },
          });
          saved.push(row);
        }
        continue;
      }
      const row = await this.prisma.competencyResponse.upsert({
        where: uniqueKey,
        create: {
          questionId: item.questionId,
          userId: targetUserId,
          cycleId: dto.cycleId,
          stage,
          evaluatorId: current.id,
          grade: item.grade,
          comment: item.comment ?? null,
          submittedAt,
        },
        update: {
          evaluatorId: current.id,
          grade: item.grade,
          comment: item.comment ?? null,
          ...(submittedAt ? { submittedAt } : {}),
        },
      });
      saved.push(row);
    }

    await this.audit.record({
      entity: 'CompetencyResponse',
      entityId: targetUserId,
      action: dto.submit ? 'competency_response.submit' : 'competency_response.save',
      actorId: current.id,
      after: { cycleId: dto.cycleId, stage, targetUserId, count: saved.length },
    });

    const data = saved.map((r) => this.toResponseDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 집계 (관리자/부서장). 질문별 등급 분포 + 응답자 수.
   * 컨트롤러 RBAC(role) 1차 제한 + 여기서 visibleDeptIds 로 행 수준 가시 범위 검증:
   *  - hr_admin/company scope: 무제한
   *  - 그 외: departmentId 지정 시 가시 범위 내인지 검증(밖이면 403),
   *           미지정 시 본인 가시 부서 범위로 축소.
   */
  async summary(current: AuthUser, query: CompetencyResponseSummaryQuery) {
    const deptIds = await visibleDeptIds(this.prisma, current); // null = 전사 무제한
    let userFilter: Prisma.CompetencyResponseWhereInput['user'];
    if (query.departmentId) {
      if (deptIds !== null && !deptIds.includes(query.departmentId)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '해당 부서의 역량 집계를 볼 권한이 없어요.',
        });
      }
      userFilter = { departmentId: query.departmentId };
    } else if (deptIds !== null) {
      userFilter = { departmentId: { in: deptIds } };
    }

    const rows = await this.prisma.competencyResponse.findMany({
      where: {
        cycleId: query.cycleId,
        // 집계는 임직원 자가 응답(self) 분포 — 평가자 열 도입 후에도 기존 의미 유지.
        stage: 'self',
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
  /** 보기는 비어있거나(레거시/폴백) 정확히 5개여야 한다. class-validator 로 "0 또는 5"를 표현하기 어려워 서비스에서 검증. */
  private assertOptionsLength(options?: string[]): void {
    if (options && options.length !== 0 && options.length !== 5) {
      throw new BadRequestException('보기는 정확히 5개여야 합니다');
    }
  }

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

  private async findCategoryOrThrow(id: string) {
    const c = await this.prisma.competencyCategory.findUnique({ where: { id } });
    if (!c) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '역량 평가 카테고리를 찾을 수 없어요.',
      });
    }
    return c;
  }

  /** categoryId 가 실제 레지스트리에 존재하는지 검증(FK 위반 사전 차단·친절한 에러). */
  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.prisma.competencyCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException('존재하지 않는 카테고리입니다');
    }
  }

  private toQuestionDto(q: QuestionWithCategory) {
    return {
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
    };
  }

  private toResponseDto(r: CompetencyResponse) {
    return {
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
    };
  }
}

function zeroGrades(): Record<Grade, number> {
  return { S: 0, A: 0, B: 0, C: 0, D: 0 };
}
