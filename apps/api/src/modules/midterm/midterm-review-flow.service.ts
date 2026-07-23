import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiStatus, MidtermReviewStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { assertMidReviewStage } from '../../common/state/cycle-stage';
import { assertTransition, MIDTERM_REVIEW_TRANSITIONS } from '../../common/state/transitions';
import { resolveMidtermReviewers } from '../../common/access/midterm-reviewers.util';
import { AuditService } from '../../common/audit/audit.service';
import { KpiRevisionService } from '../kpis/kpi-revision.service';
import { MidtermTrailService } from './midterm-trail.service';
import { evaluateMidtermTurn, MIDTERM_TURN_MESSAGE, MidtermAction } from './midterm-turn';
import {
  CommentMidtermDto,
  DecideMidtermDto,
  OpenMidtermDto,
  SubmitMidtermRevisionDto,
} from './dto/midterm-flow.dto';

/** 알림 의도 — 트랜잭션 커밋 후 MidtermNotifyService 가 소비한다. */
export interface NotifyIntent {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * 중간점검 2단계 흐름(2026-07-23)의 상태 전이 서비스.
 * pending →(1차 코멘트) commented →(본인 수정) revised →(2차 판정) closed | returned →(재수정) revised.
 *
 * 판단 로직은 순수 함수에 위임한다 — 평가자 체인은 resolveMidtermReviewers,
 * 차례 검증은 evaluateMidtermTurn, KPI 수정 검증·적용은 KpiRevisionService.
 * 이 서비스는 그 결과를 트랜잭션·이력·감사와 엮는 조립 책임만 진다.
 * 알림은 여기서 보내지 않고 의도(NotifyIntent)만 돌려준다 — 트랜잭션이 롤백되면
 * 이미 보낸 알림을 되돌릴 수 없기 때문에, 커밋 이후 단계(Task 8)에서 발송한다.
 */
@Injectable()
export class MidtermReviewFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revision: KpiRevisionService,
    private readonly trail: MidtermTrailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * HR 개시 — 대상자(확정 KPI 보유·재직·그룹대표/본부장 제외) 리뷰를 멱등 생성.
   * dryRun=true 면 생성하지 않고 대상·경고만 돌려준다.
   */
  async open(current: AuthUser, dto: OpenMidtermDto) {
    // 이 메서드는 주기 전체 리뷰를 pending/revisionRound=0 으로 되돌리는 파괴적 작업이다.
    // review 단위 차례 검증(evaluateMidtermTurn)이 커버하지 못하는 범위라 여기서 직접
    // 역할을 확인한다 — 컨트롤러의 @Roles(hr_admin) 가 아직 없으므로 방어 심층화 차원.
    if (current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '중간점검 개시는 인사 담당자만 할 수 있어요.',
      });
    }
    await assertMidReviewStage(
      this.prisma,
      dto.cycleId,
      '중간점검은 중간평가(mid_review) 단계에서만 개시할 수 있어요.',
    );

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const confirmedCounts = await this.prisma.kpi.groupBy({
      by: ['userId'],
      where: { cycleId: dto.cycleId, status: KpiStatus.confirmed },
      _count: { _all: true },
    });
    const hasConfirmed = new Set(confirmedCounts.map((c) => c.userId));

    const targets: { userId: string; firstReviewerId: string; finalReviewerId: string }[] = [];
    const warnings: { userId: string; name: string; reason: string }[] = [];

    for (const u of users) {
      const { firstReviewerId, finalReviewerId } = await resolveMidtermReviewers(this.prisma, u.id);
      if (!finalReviewerId) continue; // 그룹대표 본인·그룹 미지정 → 대상 아님(조용히 제외)
      if (!hasConfirmed.has(u.id)) {
        warnings.push({ userId: u.id, name: u.name, reason: 'KPI 미확정' });
        continue;
      }
      // finalReviewerId 가 있으면 pickMidtermReviewers 는 1차도 반드시 채운다(그룹대표 단독 폴백).
      targets.push({ userId: u.id, firstReviewerId: firstReviewerId!, finalReviewerId });
      if (firstReviewerId === finalReviewerId) {
        warnings.push({ userId: u.id, name: u.name, reason: '1차 평가자 없음 — 그룹대표 단독' });
      }
    }

    const stale = await this.prisma.rebaselineRequest.count({
      where: { cycleId: dto.cycleId, status: 'submitted' },
    });
    if (stale > 0) {
      warnings.push({ userId: '-', name: '-', reason: `검토 대기 재조정 요청 ${stale}건` });
    }

    // 미리보기는 부작용이 없어야 하므로 여기서 끝낸다(알림도 없음).
    if (dto.dryRun) {
      return { data: { targets, warnings, created: 0 }, notify: [] as NotifyIntent[] };
    }

    let created = 0;
    // Finding 2: 실제로 생성·초기화된 대상만 모은다 — continue 로 건너뛴(이미 신규 흐름
    // 진행 중인) 리뷰까지 targets 전체 기준으로 알리면, 재개시할 때마다 이미 처리했을 수도
    // 있는 1차 평가자에게 중복 알림이 간다.
    const openedTargets: typeof targets = [];
    for (const t of targets) {
      const existing = await this.prisma.midtermReview.findUnique({
        where: { cycleId_evaluateeId: { cycleId: dto.cycleId, evaluateeId: t.userId } },
        select: { id: true, status: true },
      });
      if (existing && !this.isLegacyStatus(existing.status)) continue; // 이미 신규 흐름 진행 중
      await this.prisma.midtermReview.upsert({
        where: { cycleId_evaluateeId: { cycleId: dto.cycleId, evaluateeId: t.userId } },
        create: {
          cycleId: dto.cycleId,
          evaluateeId: t.userId,
          status: MidtermReviewStatus.pending,
          firstReviewerId: t.firstReviewerId,
          finalReviewerId: t.finalReviewerId,
        },
        update: {
          status: MidtermReviewStatus.pending,
          firstReviewerId: t.firstReviewerId,
          finalReviewerId: t.finalReviewerId,
          revisionRound: 0,
          // 레거시 순차 확인 결재(reviewStage/reviewTrail)도 함께 초기화한다 — 두 흐름은
          // 사이클당 상호 배타적이어야 하는데, 여기서 남겨두면 pending 으로 되돌아간 행이
          // 0이 아닌 확인 단계를 그대로 들고 있어 공존 중인 MidtermReviewsService(레거시)가
          // 이미 진행된 것처럼 잘못 읽는다. selfNote 등 나머지 레거시 컬럼은 2025 아카이브
          // 조회를 위해 그대로 둔다.
          reviewStage: 0,
          reviewTrail: Prisma.JsonNull,
        },
      });
      created++;
      openedTargets.push(t);
    }

    await this.audit.record({
      entity: 'MidtermReview',
      entityId: dto.cycleId,
      action: 'midterm.open',
      actorId: current.id,
      after: { created, targetCount: targets.length },
    });

    // 한 사람이 여러 명의 1차 평가자일 수 있으므로 수신자를 중복 제거한다.
    const notify: NotifyIntent[] = Array.from(
      new Set(openedTargets.map((t) => t.firstReviewerId)),
    ).map((userId) => ({
      userId,
      type: 'midterm_opened',
      payload: { cycleId: dto.cycleId, message: '중간평가를 시작해 주세요.' },
    }));
    return { data: { targets, warnings, created }, notify };
  }

  /** 레거시(자가점검) 상태 여부 — 개시 시 신규 흐름으로 초기화 대상. */
  private isLegacyStatus(s: MidtermReviewStatus): boolean {
    return (
      s === MidtermReviewStatus.pending ||
      s === MidtermReviewStatus.self_done ||
      s === MidtermReviewStatus.confirmed ||
      s === MidtermReviewStatus.revision_requested ||
      s === MidtermReviewStatus.rejected
    );
  }

  /** 리뷰 로드 + 단계 게이트 + 차례 검증을 한 번에. */
  private async loadAndAuthorize(current: AuthUser, id: string, action: MidtermAction) {
    const review = await this.prisma.midtermReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '중간점검을 찾을 수 없어요.' });
    }
    await assertMidReviewStage(
      this.prisma,
      review.cycleId,
      '중간평가(mid_review) 단계에서만 처리할 수 있어요.',
    );
    const gate = evaluateMidtermTurn({
      action,
      status: review.status,
      userId: current.id,
      role: current.role,
      evaluateeId: review.evaluateeId,
      firstReviewerId: review.firstReviewerId,
      finalReviewerId: review.finalReviewerId,
    });
    if (!gate.allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: MIDTERM_TURN_MESSAGE[gate.kind] });
    }
    // 대리 표시는 "HR 권한으로 남의 차례를 대신했을 때"만 — HR 담당자가 본인 차례를
    // 처리한 경우(예: HR 이 곧 그룹대표)까지 대리로 남기면 이력이 사실과 달라진다.
    const onBehalfOf = current.role === Role.hr_admin && !this.isOwner(review, current.id, action);
    return { review, onBehalfOf };
  }

  private isOwner(
    review: { evaluateeId: string; firstReviewerId: string | null; finalReviewerId: string | null },
    userId: string,
    action: MidtermAction,
  ): boolean {
    if (action === 'comment') return review.firstReviewerId === userId;
    if (action === 'revise') return review.evaluateeId === userId;
    return review.finalReviewerId === userId;
  }

  /** 1차 코멘트 등록 → commented. KPI별 코멘트는 MidtermKpiCheckIn 에 upsert. */
  async comment(current: AuthUser, id: string, dto: CommentMidtermDto) {
    const { review, onBehalfOf } = await this.loadAndAuthorize(current, id, 'comment');
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.commented);

    const kpiComments = dto.kpiComments ?? [];
    if (kpiComments.length) {
      // 같은 kpiId 가 중복으로 들어오면 findMany 결과 수와 어긋나 오탐이 나므로,
      // 조회와 개수 비교를 같은 중복 제거 목록 하나로 맞춘다.
      const kpiIds = Array.from(new Set(kpiComments.map((c) => c.kpiId)));
      const owned = await this.prisma.kpi.findMany({
        where: {
          id: { in: kpiIds },
          userId: review.evaluateeId,
          cycleId: review.cycleId,
        },
        select: { id: true },
      });
      if (owned.length !== kpiIds.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '해당 구성원의 이번 주기 KPI에만 코멘트할 수 있어요.',
        });
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          status: MidtermReviewStatus.commented,
          // 앞뒤 공백만 있는 입력은 null 로, 나머지는 trim 된 값으로 저장한다(원본 그대로
          // 저장하면 앞뒤 공백이 그대로 영속화된다).
          firstComment: dto.overallComment?.trim() ? dto.overallComment.trim() : null,
          firstCommentedAt: now,
        },
      });
      for (const c of kpiComments) {
        await tx.midtermKpiCheckIn.upsert({
          where: { midtermReviewId_kpiId: { midtermReviewId: id, kpiId: c.kpiId } },
          create: {
            midtermReviewId: id,
            kpiId: c.kpiId,
            reviewerNote: c.note ?? null,
            reviewerDecision: c.decision ?? null,
          },
          update: { reviewerNote: c.note ?? null, reviewerDecision: c.decision ?? null },
        });
      }
      await this.trail.record(tx, {
        midtermReviewId: id,
        action: 'commented',
        actorId: current.id,
        onBehalfOf,
        comment: dto.overallComment ?? null,
      });
    });

    await this.audit.record({
      entity: 'MidtermReview',
      entityId: id,
      action: 'midterm.comment',
      actorId: current.id,
      after: { kpiCommentCount: kpiComments.length, onBehalfOf },
    });

    const adjustCount = kpiComments.filter((c) => c.decision === 'rebaseline').length;
    return {
      data: await this.detail(id),
      notify: [
        {
          userId: review.evaluateeId,
          type: 'midterm_comment_received',
          payload: {
            cycleId: review.cycleId,
            message: `중간점검 코멘트가 등록됐어요. 조정 검토 요청 KPI ${adjustCount}건`,
          },
        },
      ] as NotifyIntent[],
    };
  }

  /** 임직원 수정 제출 → revised. 변경 0건이면 memberNote 필수. */
  async submitRevision(current: AuthUser, id: string, dto: SubmitMidtermRevisionDto) {
    const { review, onBehalfOf } = await this.loadAndAuthorize(current, id, 'revise');
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.revised);

    const items = dto.items ?? [];
    const note = dto.memberNote?.trim() ?? '';
    if (!items.length && !note) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '수정할 KPI가 없다면 회신 사유를 적어 주세요.',
      });
    }
    await this.revision.validate(review.cycleId, review.evaluateeId, items);

    // 회차를 라벨에 넣어 반려·재수정마다 별도 스냅샷이 남게 한다(같은 라벨은 재사용됨).
    const round = review.revisionRound + 1;
    // Finding 1: KPI 반영(revision.apply)과 리뷰 상태 전이·이력 기록을 한 트랜잭션으로 묶는다.
    // 예전엔 apply 가 자체 $transaction 을 열고 끝난 뒤 별도 트랜잭션으로 상태를 바꿨는데,
    // 두 번째가 실패하면 KPI 는 이미 바뀐 채 이력만 없는 상태가 되고, 재제출해도 apply 의
    // diff 가 이미 반영된 값과 비교돼 0건이 돼 그 변경이 감사·이력에서 영영 사라졌다.
    const applied = await this.prisma.$transaction(async (tx) => {
      const result = await this.revision.apply({
        actorId: current.id,
        cycleId: review.cycleId,
        evaluateeId: review.evaluateeId,
        items,
        snapshotLabel: `중간점검 수정 전 (${round}회차)`,
        auditAction: 'kpi.midterm_revision',
        auditContext: { midtermReviewId: id, round, memberNote: note || null },
        tx,
      });
      await tx.midtermReview.update({
        where: { id },
        data: {
          status: MidtermReviewStatus.revised,
          memberNote: note || null,
          memberSubmittedAt: new Date(),
          revisionRound: round,
        },
      });
      await this.trail.record(tx, {
        midtermReviewId: id,
        action: 'revised',
        actorId: current.id,
        onBehalfOf,
        comment: note || null,
        kpiChanges: result.changes,
        snapshotId: result.snapshotId,
      });
      return result;
    });

    return {
      data: await this.detail(id),
      notify: review.finalReviewerId
        ? ([
            {
              userId: review.finalReviewerId,
              type: 'midterm_revision_submitted',
              payload: {
                cycleId: review.cycleId,
                message: `중간점검 수정본이 제출됐어요. KPI 변경 ${applied.changes.length}건`,
              },
            },
          ] as NotifyIntent[])
        : [],
    };
  }

  /** 2차 승인 → closed. */
  async approve(current: AuthUser, id: string, dto: DecideMidtermDto) {
    return this.decide(current, id, dto, MidtermReviewStatus.closed);
  }

  /** 2차 반려 → returned. 사유 필수. */
  async returnToMember(current: AuthUser, id: string, dto: DecideMidtermDto) {
    if (!dto.comment?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '반려 사유를 적어 주세요.',
      });
    }
    return this.decide(current, id, dto, MidtermReviewStatus.returned);
  }

  private async decide(
    current: AuthUser,
    id: string,
    dto: DecideMidtermDto,
    next: MidtermReviewStatus,
  ) {
    const { review, onBehalfOf } = await this.loadAndAuthorize(current, id, 'decide');
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, next);
    const approved = next === MidtermReviewStatus.closed;

    const trimmedComment = dto.comment?.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          status: next,
          // 코멘트 없이 승인할 때는 이 필드를 건드리지 않는다 — returned 의 반려 사유가
          // finalComment 에 남아 있는데, 코멘트 없는 승인이 그걸 null 로 지워버리면
          // 이전 반려 사유가 사라진다. 값이 있을 때만 trim 해서 갱신한다.
          ...(trimmedComment ? { finalComment: trimmedComment } : {}),
          decidedAt: new Date(),
        },
      });
      await this.trail.record(tx, {
        midtermReviewId: id,
        action: approved ? 'approved' : 'returned',
        actorId: current.id,
        onBehalfOf,
        comment: dto.comment ?? null,
      });
    });

    await this.audit.record({
      entity: 'MidtermReview',
      entityId: id,
      action: approved ? 'midterm.approve' : 'midterm.return',
      actorId: current.id,
      after: { onBehalfOf },
    });

    // 마감은 1차 평가자에게도 알린다(자기가 코멘트한 건의 결말). 반려는 본인만.
    const recipients = approved
      ? [review.evaluateeId, review.firstReviewerId].filter((uid): uid is string => !!uid)
      : [review.evaluateeId];
    return {
      data: await this.detail(id),
      notify: recipients.map((userId) => ({
        userId,
        type: approved ? 'midterm_closed' : 'midterm_returned',
        payload: {
          cycleId: review.cycleId,
          message: approved
            ? '중간점검이 마무리됐어요.'
            : '중간점검이 반려됐어요. 내용을 보완해 주세요.',
        },
      })) as NotifyIntent[],
    };
  }

  /** HR 되돌림 — closed → revised. */
  async reopen(current: AuthUser, id: string) {
    const { review, onBehalfOf } = await this.loadAndAuthorize(current, id, 'reopen');
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.revised);
    await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: { status: MidtermReviewStatus.revised, decidedAt: null },
      });
      // loadAndAuthorize 가 이미 본인 차례 여부를 판정했으므로 그대로 쓴다 — HR 담당자가
      // 마침 자신이 최종 평가자인 건을 되돌린 경우까지 대리로 남기면 이력이 사실과 달라진다.
      await this.trail.record(tx, {
        midtermReviewId: id,
        action: 'reopened',
        actorId: current.id,
        onBehalfOf,
      });
    });
    await this.audit.record({
      entity: 'MidtermReview',
      entityId: id,
      action: 'midterm.reopen',
      actorId: current.id,
    });
    return { data: await this.detail(id), notify: [] as NotifyIntent[] };
  }

  /**
   * HR 재배정 — 조직 변경분 반영. closed 가 아닌 건만, 완료 단계는 되돌리지 않는다.
   */
  async reassign(current: AuthUser, cycleId: string) {
    // open 과 마찬가지로 주기 전체 리뷰의 평가자를 일괄 재기록하는 파괴적 작업이다.
    // review 단위 차례 검증으로는 걸러지지 않으므로 여기서도 직접 역할을 확인한다.
    if (current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '중간점검 평가자 재배정은 인사 담당자만 할 수 있어요.',
      });
    }
    await assertMidReviewStage(
      this.prisma,
      cycleId,
      '중간평가(mid_review) 단계에서만 재배정할 수 있어요.',
    );
    const rows = await this.prisma.midtermReview.findMany({
      where: { cycleId, status: { not: MidtermReviewStatus.closed } },
      select: { id: true, evaluateeId: true, firstReviewerId: true, finalReviewerId: true },
    });
    let changed = 0;
    for (const r of rows) {
      const next = await resolveMidtermReviewers(this.prisma, r.evaluateeId);
      if (!next.finalReviewerId) continue;
      if (next.firstReviewerId === r.firstReviewerId && next.finalReviewerId === r.finalReviewerId) {
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.midtermReview.update({
          where: { id: r.id },
          data: {
            firstReviewerId: next.firstReviewerId,
            finalReviewerId: next.finalReviewerId,
          },
        });
        await this.trail.record(tx, {
          midtermReviewId: r.id,
          action: 'reassigned',
          actorId: current.id,
          onBehalfOf: true,
          comment: `평가자 재배정 (1차 ${r.firstReviewerId ?? '-'} → ${next.firstReviewerId ?? '-'}, 2차 ${r.finalReviewerId ?? '-'} → ${next.finalReviewerId})`,
        });
      });
      changed++;
    }
    return { data: { scanned: rows.length, changed }, notify: [] as NotifyIntent[] };
  }

  /** 상세 조회 — 리뷰 + KPI 코멘트 + 이력. */
  async detail(id: string) {
    const review = await this.prisma.midtermReview.findUniqueOrThrow({
      where: { id },
      include: { kpiCheckIns: true, evaluatee: { select: { id: true, name: true } } },
    });
    return { ...review, trail: await this.trail.list(id) };
  }
}
