import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MidtermKpiCheckIn,
  MidtermReview,
  MidtermReviewStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  resolveDownwardEvaluators,
  visibleDeptIds,
} from '../../common/access/access.util';
import {
  ConfirmMidtermReviewDto,
  ListMidtermReviewsQuery,
  SendBackMidtermReviewDto,
  SubmitMidtermSelfReviewDto,
} from './dto/midterm.dto';
import {
  assertTransition,
  MIDTERM_REVIEW_TRANSITIONS,
} from '../../common/state/transitions';
import { isFinalStage } from '../../common/state/cycle-stage';

/** 리뷰 조회 공통 include — 평가자/검토자 이름 + KPI별 자가점검. */
const REVIEW_INCLUDE = {
  evaluatee: { select: { name: true } },
  reviewer: { select: { name: true } },
  kpiCheckIns: { orderBy: { createdAt: Prisma.SortOrder.asc } },
} satisfies Prisma.MidtermReviewInclude;

/**
 * 6월 중간평가 — 진척 점검 리뷰(②).
 * 본인 자가점검(selfNote) → 부서장 확인(reviewerNote). cycle×evaluatee 단위 유일(upsert).
 * 비구속(등급/보상 미반영). 부서장 = 피평가자의 다단계 상위 장(1차 팀장·2차 본부장).
 * KPI(지표)별 자가점검은 MidtermKpiCheckIn 으로 정규화(본인 소유·해당 cycle KPI만 허용).
 */
@Injectable()
export class MidtermReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(current: AuthUser, query: ListMidtermReviewsQuery) {
    const where: Prisma.MidtermReviewWhereInput = { cycleId: query.cycleId };

    if (current.role === Role.employee) {
      where.evaluateeId = current.id;
    } else if (query.evaluateeId) {
      const allowed = await canViewUser(this.prisma, current, query.evaluateeId);
      if (!allowed) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
      }
      where.evaluateeId = query.evaluateeId;
    } else if (current.role !== Role.hr_admin) {
      // 부서장: 본인 OR 가시 부서 피평가자.
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null) {
        const userOr: Prisma.UserWhereInput[] = [{ id: current.id }];
        if (deptIds.length) userOr.push({ departmentId: { in: deptIds } });
        where.evaluatee = { OR: userOr };
      }
    }

    const rows = await this.prisma.midtermReview.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** 본인 자가점검 제출(현재 사용자 본인 한정). upsert + status pending→self_done. */
  async submitSelf(current: AuthUser, dto: SubmitMidtermSelfReviewDto) {
    const checkIns = dto.kpiCheckIns ?? [];

    // 단계 가드: 최종 산정 단계(calibration/closed) 진입 후에는 자가점검 재제출 불가.
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
      select: { status: true },
    });
    if (!cycle || isFinalStage(cycle.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '최종 평가 단계로 넘어간 주기에는 중간 자가점검을 제출할 수 없어요.',
      });
    }
    // 상태 가드: 부서장이 이미 확인(confirmed)한 점검은 재제출로 되돌리지 않는다.
    // (반려/재조정 요청(revision_requested·rejected)을 받은 경우에만 재제출 → self_done 복귀)
    const existing = await this.prisma.midtermReview.findUnique({
      where: { cycleId_evaluateeId: { cycleId: dto.cycleId, evaluateeId: current.id } },
      select: { status: true },
    });
    if (existing?.status === MidtermReviewStatus.confirmed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '이미 부서장 확인이 완료된 점검이에요. 수정이 필요하면 재조정 요청을 받아 주세요.',
      });
    }

    // KPI 주입 방지: 보낸 kpiId 가 모두 본인 소유 + 해당 cycle 의 KPI인지 한 번에 검증.
    if (checkIns.length) {
      const kpiIds = Array.from(new Set(checkIns.map((c) => c.kpiId)));
      const owned = await this.prisma.kpi.findMany({
        where: { id: { in: kpiIds }, userId: current.id, cycleId: dto.cycleId },
        select: { id: true },
      });
      if (owned.length !== kpiIds.length) {
        const ownedSet = new Set(owned.map((k) => k.id));
        const invalid = kpiIds.filter((id) => !ownedSet.has(id));
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '본인의 해당 사이클 KPI만 자가점검할 수 있어요.',
          details: { invalidKpiIds: invalid },
        });
      }
    }

    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const review = await tx.midtermReview.upsert({
        where: { cycleId_evaluateeId: { cycleId: dto.cycleId, evaluateeId: current.id } },
        create: {
          cycleId: dto.cycleId,
          evaluateeId: current.id,
          selfNote: dto.selfNote ?? null,
          selfSubmittedAt: now,
          status: MidtermReviewStatus.self_done,
        },
        update: {
          selfNote: dto.selfNote ?? null,
          selfSubmittedAt: now,
          // 반려/재조정 요청 상태에서의 재제출 → self_done 복귀(confirmed 는 위 가드에서 차단).
          status: MidtermReviewStatus.self_done,
        },
      });

      for (const c of checkIns) {
        await tx.midtermKpiCheckIn.upsert({
          where: {
            midtermReviewId_kpiId: { midtermReviewId: review.id, kpiId: c.kpiId },
          },
          create: {
            midtermReviewId: review.id,
            kpiId: c.kpiId,
            selfActualText: c.selfActualText ?? null,
            selfActualValue: c.selfActualValue ?? null,
            selfNote: c.selfNote ?? null,
            selfGrade: c.selfGrade ?? null,
          },
          update: {
            selfActualText: c.selfActualText ?? null,
            selfActualValue: c.selfActualValue ?? null,
            selfNote: c.selfNote ?? null,
            selfGrade: c.selfGrade ?? null,
          },
        });
      }

      return tx.midtermReview.findUniqueOrThrow({
        where: { id: review.id },
        include: REVIEW_INCLUDE,
      });
    });

    await this.audit.record({
      entity: 'MidtermReview',
      entityId: row.id,
      action: 'midterm_review.self_submit',
      actorId: current.id,
      after: { cycleId: dto.cycleId, kpiCheckInCount: checkIns.length },
    });
    return this.toDto(row);
  }

  /** 부서장 확인(승인). 피평가자의 상위 장(round1~3)만 + hr_admin. self_done→confirmed. */
  async confirm(current: AuthUser, id: string, dto: ConfirmMidtermReviewDto) {
    const review = await this.findOrThrow(id);
    await this.assertReviewerAuth(current, review.evaluateeId);
    // 검토자 액션 전이 가드(잠복 무가드 버그 해소): self_done 아닌 상태에서 confirm 차단.
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.confirmed);

    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          reviewerId: current.id,
          reviewerNote: dto.reviewerNote ?? null,
          confirmedAt: now,
          status: MidtermReviewStatus.confirmed,
        },
      });
      await this.applyKpiReviews(tx, review, dto.kpiReviews);
      return tx.midtermReview.findUniqueOrThrow({ where: { id }, include: REVIEW_INCLUDE });
    });
    await this.audit.record({
      entity: 'MidtermReview',
      entityId: id,
      action: 'midterm_review.confirm',
      actorId: current.id,
      before: { status: review.status },
      after: { status: MidtermReviewStatus.confirmed },
    });
    return this.toDto(row);
  }

  /**
   * 부서장 반려/재조정 요청(반송). 피평가자의 상위 장(round1~3)만 + hr_admin.
   * self_done→revision_requested|rejected, confirmed→revision_requested(승인 뒤 재조정 요청).
   * reviewerNote=사유 필수, confirmedAt 은 해제. 본인 재제출(submitSelf upsert)로 다시 self_done 복귀(비가드).
   */
  async sendBack(
    current: AuthUser,
    id: string,
    decision: typeof MidtermReviewStatus.revision_requested | typeof MidtermReviewStatus.rejected,
    dto: SendBackMidtermReviewDto,
  ) {
    const review = await this.findOrThrow(id);
    await this.assertReviewerAuth(current, review.evaluateeId);
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, decision);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          reviewerId: current.id,
          reviewerNote: dto.reviewerNote,
          confirmedAt: null,
          status: decision,
        },
      });
      await this.applyKpiReviews(tx, review, dto.kpiReviews);
      return tx.midtermReview.findUniqueOrThrow({ where: { id }, include: REVIEW_INCLUDE });
    });
    await this.audit.record({
      entity: 'MidtermReview',
      entityId: id,
      action:
        decision === MidtermReviewStatus.revision_requested
          ? 'midterm_review.revision_requested'
          : 'midterm_review.reject',
      actorId: current.id,
      before: { status: review.status },
      after: { status: decision },
    });
    return this.toDto(row);
  }

  // ── helpers ──

  /** 부서장 확인 권한: hr_admin, 또는 피평가자의 다단계 상위 장(round1 팀장·round2 본부장·round3 대표). */
  private async assertReviewerAuth(current: AuthUser, evaluateeId: string): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (current.role === Role.employee) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '부서장만 확인할 수 있어요.' });
    }
    const heads = await resolveDownwardEvaluators(this.prisma, evaluateeId);
    const allowed = [heads.round1, heads.round2, heads.round3].filter(Boolean);
    if (!allowed.includes(current.id)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '해당 구성원의 부서장만 확인할 수 있어요.',
      });
    }
  }

  /**
   * KPI별 검토 판정·코멘트 upsert (confirm/sendBack 공통, 참고용).
   * check-in 이 없으면 생성(자가점검 미작성 KPI에도 판정 가능).
   */
  private async applyKpiReviews(
    tx: Prisma.TransactionClient,
    review: Pick<MidtermReview, 'id' | 'cycleId' | 'evaluateeId'>,
    kpiReviews?: { kpiId: string; decision?: 'accepted' | 'rebaseline'; note?: string }[],
  ): Promise<void> {
    const list = kpiReviews ?? [];
    if (!list.length) return;

    // KPI 주입 방지(submitSelf 소유 검증과 대칭): 판정 대상 kpiId 가
    // 모두 피평가자 본인 + 해당 사이클의 KPI 인지 검증.
    const kpiIds = Array.from(new Set(list.map((kr) => kr.kpiId)));
    const owned = await tx.kpi.findMany({
      where: { id: { in: kpiIds }, userId: review.evaluateeId, cycleId: review.cycleId },
      select: { id: true },
    });
    if (owned.length !== kpiIds.length) {
      const ownedSet = new Set(owned.map((k) => k.id));
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '피평가자의 해당 사이클 KPI만 판정할 수 있어요.',
        details: { invalidKpiIds: kpiIds.filter((id) => !ownedSet.has(id)) },
      });
    }

    const midtermReviewId = review.id;
    for (const kr of list) {
      await tx.midtermKpiCheckIn.upsert({
        where: { midtermReviewId_kpiId: { midtermReviewId, kpiId: kr.kpiId } },
        create: {
          midtermReviewId,
          kpiId: kr.kpiId,
          reviewerNote: kr.note ?? null,
          reviewerDecision: kr.decision ?? null,
        },
        update: {
          reviewerNote: kr.note ?? null,
          reviewerDecision: kr.decision ?? null,
        },
      });
    }
  }

  private async findOrThrow(id: string): Promise<MidtermReview> {
    const row = await this.prisma.midtermReview.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '중간 점검 기록을 찾을 수 없어요.' });
    }
    return row;
  }

  private toDto(
    r: MidtermReview & {
      evaluatee?: { name: string } | null;
      reviewer?: { name: string } | null;
      kpiCheckIns?: MidtermKpiCheckIn[];
    },
  ) {
    return {
      id: r.id,
      cycleId: r.cycleId,
      evaluateeId: r.evaluateeId,
      evaluateeName: r.evaluatee?.name ?? null,
      status: r.status,
      selfNote: r.selfNote,
      selfSubmittedAt: r.selfSubmittedAt,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewer?.name ?? null,
      reviewerNote: r.reviewerNote,
      confirmedAt: r.confirmedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      kpiCheckIns: (r.kpiCheckIns ?? []).map((c) => ({
        id: c.id,
        kpiId: c.kpiId,
        selfActualText: c.selfActualText,
        selfActualValue: c.selfActualValue,
        selfNote: c.selfNote,
        selfGrade: c.selfGrade,
        reviewerNote: c.reviewerNote,
        reviewerGrade: c.reviewerGrade,
        reviewerDecision: c.reviewerDecision,
        confirmedAt: c.confirmedAt,
      })),
    };
  }
}
