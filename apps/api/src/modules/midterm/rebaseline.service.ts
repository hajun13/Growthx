import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KpiStatus,
  Prisma,
  RebaselineRequestStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { KpiRevisionService } from '../kpis/kpi-revision.service';
import { AuthUser } from '../../common/decorators/current-user';
import { assertMidReviewStage } from '../../common/state/cycle-stage';
import {
  REBASELINE_REQUEST_TRANSITIONS,
  assertTransition,
} from '../../common/state/transitions';
import {
  canViewUser,
  resolveDownwardEvaluators,
} from '../../common/access/access.util';
import {
  CreateRebaselineRequestDto,
  ListRebaselineRequestsQuery,
  RebaselineHistoryQuery,
  RebaselineItemDto,
  ReviewRebaselineRequestDto,
  UpdateRebaselineRequestDto,
} from './dto/midterm.dto';

/** 재조정 스냅샷 라벨 prefix(이력 조회 시 이 prefix 로 필터). */
const REBASELINE_LABEL_PREFIX = '중간 조정 전';

/** KpiSnapshot.data 에 직렬화되는 KPI 1건(snapshots.service.ts 와 동일 shape). */
export interface SnapshotKpi {
  id: string;
  title: string;
  category: string;
  group: string;
  measureType: string;
  targetValue: number | null;
  targetText: string | null;
  weight: number;
  isQualitative: boolean;
  status: string;
}

/** 재조정으로 실제 변경된 필드(전/후) 1건. */
export interface FieldChange {
  field: 'targetValue' | 'targetText' | 'weight';
  before: number | string | null;
  after: number | string | null;
}

/** 제안 1건(items[]의 정규화 shape — Json 에 저장·로드). */
export interface ProposalItem {
  kpiId: string;
  targetValue?: number | null;
  targetText?: string | null;
  weight?: number;
}

/**
 * 6월 중간평가 — ④ 중간 KPI 목표 재조정(re-baseline) **워크플로우**.
 *
 * 흐름: 피드백 받음 → **본인(피평가자)이 재조정을 제안** → **부서장이 검토** → **승인 시 실제 반영**.
 * 반려 시 본인이 수정·재제출.
 *  - 제안 주체 = 피평가자 본인(evaluateeId === current.id)만.
 *  - 검토·승인자 = 그 구성원의 부서장(resolveDownwardEvaluators round1 팀장, 없으면/상위 round2 본부장 …).
 *    HR 은 승인자 아님(조회만).
 *  - 실제 KPI 변경·KpiSnapshot·AuditLog 는 **승인(approve) 시점**에만 발생.
 *  - 허용 윈도우: mid_review 단계에서만(assertMidReviewStage). 그 외 400 VALIDATION_ERROR.
 *  - 대상 KPI: status=confirmed 한정(확정된 베이스라인 조정). 가중치 합=100 검증 모집단도 confirmed.
 *  - 검증(confirmed 한정·정량 targetValue≥0·가중치 합=100 등 weightPolicy)을 **제출 시 + 승인 시** 둘 다 수행.
 */
@Injectable()
export class RebaselineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
    private readonly revision: KpiRevisionService,
  ) {}

  // ─────────────────────── 생성(본인 제출) ───────────────────────

  /** POST /midterm/rebaseline-requests — 본인이 재조정을 제안·제출. status=submitted. */
  async create(current: AuthUser, dto: CreateRebaselineRequestDto) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '재조정 사유(reason)는 필수예요.',
      });
    }

    // 제안 주체 = 본인. evaluateeId 는 항상 현재 사용자.
    const evaluateeId = current.id;

    // 윈도우: mid_review 단계에서만.
    await assertMidReviewStage(
      this.prisma,
      dto.cycleId,
      '중간평가(mid_review) 단계에서만 KPI 목표 재조정을 제안할 수 있어요.',
    );

    // 미결(submitted) 요청 1건만 — 한 cycle×evaluatee 당.
    const pending = await this.prisma.rebaselineRequest.findFirst({
      where: {
        cycleId: dto.cycleId,
        evaluateeId,
        status: RebaselineRequestStatus.submitted,
      },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          '이미 검토 대기 중인 재조정 요청이 있어요. 기존 요청을 수정하거나 부서장 검토 후 다시 제출하세요.',
      });
    }

    // 제출 검증(확정 한정·정량≥0·중복·변경필드·가중치 합=100).
    const items = this.normalizeItems(dto.items);
    await this.validateProposal(dto.cycleId, evaluateeId, items);

    const created = await this.prisma.rebaselineRequest.create({
      data: {
        cycleId: dto.cycleId,
        evaluateeId,
        reason,
        items: items as unknown as Prisma.InputJsonValue,
        status: RebaselineRequestStatus.submitted,
      },
    });

    await this.audit.record({
      entity: 'RebaselineRequest',
      entityId: created.id,
      action: 'rebaseline_request.submit',
      actorId: current.id,
      after: { cycleId: dto.cycleId, evaluateeId, reason, items },
    });

    return { data: await this.serialize(created.id) };
  }

  // ─────────────────────── 본인 수정·재제출 ───────────────────────

  /**
   * PATCH /midterm/rebaseline-requests/:id — 본인이 items/reason 수정.
   * submitted(검토 전 수정) 또는 rejected(반려 후 수정→재제출) 상태에서만.
   * rejected 였으면 재제출로 status=submitted 전이(transitions 강제).
   */
  async update(current: AuthUser, id: string, dto: UpdateRebaselineRequestDto) {
    const req = await this.mustFind(id);

    // 소유권: 본인만 수정.
    if (req.evaluateeId !== current.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인이 제안한 재조정 요청만 수정할 수 있어요.',
      });
    }

    // 윈도우: mid_review.
    await assertMidReviewStage(
      this.prisma,
      req.cycleId,
      '중간평가(mid_review) 단계에서만 재조정 요청을 수정할 수 있어요.',
    );

    // submitted/rejected 에서만 수정 가능. approved 는 종단.
    if (
      req.status !== RebaselineRequestStatus.submitted &&
      req.status !== RebaselineRequestStatus.rejected
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '이미 승인된 요청은 수정할 수 없어요.',
      });
    }

    const reason =
      dto.reason !== undefined ? dto.reason.trim() : req.reason;
    if (!reason) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '재조정 사유(reason)는 필수예요.',
      });
    }

    const items =
      dto.items !== undefined
        ? this.normalizeItems(dto.items)
        : (req.items as unknown as ProposalItem[]);

    // 재검증(현재 confirmed KPI 기준).
    await this.validateProposal(req.cycleId, req.evaluateeId, items);

    // rejected → submitted 재제출 전이(transitions 강제). submitted 면 그대로.
    const wasRejected = req.status === RebaselineRequestStatus.rejected;
    if (wasRejected) {
      assertTransition(
        REBASELINE_REQUEST_TRANSITIONS,
        req.status,
        RebaselineRequestStatus.submitted,
      );
    }

    await this.prisma.rebaselineRequest.update({
      where: { id },
      data: {
        reason,
        items: items as unknown as Prisma.InputJsonValue,
        status: RebaselineRequestStatus.submitted,
        // 재제출 시 직전 검토 흔적 초기화(부서장 재검토).
        reviewerId: wasRejected ? null : req.reviewerId,
        reviewComment: wasRejected ? null : req.reviewComment,
        reviewedAt: wasRejected ? null : req.reviewedAt,
      },
    });

    await this.audit.record({
      entity: 'RebaselineRequest',
      entityId: id,
      action: wasRejected
        ? 'rebaseline_request.resubmit'
        : 'rebaseline_request.update',
      actorId: current.id,
      before: { status: req.status, reason: req.reason, items: req.items },
      after: { status: RebaselineRequestStatus.submitted, reason, items },
    });

    return { data: await this.serialize(id) };
  }

  // ─────────────────────── 부서장 검토(승인/반려) ───────────────────────

  /**
   * PATCH /midterm/rebaseline-requests/:id/review — 부서장 검토.
   * decision=approve → 검증 후 KPI 실제 반영(스냅샷+update+audit), status=approved.
   * decision=reject → status=rejected(코멘트 권장).
   */
  async review(current: AuthUser, id: string, dto: ReviewRebaselineRequestDto) {
    const req = await this.mustFind(id);

    // 윈도우: mid_review.
    await assertMidReviewStage(
      this.prisma,
      req.cycleId,
      '중간평가(mid_review) 단계에서만 재조정 요청을 검토할 수 있어요.',
    );

    // 검토자 = 해당 구성원의 부서장(round1/2/3). HR 은 승인자 아님.
    await this.assertReviewerAuth(current, req.evaluateeId);

    const targetStatus =
      dto.decision === 'approve'
        ? RebaselineRequestStatus.approved
        : RebaselineRequestStatus.rejected;

    // 전이 검증(submitted → approved|rejected). 그 외 상태면 409.
    assertTransition(
      REBASELINE_REQUEST_TRANSITIONS,
      req.status,
      targetStatus,
    );

    const comment = dto.comment?.trim() || null;
    const items = req.items as unknown as ProposalItem[];

    if (dto.decision === 'reject') {
      await this.prisma.rebaselineRequest.update({
        where: { id },
        data: {
          status: RebaselineRequestStatus.rejected,
          reviewerId: current.id,
          reviewComment: comment,
          reviewedAt: new Date(),
        },
      });
      await this.audit.record({
        entity: 'RebaselineRequest',
        entityId: id,
        action: 'rebaseline_request.reject',
        actorId: current.id,
        before: { status: req.status },
        after: { status: RebaselineRequestStatus.rejected, reviewComment: comment },
      });
      return { data: await this.serialize(id) };
    }

    // approve: 승인 시점에 검증 재수행 후 실제 반영.
    await this.validateProposal(req.cycleId, req.evaluateeId, items);
    const applied = await this.revision.apply({
      actorId: current.id,
      cycleId: req.cycleId,
      evaluateeId: req.evaluateeId,
      items,
      snapshotLabel: `${REBASELINE_LABEL_PREFIX} (${this.today()})`,
      auditAction: 'kpi.rebaseline',
      auditContext: {
        reason: req.reason,
        requestId: req.id,
        requesterId: req.evaluateeId,
        reviewerId: current.id,
      },
    });
    const snapshotId = applied.snapshotId;

    await this.prisma.rebaselineRequest.update({
      where: { id },
      data: {
        status: RebaselineRequestStatus.approved,
        reviewerId: current.id,
        reviewComment: comment,
        reviewedAt: new Date(),
        appliedSnapshotId: applied.snapshotId,
      },
    });

    await this.audit.record({
      entity: 'RebaselineRequest',
      entityId: id,
      action: 'rebaseline_request.approve',
      actorId: current.id,
      before: { status: req.status },
      after: {
        status: RebaselineRequestStatus.approved,
        reviewComment: comment,
        appliedSnapshotId: applied.snapshotId,
        changed: applied.changes,
      },
    });

    return { data: await this.serialize(id) };
  }

  // ─────────────────────── 조회 ───────────────────────

  /** GET /midterm/rebaseline-requests — 목록. 역할별 가시 범위 + forReview(부서장 검토 큐). */
  async list(current: AuthUser, query: ListRebaselineRequestsQuery) {
    const where: Prisma.RebaselineRequestWhereInput = { cycleId: query.cycleId };
    if (query.status) where.status = query.status as RebaselineRequestStatus;

    // forReview: 쿼리스트링은 문자열이므로 "false"/"0"/"" 는 비활성으로 취급.
    const forReview =
      query.forReview === true ||
      (typeof query.forReview === 'string' &&
        !['', 'false', '0', 'no'].includes(query.forReview.toLowerCase()));

    if (forReview) {
      // 부서장 검토 큐: 현재 사용자가 부서장인(=round1/2/3 중 본인) 구성원들의 요청.
      // employee 는 자기가 누군가의 부서장일 수 없으므로 빈 목록.
      const evaluateeIds = await this.evaluateesWhereIamReviewer(current, query.cycleId);
      if (evaluateeIds.length === 0) {
        return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
      }
      where.evaluateeId = { in: evaluateeIds };
      // 검토 큐 기본은 미결(submitted). status 명시 시 그걸 우선.
      if (!query.status) where.status = RebaselineRequestStatus.submitted;
    } else if (query.evaluateeId) {
      // 특정 구성원 조회 — 가시 권한 검증.
      if (
        query.evaluateeId !== current.id &&
        !(await canViewUser(this.prisma, current, query.evaluateeId))
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '조회 권한이 없어요.',
        });
      }
      where.evaluateeId = query.evaluateeId;
    } else {
      // 미지정: 역할별 기본 가시 범위.
      if (current.role === Role.hr_admin) {
        // HR: 전체(조회만).
      } else {
        // 그 외: 본인 것 OR 내가 부서장인 구성원 것.
        const evaluateeIds = await this.evaluateesWhereIamReviewer(
          current,
          query.cycleId,
        );
        where.evaluateeId = { in: [current.id, ...evaluateeIds] };
      }
    }

    const rows = await this.prisma.rebaselineRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    const data = await Promise.all(rows.map((r) => this.toView(r)));
    return {
      data,
      meta: { page: 1, pageSize: data.length, total: data.length },
    };
  }

  /** GET /midterm/rebaseline-requests/:id — 상세(제안 items + 현재 KPI 비교 정보 포함). */
  async detail(current: AuthUser, id: string) {
    const req = await this.mustFind(id);
    // 조회 권한: 본인·부서장·HR.
    if (
      req.evaluateeId !== current.id &&
      current.role !== Role.hr_admin &&
      !(await this.isReviewerOf(current, req.evaluateeId)) &&
      !(await canViewUser(this.prisma, current, req.evaluateeId))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '조회 권한이 없어요.',
      });
    }
    return { data: await this.serialize(id) };
  }

  /**
   * GET /midterm/rebaseline/history — 재조정 이력(스냅샷 기반 전/후) + AuditLog 사유.
   * 승인(approve)으로 실제 반영된 변경만 KpiSnapshot 으로 캡처되므로, 기존과 동일하게
   * 라벨 prefix "중간 조정 전 …" 스냅샷 체인으로 diff·사유를 재구성한다.
   */
  async history(current: AuthUser, query: RebaselineHistoryQuery) {
    // 조회 권한: 본인·부서장·HR.
    if (current.id !== query.evaluateeId) {
      const ok = await canViewUser(this.prisma, current, query.evaluateeId);
      if (!ok) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
      }
    }

    const snapshots = await this.prisma.kpiSnapshot.findMany({
      where: {
        cycleId: query.cycleId,
        userId: query.evaluateeId,
        label: { startsWith: REBASELINE_LABEL_PREFIX },
      },
      orderBy: { createdAt: 'desc' },
    });

    const current_ = await this.currentKpis(query.cycleId, query.evaluateeId);

    const kpiIds = current_.map((k) => k.id);
    const auditLogs = kpiIds.length
      ? await this.prisma.auditLog.findMany({
          where: { entity: 'Kpi', action: 'kpi.rebaseline', entityId: { in: kpiIds } },
          orderBy: { at: 'desc' },
        })
      : [];

    const reasonBySnapshot = new Map<string, { reason: string | null; at: Date }>();
    for (const log of auditLogs) {
      const after = (log.after ?? {}) as Record<string, unknown>;
      const sid = typeof after.snapshotId === 'string' ? after.snapshotId : null;
      if (sid && !reasonBySnapshot.has(sid)) {
        reasonBySnapshot.set(sid, {
          reason: typeof after.reason === 'string' ? after.reason : null,
          at: log.at,
        });
      }
    }

    const actorIds = Array.from(
      new Set(snapshots.map((s) => s.createdBy).filter((id): id is string => !!id)),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(actors.map((u) => [u.id, u.name]));

    const entries = snapshots.map((snap, idx) => {
      const before: SnapshotKpi[] = Array.isArray(snap.data)
        ? (snap.data as unknown as SnapshotKpi[])
        : [];
      const afterSnap = idx === 0 ? current_ : this.parseSnapshot(snapshots[idx - 1].data);
      const meta = reasonBySnapshot.get(snap.id);
      return {
        snapshotId: snap.id,
        label: snap.label,
        createdAt: snap.createdAt,
        createdBy: snap.createdBy,
        createdByName: snap.createdBy ? nameById.get(snap.createdBy) ?? null : null,
        reason: meta?.reason ?? null,
        changed: this.diffKpis(before, afterSnap),
      };
    });

    return { data: entries, meta: { page: 1, pageSize: entries.length, total: entries.length } };
  }

  // ─────────────────────── 검증·적용 헬퍼 ───────────────────────

  /**
   * 제안(items)을 검증. 공용 KpiRevisionService 에 위임하되, 레거시 재조정 고유 규칙
   * ("항목 1개 이상"·"item 당 변경 필드 1개 이상")은 여기서 먼저 강제한다 — 이 두 검사는
   * 중간점검(변경 0건 허용)과 갈리는 지점이라 공용 서비스로 옮기지 않았다.
   */
  private async validateProposal(
    cycleId: string,
    evaluateeId: string,
    items: ProposalItem[],
  ): Promise<void> {
    if (!items.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '재조정 항목(items)을 1개 이상 지정해야 해요.',
      });
    }
    for (const item of items) {
      if (
        item.targetValue === undefined &&
        item.targetText === undefined &&
        item.weight === undefined
      ) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `변경할 필드를 1개 이상 지정해야 해요. (kpiId=${item.kpiId})`,
        });
      }
    }
    await this.revision.validate(cycleId, evaluateeId, items);
  }

  // ─────────────────────── 직렬화 ───────────────────────

  /** 상세 응답 — 제안 + 현재 KPI(confirmed) + 가중치 검증 상태 + diff 정보. */
  private async serialize(id: string) {
    const req = await this.mustFind(id);
    const view = await this.toView(req);
    const items = req.items as unknown as ProposalItem[];

    // 현재 KPI(confirmed 집합) — 프론트 diff·가중치 검증 기준.
    const currentKpis = await this.currentKpis(req.cycleId, req.evaluateeId);
    const confirmed = currentKpis.filter((k) => k.status === KpiStatus.confirmed);
    const byId = new Map(confirmed.map((k) => [k.id, k]));

    // 제안 vs 현재 diff(승인 시 실제로 바뀔 필드만).
    const proposedChanges = items.map((item) => {
      const kpi = byId.get(item.kpiId);
      const fields: FieldChange[] = [];
      if (kpi) {
        if (item.targetValue !== undefined && item.targetValue !== kpi.targetValue) {
          fields.push({ field: 'targetValue', before: kpi.targetValue, after: item.targetValue });
        }
        if (item.targetText !== undefined && (item.targetText ?? null) !== kpi.targetText) {
          fields.push({ field: 'targetText', before: kpi.targetText, after: item.targetText ?? null });
        }
        if (item.weight !== undefined && item.weight !== kpi.weight) {
          fields.push({ field: 'weight', before: kpi.weight, after: item.weight });
        }
      }
      return {
        kpiId: item.kpiId,
        title: kpi?.title ?? null,
        proposed: {
          targetValue: item.targetValue,
          targetText: item.targetText,
          weight: item.weight,
        },
        current: kpi
          ? { targetValue: kpi.targetValue, targetText: kpi.targetText, weight: kpi.weight }
          : null,
        fields,
      };
    });

    // 가중치 합 미리보기(제안 반영 후 confirmed 집합 합계).
    const weightById = new Map(items.map((i) => [i.kpiId, i.weight]));
    const projectedWeightSum = confirmed.reduce(
      (sum, k) => sum + (weightById.get(k.id) ?? k.weight),
      0,
    );

    return {
      ...view,
      items,
      currentKpis: confirmed,
      proposedChanges,
      projectedWeightSum,
      weightValid: projectedWeightSum === 100,
    };
  }

  /** 목록/공통 view — 요청 메타 + 이름 해석. */
  private async toView(req: {
    id: string;
    cycleId: string;
    evaluateeId: string;
    reason: string;
    items: Prisma.JsonValue;
    status: RebaselineRequestStatus;
    reviewerId: string | null;
    reviewComment: string | null;
    reviewedAt: Date | null;
    appliedSnapshotId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const userIds = [req.evaluateeId, req.reviewerId].filter(
      (x): x is string => !!x,
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const items = (req.items as unknown as ProposalItem[]) ?? [];
    return {
      id: req.id,
      cycleId: req.cycleId,
      evaluateeId: req.evaluateeId,
      evaluateeName: nameById.get(req.evaluateeId) ?? null,
      reason: req.reason,
      status: req.status,
      itemCount: items.length,
      reviewerId: req.reviewerId,
      reviewerName: req.reviewerId ? nameById.get(req.reviewerId) ?? null : null,
      reviewComment: req.reviewComment,
      reviewedAt: req.reviewedAt ? req.reviewedAt.toISOString() : null,
      appliedSnapshotId: req.appliedSnapshotId,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
    };
  }

  // ─────────────────────── 권한·조회 헬퍼 ───────────────────────

  private async mustFind(id: string) {
    const req = await this.prisma.rebaselineRequest.findUnique({ where: { id } });
    if (!req) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '재조정 요청을 찾을 수 없어요.',
      });
    }
    return req;
  }

  /** 검토자 권한: 현재 사용자가 evaluatee 의 부서장(round1/2/3)인지. 아니면 403. HR 도 승인 불가. */
  private async assertReviewerAuth(
    current: AuthUser,
    evaluateeId: string,
  ): Promise<void> {
    if (!(await this.isReviewerOf(current, evaluateeId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '해당 구성원의 부서장만 재조정 요청을 검토할 수 있어요.',
      });
    }
  }

  /** 현재 사용자가 evaluatee 의 부서장(round1/2/3 중 1인)인지. */
  private async isReviewerOf(
    current: AuthUser,
    evaluateeId: string,
  ): Promise<boolean> {
    if (current.id === evaluateeId) return false; // 본인은 자기 검토자 아님.
    const heads = await resolveDownwardEvaluators(this.prisma, evaluateeId);
    const allowed = [heads.round1, heads.round2, heads.round3].filter(Boolean);
    return allowed.includes(current.id);
  }

  /**
   * 현재 사용자가 부서장인(=검토자인) 구성원 id 목록(해당 cycle 의 요청이 있는 evaluatee 한정).
   * 요청 테이블의 distinct evaluateeId 를 가져와 각각 isReviewerOf 검사(N 은 작음).
   */
  private async evaluateesWhereIamReviewer(
    current: AuthUser,
    cycleId: string,
  ): Promise<string[]> {
    // 부서장 식별은 명시 지정(Department.headUserId, resolveDownwardEvaluators) 기준 —
    // role(권한)과 무관하므로 employee 도 검사 대상에 포함한다. 요청이 있는 evaluatee 만 검사.
    const rows = await this.prisma.rebaselineRequest.findMany({
      where: { cycleId },
      select: { evaluateeId: true },
      distinct: ['evaluateeId'],
    });
    const out: string[] = [];
    for (const r of rows) {
      if (r.evaluateeId === current.id) continue;
      if (await this.isReviewerOf(current, r.evaluateeId)) out.push(r.evaluateeId);
    }
    return out;
  }

  // ─────────────────────── KPI 스냅샷·diff 헬퍼 ───────────────────────

  /** items[] 를 정규화(undefined 보존, 알 수 없는 키 제거). */
  private normalizeItems(items: RebaselineItemDto[]): ProposalItem[] {
    return items.map((i) => {
      const out: ProposalItem = { kpiId: i.kpiId };
      if (i.targetValue !== undefined) out.targetValue = i.targetValue;
      if (i.targetText !== undefined) out.targetText = i.targetText;
      if (i.weight !== undefined) out.weight = i.weight;
      return out;
    });
  }

  private async currentKpis(cycleId: string, userId: string): Promise<SnapshotKpi[]> {
    const rows = await this.prisma.kpi.findMany({
      where: { cycleId, userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((k) => ({
      id: k.id,
      title: k.title,
      category: k.category,
      group: k.group,
      measureType: k.measureType,
      targetValue: k.targetValue,
      targetText: k.targetText,
      weight: k.weight,
      isQualitative: k.isQualitative,
      status: k.status,
    }));
  }

  private parseSnapshot(data: Prisma.JsonValue): SnapshotKpi[] {
    return Array.isArray(data) ? (data as unknown as SnapshotKpi[]) : [];
  }

  /** before/after KPI 배열의 targetValue/targetText/weight diff(변경된 것만). */
  private diffKpis(
    before: SnapshotKpi[],
    after: SnapshotKpi[],
  ): { kpiId: string; title: string; fields: FieldChange[] }[] {
    const afterById = new Map(after.map((k) => [k.id, k]));
    const out: { kpiId: string; title: string; fields: FieldChange[] }[] = [];
    for (const b of before) {
      const a = afterById.get(b.id);
      if (!a) continue;
      const fields: FieldChange[] = [];
      if (b.targetValue !== a.targetValue) {
        fields.push({ field: 'targetValue', before: b.targetValue, after: a.targetValue });
      }
      if ((b.targetText ?? null) !== (a.targetText ?? null)) {
        fields.push({ field: 'targetText', before: b.targetText ?? null, after: a.targetText ?? null });
      }
      if (b.weight !== a.weight) {
        fields.push({ field: 'weight', before: b.weight, after: a.weight });
      }
      if (fields.length) out.push({ kpiId: a.id, title: a.title, fields });
    }
    return out;
  }

  /** YYYY-MM-DD(로컬). */
  private today(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}
