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
  SubmitMidtermSelfReviewDto,
} from './dto/midterm.dto';

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
          // 이미 confirmed 면 그대로 두지 않고 self_done 로 되돌린다(재제출 → 재확인 필요).
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

  /** 부서장 확인. 피평가자의 상위 장(round1/round2)만 + hr_admin. status→confirmed. */
  async confirm(current: AuthUser, id: string, dto: ConfirmMidtermReviewDto) {
    const review = await this.findOrThrow(id);
    await this.assertReviewerAuth(current, review.evaluateeId);

    const now = new Date();
    const row = await this.prisma.midtermReview.update({
      where: { id },
      data: {
        reviewerId: current.id,
        reviewerNote: dto.reviewerNote ?? null,
        confirmedAt: now,
        status: MidtermReviewStatus.confirmed,
      },
      include: REVIEW_INCLUDE,
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
        confirmedAt: c.confirmedAt,
      })),
    };
  }
}
