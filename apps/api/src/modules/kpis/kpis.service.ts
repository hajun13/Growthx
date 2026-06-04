import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Kpi, KpiStatus, Prisma, ReviewKind, Role } from '@prisma/client';
// 측정방식별 등급·KPI 분류는 schema enum(KpiCategory/KpiGroup/MeasureType)으로 검증됨.
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import { assertTransition, KPI_TRANSITIONS } from '../../common/state/transitions';
import {
  ApproveKpiDto,
  CreateKpiDto,
  LinkKpiDto,
  ListKpisQuery,
  RejectKpiDto,
  UpdateKpiDto,
} from './dto/kpi.dto';

/** KPI 검토 의견을 별도 단계로 표기하기 위한 분기값(분기 실적 리뷰와 구분). */
const KPI_REVIEW_QUARTER = 0;

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(current: AuthUser, query: ListKpisQuery) {
    const where: Prisma.KpiWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.group) where.group = query.group;
    if (query.category) where.category = query.category;

    // 행 수준: employee 는 본인만 (E-1: hr_admin 외 전 역할은 가시 범위로 축소)
    if (current.role === Role.employee) {
      where.userId = current.id;
    }
    const rows = await this.prisma.kpi.findMany({ where, orderBy: { createdAt: 'asc' } });

    // 행 수준 필터 (E-1): team_lead=자기 팀, division_head=자기 본부. hr_admin 전체.
    // employee 는 위 where 로 이미 본인 한정 → 추가 검사 불필요.
    if (current.role === Role.hr_admin || current.role === Role.employee) {
      return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
    }
    const visible: Kpi[] = [];
    for (const k of rows) {
      if (k.userId === current.id || (await canViewUser(this.prisma, current, k.userId))) {
        visible.push(k);
      }
    }
    return { data: visible, meta: { page: 1, pageSize: visible.length, total: visible.length } };
  }

  async get(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    const allowed = await canViewUser(this.prisma, current, kpi.userId);
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    return kpi;
  }

  async create(current: AuthUser, dto: CreateKpiDto) {
    // employee 는 본인 KPI 만 생성. (관리자는 대리 생성 가능 — userId 미지정 시 본인)
    const userId = current.id;
    return this.prisma.kpi.create({
      data: {
        userId,
        cycleId: dto.cycleId,
        category: dto.category,
        group: dto.group,
        title: dto.title,
        coreStrategy: dto.coreStrategy ?? null,
        csf: dto.csf ?? null,
        measureMethod: dto.measureMethod ?? null,
        measureType: dto.measureType,
        targetValue: dto.targetValue ?? null,
        weight: dto.weight,
        isQualitative: dto.isQualitative,
        grading: (dto.grading as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        parentKpiId: dto.parentKpiId ?? null,
        status: KpiStatus.draft,
      },
    });
  }

  async update(current: AuthUser, id: string, dto: UpdateKpiDto) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    if (kpi.status !== KpiStatus.draft) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '작성중(draft) 상태에서만 수정할 수 있어요.',
      });
    }
    return this.prisma.kpi.update({
      where: { id },
      data: {
        category: dto.category ?? undefined,
        group: dto.group ?? undefined,
        title: dto.title ?? undefined,
        coreStrategy: dto.coreStrategy ?? undefined,
        csf: dto.csf ?? undefined,
        measureMethod: dto.measureMethod ?? undefined,
        measureType: dto.measureType ?? undefined,
        targetValue: dto.targetValue ?? undefined,
        weight: dto.weight ?? undefined,
        isQualitative: dto.isQualitative ?? undefined,
        grading: dto.grading ? (dto.grading as Prisma.InputJsonValue) : undefined,
        parentKpiId: dto.parentKpiId ?? undefined,
      },
    });
  }

  /** draft → submitted. 사용자 cycle KPI 가중치 합=100 · 정성≤30% 검증. */
  async submit(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.submitted);

    const siblings = await this.prisma.kpi.findMany({
      where: { userId: kpi.userId, cycleId: kpi.cycleId },
    });
    const rules = await this.scoring.loadRuleSetForCycle(kpi.cycleId);
    this.scoring.validateWeights(
      siblings.map((k) => ({ weight: k.weight, isQualitative: k.isQualitative })),
      rules.weightPolicy,
    );

    return this.prisma.kpi.update({
      where: { id },
      data: { status: KpiStatus.submitted },
    });
  }

  /** submitted → approved (팀장/본부장/HR). 검토 의견(comment) 전달 시 Review 로 영속화. */
  async approve(current: AuthUser, id: string, dto?: ApproveKpiDto) {
    const kpi = await this.findOrThrow(id);
    await this.assertReviewer(current, kpi);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.approved);
    const updated = await this.prisma.kpi.update({
      where: { id },
      data: { status: KpiStatus.approved },
    });
    await this.saveReviewComment(kpi.id, current.id, dto?.comment, ReviewKind.strength);
    await this.audit.record({
      entity: 'Kpi',
      entityId: kpi.id,
      action: 'kpi.approve',
      actorId: current.id,
      before: { status: kpi.status },
      after: { status: KpiStatus.approved },
    });
    return updated;
  }

  /** submitted → draft(반려, 사유 기록). 보강 의견(comment) 전달 시 Review 로 영속화. */
  async reject(current: AuthUser, id: string, dto: RejectKpiDto) {
    const kpi = await this.findOrThrow(id);
    await this.assertReviewer(current, kpi);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.draft);
    const updated = await this.prisma.kpi.update({
      where: { id },
      data: { status: KpiStatus.draft, rejectReason: dto.reason },
    });
    await this.saveReviewComment(kpi.id, current.id, dto.comment, ReviewKind.improvement);
    await this.audit.record({
      entity: 'Kpi',
      entityId: kpi.id,
      action: 'kpi.reject',
      actorId: current.id,
      before: { status: kpi.status },
      after: { status: KpiStatus.draft, rejectReason: dto.reason },
    });
    // KPI 반려 알림(작성자).
    await this.notifications.notifyUser(kpi.userId, 'kpi_rejected', {
      kpiId: kpi.id,
      reason: dto.reason,
      message: `KPI "${kpi.title}"가 반려되었어요: ${dto.reason}`,
    });
    return updated;
  }

  /** approved → confirmed. */
  async confirm(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    await this.assertReviewer(current, kpi);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.confirmed);
    return this.prisma.kpi.update({ where: { id }, data: { status: KpiStatus.confirmed } });
  }

  /** 상위 KPI 연계(cascade). */
  async link(current: AuthUser, id: string, dto: LinkKpiDto) {
    const kpi = await this.findOrThrow(id);
    const allowed =
      current.role === Role.hr_admin ||
      kpi.userId === current.id ||
      (await canViewUser(this.prisma, current, kpi.userId));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '연계 권한이 없어요.' });
    await this.findOrThrow(dto.parentKpiId); // 상위 존재 확인
    return this.prisma.kpi.update({
      where: { id },
      data: { parentKpiId: dto.parentKpiId },
    });
  }

  /** draft 상태 본인(또는 HR) KPI 삭제. */
  async remove(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    if (kpi.status !== KpiStatus.draft) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: '작성중(draft) 상태에서만 삭제할 수 있어요.',
      });
    }
    await this.prisma.kpi.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── helpers ──
  /** 검토 의견을 Review(quarter=0, KPI 검토 단계)로 저장. 비어 있으면 무시. */
  private async saveReviewComment(
    kpiId: string,
    authorId: string,
    comment: string | undefined,
    kind: ReviewKind,
  ): Promise<void> {
    const content = comment?.trim();
    if (!content) return;
    await this.prisma.review.create({
      data: { kpiId, authorId, quarter: KPI_REVIEW_QUARTER, kind, content },
    });
  }

  private async findOrThrow(id: string): Promise<Kpi> {
    const kpi = await this.prisma.kpi.findUnique({ where: { id } });
    if (!kpi) throw new NotFoundException({ code: 'NOT_FOUND', message: 'KPI를 찾을 수 없어요.' });
    return kpi;
  }

  private assertOwner(current: AuthUser, kpi: Kpi): void {
    if (kpi.userId !== current.id && current.role !== Role.hr_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '본인 KPI만 처리할 수 있어요.' });
    }
  }

  private async assertReviewer(current: AuthUser, kpi: Kpi): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (current.role === Role.team_lead || current.role === Role.division_head) {
      const ok = await canViewUser(this.prisma, current, kpi.userId);
      if (ok) return;
    }
    throw new ForbiddenException({ code: 'FORBIDDEN', message: '검토 권한이 없어요.' });
  }
}
