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
import {
  evaluateApprovalGate,
  approvedIdsFromTrail,
} from '../kpis/approval-gate';

/**
 * 확인(순차 결재) 게이트 차단 사유별 안내 — KPI 결재선(evaluateApprovalGate)과 동일 규칙,
 * 문구만 '확인' 용어. hr_blocked: KPI(98ce837)와 대칭 — 배정 확인자가 있는 단계는 HR 대리 불가.
 */
const MIDTERM_CONFIRM_GATE_MESSAGE: Record<
  'hr_blocked' | 'not_in_chain' | 'already' | 'not_yet',
  string
> = {
  hr_blocked:
    '이 단계는 배정된 확인자가 있어 HR도 대리 확인할 수 없어요. 해당 확인자가 확인하거나, 반송으로 되돌린 뒤 진행하세요.',
  not_in_chain: '이 구성원의 확인 결재선(팀장→본부장→그룹대표)에 포함되어 있지 않아요.',
  already: '이미 확인한 단계예요. 다음 단계 결재자의 확인 차례예요.',
  not_yet: '앞 단계 확인 후 처리할 수 있어요.',
};

/**
 * 2단계 흐름(2026-07-23)에서만 나타나는 상태값. 레거시 자가점검 제출이
 * 이 상태의 리뷰를 건드리지 못하게 막는 판정 기준으로 쓴다.
 */
const NEW_FLOW_STATUSES: MidtermReviewStatus[] = [
  MidtermReviewStatus.commented,
  MidtermReviewStatus.revised,
  MidtermReviewStatus.returned,
  MidtermReviewStatus.closed,
];

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
      // canViewUser(부서 가시범위) 통과만으로는 부족하다 — 체인 밖 팀장도 팀원을 "볼 수" 있어서
      // 1차 코멘트(firstComment)가 새기 때문. 체인 소속을 **함께**(AND) 요구한다.
      if (current.role !== Role.hr_admin) {
        where.AND = [this.chainScope(current.id)];
      }
    } else if (current.role !== Role.hr_admin) {
      // 2026-07-23: 중간점검은 부서 가시범위가 아니라 **배정된 체인**으로 스코프한다.
      // (팀장은 새 흐름의 체인에 없으므로 팀원 리뷰가 보이지 않는다.)
      where.AND = [this.chainScope(current.id)];
    }

    const rows = await this.prisma.midtermReview.findMany({
      where,
      include: REVIEW_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 본인 자가점검 제출(현재 사용자 본인 한정). upsert.
   * check-in 을 1건 이상 보낸 경우에만 "제출"로 간주 → self_done 전이(+selfSubmittedAt).
   * 총평(selfNote)만 저장(check-in 0건)은 상태를 건드리지 않는다 —
   * 반려/재조정 요청 상태에서 총평만 고쳐도 조용히 재제출되지 않고,
   * 총평 먼저 저장 시에도 빈(check-in 0건) 리뷰가 부서장 승인 큐(self_done)에 오르지 않는다.
   */
  async submitSelf(current: AuthUser, dto: SubmitMidtermSelfReviewDto) {
    const checkIns = dto.kpiCheckIns ?? [];
    // 제출 여부: KPI check-in 동반 시에만 상태 전이(총평-단독 저장은 note-only).
    const isSubmission = checkIns.length > 0;

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
    // 2026-07-23 재편: 신규 흐름 주기에서는 자가점검을 받지 않는다(과거 주기 조회는 유지).
    // 판정 기준은 주기가 아니라 **이 리뷰의 상태** — 신규 흐름 상태값을 들고 있으면 HR 이
    // 이미 2단계로 개시한 건이므로, 레거시 제출이 그 위에 덮어써 코멘트·회차를 뒤엎지 못하게 막는다.
    // (아직 개시 전이거나 2025 아카이브처럼 레거시 상태인 건은 그대로 통과 — 읽기 경로도 불변.)
    if (existing && NEW_FLOW_STATUSES.includes(existing.status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          '이번 주기 중간점검은 부서장 코멘트 후 목표를 수정하는 방식이에요. 중간점검 화면에서 진행해 주세요.',
      });
    }
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
    // 문항(KPI) 카드 단위 개별 제출 지원: selfNote 미지정(undefined) 요청은 기존 총평을 보존.
    // 명시 전송 시에만 갱신(빈 문자열 = 총평 삭제).
    const selfNotePatch =
      dto.selfNote === undefined ? {} : { selfNote: dto.selfNote.trim() ? dto.selfNote : null };
    const row = await this.prisma.$transaction(async (tx) => {
      const review = await tx.midtermReview.upsert({
        where: { cycleId_evaluateeId: { cycleId: dto.cycleId, evaluateeId: current.id } },
        create: {
          cycleId: dto.cycleId,
          evaluateeId: current.id,
          selfNote: dto.selfNote?.trim() ? dto.selfNote : null,
          // 총평-단독 저장으로 생성되는 리뷰는 pending(미제출) — 부서장 승인 대상 아님.
          ...(isSubmission
            ? { selfSubmittedAt: now, status: MidtermReviewStatus.self_done }
            : {}),
        },
        update: {
          ...selfNotePatch,
          // 제출(check-in 동반)일 때만 전이: 반려/재조정 요청 상태에서의 재제출 →
          // self_done 복귀(confirmed 는 위 가드에서 차단). 총평-단독 저장은 상태 보존.
          // 재제출 시 순차 확인은 1차부터 다시(reviewStage/Trail 리셋).
          ...(isSubmission
            ? {
                selfSubmittedAt: now,
                status: MidtermReviewStatus.self_done,
                reviewStage: 0,
                reviewTrail: Prisma.JsonNull,
              }
            : {}),
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
      // 총평-단독 저장(비전이)과 자가점검 제출(self_done 전이)을 감사에서 구분.
      action: isSubmission ? 'midterm_review.self_submit' : 'midterm_review.self_note_save',
      actorId: current.id,
      after: { cycleId: dto.cycleId, kpiCheckInCount: checkIns.length },
    });
    return this.toDto(row);
  }

  /**
   * 부서장 확인(승인) — KPI 결재선과 동일한 **순차 결재**(2026-07-07, 2026-07-23 이력 기준 개정).
   * 체인 = resolveDownwardEvaluators(1차 팀장→2차 본부장→최종 그룹대표, 압축).
   * 자기 차례(확인 이력 reviewTrail 기준 — 아직 확인 안 한 가장 앞 구성원)에만 확인 가능.
   * hr_admin 대리는 대기 확인자가 없는 경우(빈 체인·계층 공백)만(KPI 게이트와 동일 규칙).
   * 마지막 단계에서만 status=confirmed(전 단계 완료), 중간 단계는 self_done 유지 + stage/이력만 누적.
   */
  async confirm(current: AuthUser, id: string, dto: ConfirmMidtermReviewDto) {
    const review = await this.findOrThrow(id);
    // 검토자 액션 전이 가드: self_done 아닌 상태에서 confirm 차단(중간 단계도 self_done 유지).
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.confirmed);

    const chain = await this.reviewChain(review.evaluateeId);
    if (current.role === Role.employee) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '부서장만 확인할 수 있어요.' });
    }
    // 담당 단계 검증 — 위치 인덱스(chain[reviewStage])가 아닌 **확인 이력(reviewTrail) 기준**
    // (2026-07-23, KPI 결재 게이트와 동일 규칙 공유): 확인 도중 부서장이 바뀌어도 단계
    // 건너뜀·중복 확인이 생기지 않는다. 아울러 hr_admin 은 **대기 확인자가 없는 경우**
    // (빈 체인·계층 공백)만 대리 확인 — 배정 확인자(예: 타 팀 1차 팀장)가 대기 중이면
    // hr_admin 이라도 대리 불가(KPI 승인 게이트 98ce837 과 비대칭이던 구멍을 닫음).
    const approvedIds = approvedIdsFromTrail(review.reviewTrail, review.reviewStage, chain);
    const gate = evaluateApprovalGate(current.role, current.id, chain, approvedIds);
    if (!gate.allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: MIDTERM_CONFIRM_GATE_MESSAGE[gate.kind],
      });
    }
    approvedIds.add(current.id);
    // 완료 단계 수·최종 여부도 이력 기준 — 살아있는 체인 전원이 확인했을 때만 confirmed
    // (체인 축소/빈 체인 포함: 남은 대기 확인자가 없으면 완료).
    const newStage = chain.filter((uid) => approvedIds.has(uid)).length;
    const isFinal = newStage >= chain.length;

    const approver = await this.prisma.user.findUnique({
      where: { id: current.id },
      select: { name: true },
    });
    const now = new Date();
    const priorTrail = Array.isArray(review.reviewTrail) ? (review.reviewTrail as unknown[]) : [];
    const trail = [
      ...priorTrail,
      {
        // 표시용 차수: 정상 흐름에선 newStage 와 이력 순번이 일치. HR 대리처럼 newStage 가
        // 늘지 않는 경우엔 이력 순번으로 폴백.
        stage: newStage > priorTrail.length ? newStage : priorTrail.length + 1,
        approverId: current.id,
        approverName: approver?.name ?? '',
        at: now.toISOString(),
      },
    ];
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          reviewerId: current.id,
          reviewerNote: dto.reviewerNote ?? review.reviewerNote ?? null,
          reviewStage: newStage,
          reviewTrail: trail as unknown as Prisma.InputJsonValue,
          ...(isFinal
            ? { confirmedAt: now, status: MidtermReviewStatus.confirmed }
            : {}),
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
      before: { status: review.status, reviewStage: review.reviewStage },
      after: {
        status: isFinal ? MidtermReviewStatus.confirmed : review.status,
        reviewStage: newStage,
      },
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
    // KPI 결재선과 동일 규칙: 전 단계 확인 완료(confirmed) 후 되돌림은 hr_admin 전용.
    // 진행 중(self_done) 반송은 결재선 구성원 누구나(assertReviewerAuth) — 화면은 내 차례에만 노출.
    if (review.status === MidtermReviewStatus.confirmed && current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '전 단계 확인이 완료된 점검은 HR 관리자만 되돌릴 수 있어요.',
      });
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          reviewerId: current.id,
          reviewerNote: dto.reviewerNote,
          confirmedAt: null,
          status: decision,
          // 반송 → 재제출 시 1차부터 다시.
          reviewStage: 0,
          reviewTrail: Prisma.JsonNull,
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

  /**
   * 목록 스코프 — "내가 피평가자이거나, 1차/2차로 배정된 건".
   * `where.AND = [chainScope(...)]` 형태로 붙여 cycleId·evaluateeId 등 다른 조건과 반드시
   * 교집합이 되게 한다(`where.OR` 로 직접 얹으면 읽는 사람이 합집합으로 오해하기 쉽다).
   */
  private chainScope(userId: string): Prisma.MidtermReviewWhereInput {
    return {
      OR: [
        { evaluateeId: userId },
        { firstReviewerId: userId },
        { finalReviewerId: userId },
      ],
    };
  }

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

  /** 확인 결재 체인 [1차, 2차, (최종)] — KPI 결재선(kpis.service.approvalChain)과 동일 원천. */
  private async reviewChain(evaluateeId: string): Promise<string[]> {
    const heads = await resolveDownwardEvaluators(this.prisma, evaluateeId);
    return [heads.round1, heads.round2, heads.round3].filter((x): x is string => !!x);
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
      // 순차 확인 결재(2026-07-07): 완료 단계 수 + 이력.
      reviewStage: r.reviewStage,
      reviewTrail: Array.isArray(r.reviewTrail) ? r.reviewTrail : null,
      // 2단계 흐름(2026-07-23). 목록 스코프가 체인 소속으로 좁혀져 있어야 1차 코멘트가
      // 체인 밖으로 새지 않는다(list 의 chainScope 참조).
      firstReviewerId: r.firstReviewerId,
      firstComment: r.firstComment,
      firstCommentedAt: r.firstCommentedAt,
      memberNote: r.memberNote,
      memberSubmittedAt: r.memberSubmittedAt,
      finalReviewerId: r.finalReviewerId,
      finalComment: r.finalComment,
      decidedAt: r.decidedAt,
      revisionRound: r.revisionRound,
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
