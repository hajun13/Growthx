import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentType, KpiStatus, MidtermReviewStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { assertMidReviewStage } from '../../common/state/cycle-stage';
import { assertTransition, MIDTERM_REVIEW_TRANSITIONS } from '../../common/state/transitions';
import { resolveMidtermReviewers } from '../../common/access/midterm-reviewers.util';
import { AuditService } from '../../common/audit/audit.service';
import { KpiRevisionService } from '../kpis/kpi-revision.service';
import { MidtermTrailService, MidtermKpiReview } from './midterm-trail.service';
import {
  evaluateMidtermTurn,
  MIDTERM_REVISABLE_STATUSES,
  MIDTERM_TURN_MESSAGE,
  MidtermAction,
} from './midterm-turn';
import {
  CommentMidtermDto,
  DecideMidtermDto,
  OpenMidtermDto,
  SaveMidtermRevisionDraftDto,
  SubmitMidtermRevisionDto,
} from './dto/midterm-flow.dto';

/**
 * 레거시(자가점검) 상태의 한글 표기 — HR 개시 미리보기 경고 문구에만 쓴다.
 * 운영자가 보는 문구에 DB enum 값을 그대로 노출하지 않기 위한 매핑.
 */
const LEGACY_STATUS_LABEL: Partial<Record<MidtermReviewStatus, string>> = {
  [MidtermReviewStatus.self_done]: '본인 제출 완료',
  [MidtermReviewStatus.confirmed]: '부서장 확인 완료',
  [MidtermReviewStatus.revision_requested]: '수정 요청',
  [MidtermReviewStatus.rejected]: '반려',
};

/**
 * 2단계 흐름에서만 나타나는 상태값. 평가자 스냅샷과 함께 "이미 신규 흐름으로 개시된 행"의
 * 두 번째 판정 근거로 쓴다(MidtermReviewsService 의 레거시 제출 게이트와 동일한 목록).
 */
const NEW_FLOW_STATUSES: MidtermReviewStatus[] = [
  MidtermReviewStatus.commented,
  MidtermReviewStatus.revised,
  MidtermReviewStatus.returned,
  MidtermReviewStatus.closed,
];

/**
 * 개시가 한 대상자에게 실제로 할 일.
 *  - `create` 리뷰 행이 없다 → 새로 만든다.
 *  - `reset`  레거시(자가점검) 잔재 행이 있다 → 신규 흐름 pending 으로 초기화한다.
 *  - `skip`   이미 신규 흐름으로 개시된 행이다 → **아무것도 하지 않는다**.
 */
type OpenPlanAction = 'create' | 'reset' | 'skip';

/** 개시 계획 판정에 필요한 기존 행의 최소 형태. */
interface ExistingOpenRow {
  status: MidtermReviewStatus;
  firstReviewerId: string | null;
  finalReviewerId: string | null;
}

/**
 * 개시 계획 판정 — **상태값이 아니라 출처(provenance)** 로 레거시를 가린다.
 *
 * open() 만이 firstReviewerId·finalReviewerId 를 채우므로(레거시 자가점검 행은 둘 다 null),
 * 평가자 스냅샷이 있으면 이미 개시된 행이다. 예전처럼 `pending` 을 레거시로 취급하면,
 * 개시된 뒤 1차 코멘트를 기다리는 정상 행이 재개시 때마다 초기화돼
 *  ①updatedAt 이 갱신돼 진행 현황의 경과일(pending 은 updatedAt 기준)이 전부 "오늘"이 되고
 *  ②그 1차 평가자에게 midterm_opened 메일이 다시 나가고
 *  ③평가자가 reassign() 이 남기는 'reassigned' 이력 없이 조용히 덮어써지고
 *  ④created 가 부풀려져 HR 이 "87건 생성"으로 읽는다.
 * 이 판정은 midterm-reviews.service 의 레거시 제출 게이트·요약의 isNotOpenedRow 와 같은 기준이다.
 */
function planOpenAction(existing: ExistingOpenRow | undefined): OpenPlanAction {
  if (!existing) return 'create';
  const openedByFlow =
    existing.firstReviewerId != null ||
    existing.finalReviewerId != null ||
    // 평가자 없이도 HR 대리로 전이가 일어난 이례적 행까지 보호한다(상태만으로도 신규 흐름 증거).
    NEW_FLOW_STATUSES.includes(existing.status);
  return openedByFlow ? 'skip' : 'reset';
}

/**
 * MidtermReview.revisionDraft 에 직렬화되는 임시저장본.
 * 제출 페이로드(SubmitMidtermRevisionDto) + 저장 시각. 화면은 이 값을 그대로 폼에 복원한다.
 */
export interface MidtermRevisionDraft {
  items: {
    kpiId: string;
    targetValue?: number | null;
    targetText?: string | null;
    weight?: number;
  }[];
  memberNote: string;
  savedAt: string;
}

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
  /** 변경 0건 + 회신 사유 없음 거절 문구(빠른 경로·트랜잭션 내 게이트가 공유). */
  static readonly ZERO_CHANGE_MESSAGE = '수정할 KPI가 없다면 회신 사유를 적어 주세요.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly revision: KpiRevisionService,
    private readonly trail: MidtermTrailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * HR 개시 — 대상자(재직 · 확정 KPI 보유 · 그룹대표/본부장 제외) 리뷰를 멱등 생성.
   * 설계 §3.1 "대상 = 임직원 + 팀장"에 따라 본부장·그룹대표는 대상이 아니다.
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

    // 설계 §3.1: 본부장은 중간점검 대상이 아니다(그룹대표와 동일 취급).
    // 본부장 판정은 계정 role 이 아니라 division 부서의 headUserId 명시 지정만 본다(B-1) —
    // 부서장이 role='employee' 인 계정일 수 있기 때문이다.
    const divisionHeadRows = await this.prisma.department.findMany({
      where: { type: DepartmentType.division, headUserId: { not: null } },
      select: { headUserId: true },
    });
    const divisionHeadIds = new Set(
      divisionHeadRows.map((d) => d.headUserId).filter((id): id is string => !!id),
    );

    const targets: { userId: string; firstReviewerId: string; finalReviewerId: string }[] = [];
    const warnings: { userId: string; name: string; reason: string }[] = [];

    for (const u of users) {
      // 대상 범위 밖(본부장)은 이상 상황이 아니므로 경고하지 않고 조용히 제외한다.
      if (divisionHeadIds.has(u.id)) continue;
      const { firstReviewerId, finalReviewerId, skipReason } = await resolveMidtermReviewers(
        this.prisma,
        u.id,
      );
      if (!finalReviewerId) {
        // 그룹대표 본인(is_group_head)은 설계상 대상 아님 → 조용히 제외.
        // 반면 그룹대표 미지정·소속 부서 없음(no_group_head)은 운영 이상인데, 조용히
        // 빠지면 HR 이 "왜 이 사람이 대상에 없지"를 알아낼 방법이 전혀 없다 → 경고로 노출.
        if (skipReason === 'no_group_head') {
          warnings.push({
            userId: u.id,
            name: u.name,
            reason: '그룹대표 미지정(또는 소속 부서 없음) — 대상에서 빠져요',
          });
        }
        continue;
      }
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

    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const existingRows = await this.prisma.midtermReview.findMany({
      where: { cycleId: dto.cycleId, evaluateeId: { in: targets.map((t) => t.userId) } },
      select: {
        evaluateeId: true,
        status: true,
        firstReviewerId: true,
        finalReviewerId: true,
      },
    });
    const existingByUser = new Map<string, ExistingOpenRow>(
      existingRows.map((r) => [r.evaluateeId, r]),
    );
    // 계획을 **한 번만** 세워 미리보기와 실제 실행이 같은 판정을 공유하게 한다 —
    // 두 곳에서 따로 판정하면 "경고에 없던 행이 초기화되는" 어긋남이 다시 생긴다.
    const plan = new Map<string, OpenPlanAction>(
      targets.map((t) => [t.userId, planOpenAction(existingByUser.get(t.userId))]),
    );

    // 개시가 실제로 덮어쓸(초기화할) 레거시 자가점검 행을 미리보기에 이름까지 드러낸다 —
    // 아래 upsert 의 update 브랜치가 status/revisionRound/reviewStage/reviewTrail 을 되돌리므로,
    // 진행 중이던 자가점검·순차 확인이 사라진다.
    // pending 인 레거시 행은 제외한다: 되돌릴 진행분이 없을뿐더러, 그 행의 경과일은 진행 현황에서
    // updatedAt 이 아니라 createdAt 기준(resolveNotOpened)이라 초기화로 부풀려지지도 않는다.
    // 이미 개시된 행(plan='skip')은 이제 손대지 않으므로 경고할 것도 없다.
    for (const t of targets) {
      if (plan.get(t.userId) !== 'reset') continue;
      const status = existingByUser.get(t.userId)!.status;
      if (status === MidtermReviewStatus.pending) continue;
      warnings.push({
        userId: t.userId,
        name: nameById.get(t.userId) ?? t.userId,
        reason: `진행 중인 이전 방식 자가점검(${LEGACY_STATUS_LABEL[status] ?? status})이 초기화돼요`,
      });
    }

    const stale = await this.prisma.rebaselineRequest.count({
      where: { cycleId: dto.cycleId, status: 'submitted' },
    });
    if (stale > 0) {
      warnings.push({ userId: '-', name: '-', reason: `검토 대기 재조정 요청 ${stale}건` });
    }

    // 실제로 손댈 대상 수 — 미리보기와 실행이 같은 계획을 쓰므로 두 값이 어긋나지 않는다.
    const willOpen = targets.filter((t) => plan.get(t.userId) !== 'skip').length;
    const skipped = targets.length - willOpen;

    // 미리보기는 부작용이 없어야 하므로 여기서 끝낸다(알림도 없음).
    // created 는 "이번 개시로 실제로 만들어지거나 초기화될 건수" — 0 을 돌려주면 HR 이
    // 재개시가 무엇을 바꾸는지(또는 바꾸지 않는지) 미리 알 방법이 없다.
    if (dto.dryRun) {
      return {
        data: { targets, warnings, created: willOpen, skipped },
        notify: [] as NotifyIntent[],
      };
    }

    let created = 0;
    // 실제로 생성·초기화된 대상만 모은다 — 건너뛴(이미 개시된) 리뷰까지 targets 전체 기준으로
    // 알리면, 재개시할 때마다 손대지도 않은 건의 1차 평가자에게 안내 메일이 다시 나간다.
    const openedTargets: typeof targets = [];
    for (const t of targets) {
      // 이미 신규 흐름으로 개시된 행은 건드리지 않는다 — updatedAt(경과일 기준)·평가자
      // 스냅샷·알림을 그대로 지킨다. 평가자 재계산이 필요하면 그건 reassign() 의 일이다
      // (reassign 만이 'reassigned' 이력을 남겨 "누가 언제 바꿨는지"를 증거로 남긴다).
      if (plan.get(t.userId) === 'skip') continue;
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
          // 전이 시각도 함께 비운다. 남겨 두면 재개시된 행이 이전 회차(또는 레거시 초안)의
          // 시각을 그대로 들고 있어 진행 현황의 경과일이 몇 주씩 부풀려지고, HR 이 재촉
          // 순서를 그 경과일로 정하기 때문에 실제로 급한 건이 뒤로 밀린다.
          firstCommentedAt: null,
          memberSubmittedAt: null,
          decidedAt: null,
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
      after: { created, skipped, targetCount: targets.length },
    });

    // 한 사람이 여러 명의 1차 평가자일 수 있으므로 수신자를 중복 제거한다.
    const notify: NotifyIntent[] = Array.from(
      new Set(openedTargets.map((t) => t.firstReviewerId)),
    ).map((userId) => ({
      userId,
      type: 'midterm_opened',
      payload: { cycleId: dto.cycleId, message: '중간평가를 시작해 주세요.' },
    }));
    return { data: { targets, warnings, created, skipped }, notify };
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
    // 이력('commented')에 함께 스냅샷할 KPI별 판정. 제목은 소유 검증 조회에서 함께 얻어
    // 인사이동·KPI 수정 후에도 "그때 무슨 검토를 했는지"가 이력에 그대로 남게 한다.
    const kpiReviews: MidtermKpiReview[] = [];
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
        select: { id: true, title: true },
      });
      if (owned.length !== kpiIds.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '해당 구성원의 이번 주기 KPI에만 코멘트할 수 있어요.',
        });
      }
      const titleById = new Map(owned.map((k) => [k.id, k.title]));
      for (const c of kpiComments) {
        kpiReviews.push({
          kpiId: c.kpiId,
          kpiTitle: titleById.get(c.kpiId) ?? '',
          decision: c.decision ?? null,
          note: c.note?.trim() ? c.note.trim() : null,
        });
      }
    }

    const now = new Date();
    // 앞뒤 공백만 있는 입력은 null 로, 나머지는 trim 된 값으로 저장한다(원본 그대로
    // 저장하면 앞뒤 공백이 그대로 영속화된다). 리뷰 본문과 이력 comment 가 같은 값을
    // 보도록 한 곳에서 계산한다 — 예전엔 이력만 원본을 저장해 두 곳이 달랐다.
    const trimmedOverall = dto.overallComment?.trim() ? dto.overallComment.trim() : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.midtermReview.update({
        where: { id },
        data: {
          status: MidtermReviewStatus.commented,
          firstComment: trimmedOverall,
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
        comment: trimmedOverall,
        // 총평(comment)과 별개로 KPI별 판정(수락/조정필요·코멘트)을 스냅샷해,
        // 나중에 "무슨 검토를 했는지"가 이력에 상세히 남게 한다. 없으면 빈 배열 → JSON null.
        kpiReviews: kpiReviews.length ? kpiReviews : undefined,
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
      data: await this.detail(id, current.id),
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

  /**
   * 임직원 수정안 임시저장(설계 §6 `PUT /midterm/reviews/:id/revision`) — **제출이 아니다**.
   *
   * 상태 전이·KPI 반영·이력·알림을 하나도 하지 않는다. 아직 아무에게도 보내지 않은
   * 개인 작업본이라 상대에게 알릴 것도, 이력에 남길 사건도 없기 때문이다
   * (여기서 이력을 남기면 저장 버튼을 누른 횟수만큼 타임라인이 오염된다).
   *
   * 권한은 피평가자 본인만 — 1차·2차 검토자는 물론 HR 대리도 막는다. 다른 전이와 달리
   * 이건 남을 대신해 줄 수 있는 성질의 작업이 아니고, 대신 써 두면 본인이 화면을 열었을 때
   * 자기가 쓰지 않은 값이 복원돼 그대로 제출될 수 있다.
   */
  async saveRevisionDraft(current: AuthUser, id: string, dto: SaveMidtermRevisionDraftDto) {
    const review = await this.prisma.midtermReview.findUnique({ where: { id } });
    if (!review) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '중간점검을 찾을 수 없어요.' });
    }
    // 소유자 확인이 먼저다 — 주기 단계 검사를 앞에 두면, 남의 리뷰 id 를 찍어 본 사람이
    // "단계 오류"와 FORBIDDEN 의 차이로 그 주기가 어느 단계인지 알아낼 수 있다.
    if (review.evaluateeId !== current.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인의 중간점검 수정안만 임시저장할 수 있어요.',
      });
    }
    // 제출과 같은 주기 창을 지킨다 — 창이 닫힌 뒤에도 저장이 되면, 사용자는 저장된 줄 알고
    // 있다가 제출 단계에서야 막힌다.
    await assertMidReviewStage(
      this.prisma,
      review.cycleId,
      '중간평가(mid_review) 단계에서만 처리할 수 있어요.',
    );
    if (!MIDTERM_REVISABLE_STATUSES.includes(review.status)) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message:
          '지금 단계에서는 수정안을 임시저장할 수 없어요. 화면을 새로고침해 현재 상태를 확인해 주세요.',
      });
    }

    const items = dto.items ?? [];
    await this.assertDraftItemsOwned(review.cycleId, review.evaluateeId, items);

    const draft: MidtermRevisionDraft = {
      items,
      memberNote: dto.memberNote?.trim() ?? '',
      savedAt: new Date().toISOString(),
    };
    // 단일 컬럼 갱신 — status·revisionRound 등 흐름 필드는 절대 건드리지 않는다.
    await this.prisma.midtermReview.update({
      where: { id },
      data: { revisionDraft: draft as unknown as Prisma.InputJsonValue },
    });
    return { data: await this.detail(id, current.id) };
  }

  /**
   * 임시저장본의 KPI가 본인·이번 주기 것인지만 확인한다.
   * 확정(confirmed) 여부·가중치 100% 는 보지 않는다 — 그건 제출 시점의 규칙이고,
   * 작성 도중에 막으면 정작 저장하려던 작업을 잃는다.
   */
  private async assertDraftItemsOwned(
    cycleId: string,
    evaluateeId: string,
    items: { kpiId: string }[],
  ): Promise<void> {
    if (!items.length) return;
    const kpiIds = items.map((i) => i.kpiId);
    if (new Set(kpiIds).size !== kpiIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '같은 KPI가 중복으로 포함됐어요.',
      });
    }
    const owned = await this.prisma.kpi.findMany({
      where: { id: { in: kpiIds }, userId: evaluateeId, cycleId },
      select: { id: true },
    });
    if (owned.length !== kpiIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '수정 대상 KPI가 해당 구성원·주기에 속하지 않아요.',
      });
    }
  }

  /** 임직원 수정 제출 → revised. 변경 0건이면 memberNote 필수. */
  async submitRevision(current: AuthUser, id: string, dto: SubmitMidtermRevisionDto) {
    const { review, onBehalfOf } = await this.loadAndAuthorize(current, id, 'revise');
    assertTransition(MIDTERM_REVIEW_TRANSITIONS, review.status, MidtermReviewStatus.revised);

    const items = dto.items ?? [];
    const note = dto.memberNote?.trim() ?? '';
    // 빠른 실패 경로. 진짜 게이트는 아래 트랜잭션 안(실제 변경 건수 기준)에 있다 —
    // items 를 보내기만 하면 통과하던 예전 방식은 "현재 값과 동일한 items"로 우회됐다.
    if (!items.length && !note) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: MidtermReviewFlowService.ZERO_CHANGE_MESSAGE,
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
      // 실제 변경 0건(= 보낸 items 의 값이 현재 값과 모두 같음)인데 회신 사유도 없으면,
      // 이 제출은 이력에 아무 근거도 남기지 못한 채 다음 단계로 넘어간다. 판정 기준은
      // "items 를 보냈는지"가 아니라 "무엇이든 바뀌었는지"여야 한다. 트랜잭션 안에서
      // 던져야 apply 가 이미 만든 스냅샷까지 함께 롤백된다.
      if (!result.changes.length && !note) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: MidtermReviewFlowService.ZERO_CHANGE_MESSAGE,
        });
      }
      await tx.midtermReview.update({
        where: { id },
        data: {
          status: MidtermReviewStatus.revised,
          memberNote: note || null,
          memberSubmittedAt: new Date(),
          revisionRound: round,
          // 제출된 순간 임시저장본은 수명이 끝난다. 남겨 두면 다음에 화면을 열 때
          // 이미 제출·반영된 값 위로 옛 초안이 되살아나 그대로 재제출될 수 있다.
          revisionDraft: Prisma.JsonNull,
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
      data: await this.detail(id, current.id),
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
        // 리뷰의 finalComment 와 같은 trim 된 값을 남긴다(원본을 그대로 넣으면 두 곳이 달라진다).
        onBehalfOf,
        comment: trimmedComment ?? null,
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
    // 판정한 사람 자신은 제외한다 — 체인이 압축돼(그룹대표 단독) 1차·2차가 같은 사람이면
    // 방금 자기가 누른 결과를 "중간점검이 마무리됐어요" 메일로 되받는다. 중복 수신자도
    // 함께 걸러 같은 사람에게 두 통이 가지 않게 한다.
    const recipients = Array.from(
      new Set(
        (approved
          ? [review.evaluateeId, review.firstReviewerId]
          : [review.evaluateeId]
        ).filter((uid): uid is string => !!uid && uid !== current.id),
      ),
    );
    return {
      data: await this.detail(id, current.id),
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
        data: {
          status: MidtermReviewStatus.revised,
          decidedAt: null,
          // 제출 시각도 비운다 — revised 의 경과일은 memberSubmittedAt 기준인데, 몇 주 전에
          // 제출·승인된 건을 오늘 되돌리면 2차 검토자가 "몇 주째 대기"로 보인다. 비워 두면
          // updatedAt(= 되돌린 시각) 으로 떨어져 "되돌린 뒤 경과"를 세게 된다.
          // 원래 제출 시각은 이력(trail)의 'revised' 항목에 남아 있어 정보가 사라지지 않는다.
          memberSubmittedAt: null,
        },
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
    return { data: await this.detail(id, current.id), notify: [] as NotifyIntent[] };
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

  /**
   * 열람 권한 판정 — 본인·1차·2차·HR 만. detailForViewer·trailForViewer 가 공유하는
   * 유일한 권한 규칙(한 곳만 고치면 되게) — 가벼운 select 만 조회해 무거운 detail() 쿼리
   * (kpiCheckIns·evaluatee join)를 타지 않고도 /trail 같은 곳에서 재사용할 수 있다.
   */
  private async assertViewerAllowed(current: AuthUser, id: string): Promise<void> {
    const review = await this.prisma.midtermReview.findUnique({
      where: { id },
      select: { evaluateeId: true, firstReviewerId: true, finalReviewerId: true },
    });
    if (!review) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '중간점검을 찾을 수 없어요.' });
    }
    const allowed =
      current.role === Role.hr_admin ||
      [review.evaluateeId, review.firstReviewerId, review.finalReviewerId].includes(current.id);
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    }
  }

  /**
   * 상세 열람 — 본인·1차·2차·HR 만.
   * detail() 자체는 전이 메서드들이 응답을 만들 때 쓰는 내부용이라 권한을 보지 않는다.
   * 외부(컨트롤러) 진입점은 반드시 이 래퍼를 거쳐야 1차 코멘트가 체인 밖으로 새지 않는다.
   */
  async detailForViewer(current: AuthUser, id: string) {
    await this.assertViewerAllowed(current, id);
    return this.detail(id, current.id);
  }

  /**
   * 이력 타임라인만 열람 — 상세와 동일한 권한(assertViewerAllowed)이지만, detail() 이 함께
   * 실어 오는 kpiCheckIns·evaluatee join 은 타지 않는다. /midterm/reviews/:id/trail 전용 진입점.
   */
  async trailForViewer(current: AuthUser, id: string) {
    await this.assertViewerAllowed(current, id);
    return this.trail.list(id);
  }

  /**
   * 상세 조회 — 리뷰 + KPI 코멘트 + 이력.
   *
   * viewerId 가 피평가자 본인일 때만 임시저장본(revisionDraft)을 실어 준다. 초안은 아직
   * 제출하지 않은 개인 작업본이라, 1차·2차 검토자나 HR 이 볼 것은 제출된 결과와 이력뿐이다.
   * viewerId 를 생략하면(내부 호출) 안전한 쪽인 "가리기"로 동작한다.
   */
  async detail(id: string, viewerId?: string) {
    const review = await this.prisma.midtermReview.findUniqueOrThrow({
      where: { id },
      include: { kpiCheckIns: true, evaluatee: { select: { id: true, name: true } } },
    });
    return {
      ...review,
      revisionDraft: viewerId && viewerId === review.evaluateeId ? review.revisionDraft : null,
      trail: await this.trail.list(id),
    };
  }
}
