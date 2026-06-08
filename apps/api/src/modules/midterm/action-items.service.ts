import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActionItem,
  ActionItemSource,
  ActionItemStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  ACTION_ITEM_TRANSITIONS,
  assertTransition,
} from '../../common/state/transitions';
import {
  canViewUser,
  resolveDownwardEvaluators,
  visibleDeptIds,
} from '../../common/access/access.util';
import {
  CreateActionItemDto,
  ListActionItemsQuery,
  TransitionActionItemDto,
  UpdateActionItemDto,
} from './dto/midterm.dto';

/**
 * 6월 중간평가 — ③ 피드백 보완 조치(ActionItem) 추적.
 * **최종등급 미반영(참고용)** — 12월 최종평가 화면에 이행 현황 패널로만 노출.
 * RBAC:
 *  - 생성/수정/마감판단: 부서장(team_lead/division_head)·hr_admin.
 *  - 진행상태 갱신(in_progress/done 등): 담당 본인 + 부서장 + hr_admin.
 *  - 조회: 본인(피평가자/담당)·부서장·hr_admin.
 * 생성·상태전이 시 AuditLog 기록.
 */
@Injectable()
export class ActionItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(current: AuthUser, query: ListActionItemsQuery) {
    const where: Prisma.ActionItemWhereInput = { cycleId: query.cycleId };
    if (query.status) where.status = query.status;
    if (query.assigneeId) where.assigneeId = query.assigneeId;

    if (current.role === Role.employee) {
      // 본인(피평가자 또는 담당)만.
      where.OR = [{ evaluateeId: current.id }, { assigneeId: current.id }];
      if (query.evaluateeId && query.evaluateeId !== current.id) {
        // employee 가 타인 조회 요청 → 빈 결과(권한 밖).
        where.evaluateeId = current.id;
        delete where.OR;
      }
    } else if (query.evaluateeId) {
      const allowed = await canViewUser(this.prisma, current, query.evaluateeId);
      if (!allowed) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
      }
      where.evaluateeId = query.evaluateeId;
    } else if (current.role !== Role.hr_admin) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null) {
        const userOr: Prisma.UserWhereInput[] = [{ id: current.id }];
        if (deptIds.length) userOr.push({ departmentId: { in: deptIds } });
        where.evaluatee = { OR: userOr };
      }
    }

    const rows = await this.prisma.actionItem.findMany({
      where,
      include: {
        evaluatee: { select: { name: true } },
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
        kpi: { select: { title: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async getOne(current: AuthUser, id: string) {
    const row = await this.findOrThrow(id);
    await this.assertViewAuth(current, row);
    return this.toDto(row);
  }

  /** 생성: 부서장·hr_admin. assignee 기본=evaluatee(본인). */
  async create(current: AuthUser, dto: CreateActionItemDto) {
    await this.assertManageAuth(current, dto.evaluateeId);

    // kpiId 가 주어지면 해당 KPI 가 피평가자·주기에 속하는지 검증.
    if (dto.kpiId) {
      const kpi = await this.prisma.kpi.findUnique({
        where: { id: dto.kpiId },
        select: { userId: true, cycleId: true },
      });
      if (!kpi || kpi.userId !== dto.evaluateeId || kpi.cycleId !== dto.cycleId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '연결할 KPI가 해당 구성원·주기에 속하지 않아요.',
        });
      }
    }

    const row = await this.prisma.actionItem.create({
      data: {
        cycleId: dto.cycleId,
        evaluateeId: dto.evaluateeId,
        kpiId: dto.kpiId ?? null,
        source: ActionItemSource.midterm_review,
        title: dto.title,
        detail: dto.detail ?? null,
        assigneeId: dto.assigneeId ?? dto.evaluateeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: ActionItemStatus.planned,
        createdById: current.id,
      },
      include: {
        evaluatee: { select: { name: true } },
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
        kpi: { select: { title: true } },
      },
    });
    await this.audit.record({
      entity: 'ActionItem',
      entityId: row.id,
      action: 'action_item.create',
      actorId: current.id,
      after: { title: row.title, evaluateeId: row.evaluateeId, assigneeId: row.assigneeId },
    });
    return this.toDto(row);
  }

  /** 내용 수정(상태 제외): 부서장·hr_admin. */
  async update(current: AuthUser, id: string, dto: UpdateActionItemDto) {
    const row = await this.findOrThrow(id);
    await this.assertManageAuth(current, row.evaluateeId);

    if (dto.kpiId) {
      const kpi = await this.prisma.kpi.findUnique({
        where: { id: dto.kpiId },
        select: { userId: true, cycleId: true },
      });
      if (!kpi || kpi.userId !== row.evaluateeId || kpi.cycleId !== row.cycleId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '연결할 KPI가 해당 구성원·주기에 속하지 않아요.',
        });
      }
    }

    const updated = await this.prisma.actionItem.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        detail: dto.detail ?? undefined,
        assigneeId: dto.assigneeId ?? undefined,
        kpiId: dto.kpiId ?? undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        evaluatee: { select: { name: true } },
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
        kpi: { select: { title: true } },
      },
    });
    await this.audit.record({
      entity: 'ActionItem',
      entityId: id,
      action: 'action_item.update',
      actorId: current.id,
      after: { ...dto },
    });
    return this.toDto(updated);
  }

  /** 상태 전이: 담당 본인 + 부서장 + hr_admin. assertTransition 강제. done→completedAt. */
  async transition(current: AuthUser, id: string, dto: TransitionActionItemDto) {
    const row = await this.findOrThrow(id);
    await this.assertProgressAuth(current, row);

    assertTransition(ACTION_ITEM_TRANSITIONS, row.status, dto.status);

    const completing = dto.status === ActionItemStatus.done;
    const updated = await this.prisma.actionItem.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: completing ? new Date() : row.status === ActionItemStatus.done ? null : undefined,
        completionNote: completing
          ? dto.completionNote ?? row.completionNote ?? null
          : undefined,
      },
      include: {
        evaluatee: { select: { name: true } },
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
        kpi: { select: { title: true } },
      },
    });
    await this.audit.record({
      entity: 'ActionItem',
      entityId: id,
      action: 'action_item.transition',
      actorId: current.id,
      before: { status: row.status },
      after: { status: dto.status },
    });
    return this.toDto(updated);
  }

  // ── auth helpers ──

  /** 생성/수정/마감판단: hr_admin, 또는 피평가자의 다단계 상위 장(round1/2/3). */
  private async assertManageAuth(current: AuthUser, evaluateeId: string): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (current.role === Role.employee) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '보완 조치 등록·수정은 부서장만 가능해요.',
      });
    }
    const heads = await resolveDownwardEvaluators(this.prisma, evaluateeId);
    const allowed = [heads.round1, heads.round2, heads.round3].filter(Boolean);
    if (!allowed.includes(current.id)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '해당 구성원의 부서장만 보완 조치를 관리할 수 있어요.',
      });
    }
  }

  /** 진행상태 갱신: 담당 본인 OR 부서장 OR hr_admin. */
  private async assertProgressAuth(current: AuthUser, row: ActionItem): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (current.id === row.assigneeId) return;
    // 부서장 권한 위임.
    await this.assertManageAuth(current, row.evaluateeId);
  }

  /** 조회: 본인(피평가자/담당) OR 부서장 OR hr_admin. */
  private async assertViewAuth(current: AuthUser, row: ActionItem): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (current.id === row.assigneeId || current.id === row.evaluateeId) return;
    const allowed = await canViewUser(this.prisma, current, row.evaluateeId);
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    }
  }

  private async findOrThrow(id: string): Promise<ActionItem> {
    const row = await this.prisma.actionItem.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '보완 조치를 찾을 수 없어요.' });
    }
    return row;
  }

  private toDto(
    r: ActionItem & {
      evaluatee?: { name: string } | null;
      assignee?: { name: string } | null;
      createdBy?: { name: string } | null;
      kpi?: { title: string } | null;
    },
  ) {
    return {
      id: r.id,
      cycleId: r.cycleId,
      evaluateeId: r.evaluateeId,
      evaluateeName: r.evaluatee?.name ?? null,
      kpiId: r.kpiId,
      kpiTitle: r.kpi?.title ?? null,
      source: r.source,
      title: r.title,
      detail: r.detail,
      assigneeId: r.assigneeId,
      assigneeName: r.assignee?.name ?? null,
      dueDate: r.dueDate,
      status: r.status,
      createdById: r.createdById,
      createdByName: r.createdBy?.name ?? null,
      completedAt: r.completedAt,
      completionNote: r.completionNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
