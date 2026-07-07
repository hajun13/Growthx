import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Appeal, AppealDecisionType, AppealStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompensationsService } from '../compensations/compensations.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import { assertTransition, APPEAL_TRANSITIONS } from '../../common/state/transitions';
import { AppealDecisionCascade } from './appeal-decision';
import {
  CreateAppealDto,
  DecideAppealDto,
  ListAppealsQuery,
  RespondAppealDto,
} from './dto/appeal.dto';

/** 이의제기: 결과 통보 후 7일 이내 신청·1차 팀장 답변·HR 최종 결정 (business-rules §8). */
const APPEAL_WINDOW_DAYS = 7;

@Injectable()
export class AppealsService {
  private readonly cascade: AppealDecisionCascade;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly scoring: ScoringService,
    private readonly compensations: CompensationsService,
  ) {
    this.cascade = new AppealDecisionCascade(
      this.prisma,
      this.audit,
      this.scoring,
      this.compensations,
    );
  }

  async list(current: AuthUser, query: ListAppealsQuery) {
    const where: Prisma.AppealWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (current.role === Role.employee) where.userId = current.id;

    const rows = await this.prisma.appeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { department: true } } },
    });
    // 처리 담당자(부서장 답변·HR 결정) 이름 배치 조회 — 화면 담당자·스테퍼 표기용.
    const actorIds = Array.from(
      new Set(
        rows.flatMap((a) => [a.respondedById, a.decidedById]).filter((v): v is string => !!v),
      ),
    );
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const actorName = new Map(actors.map((u) => [u.id, u.name]));
    // 행 수준 필터(팀장·본부장은 가시 범위)
    const enrich = (a: (typeof rows)[number]) => ({
      id: a.id,
      resultId: a.resultId,
      userId: a.userId,
      reason: a.reason,
      status: a.status,
      response: a.response,
      respondedById: a.respondedById,
      decision: a.decision,
      decidedById: a.decidedById,
      // 3B-3: 구조화된 결정 + 자동수정 값.
      decisionType: a.decisionType,
      newScore: a.newScore,
      newGrade: a.newGrade,
      // 진행단계 타임스탬프(접수=createdAt·검토시작·부서장답변·HR결정).
      reviewStartedAt: a.reviewStartedAt,
      respondedAt: a.respondedAt,
      decidedAt: a.decidedAt,
      userName: a.user?.name ?? null,
      departmentName: a.user?.department?.name ?? null,
      // 시안(image 13) 표기용 비정규화 — 조직 필터·직급·프로필 사진·담당자 실명.
      departmentId: a.user?.departmentId ?? null,
      position: a.user?.position ?? null,
      avatarUrl: a.user?.avatarUrl ?? null,
      respondedByName: a.respondedById ? actorName.get(a.respondedById) ?? null : null,
      decidedByName: a.decidedById ? actorName.get(a.decidedById) ?? null : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    });
    if (current.role === Role.hr_admin || current.role === Role.employee) {
      const data = rows.map(enrich);
      return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
    }
    const visible: typeof rows = [];
    for (const a of rows) {
      if (await canViewUser(this.prisma, current, a.userId)) visible.push(a);
    }
    const data = visible.map(enrich);
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** 이의제기 신청 (본인). 결과 통보 후 7일 이내. */
  async create(current: AuthUser, dto: CreateAppealDto) {
    const result = await this.prisma.evaluationResult.findUnique({
      where: { id: dto.resultId },
    });
    if (!result) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 결과를 찾을 수 없어요.' });
    }
    if (result.userId !== current.id) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '본인 결과만 이의제기할 수 있어요.' });
    }
    // 7일 이내 검증 (결과 생성 시점 기준)
    const deadline = new Date(result.createdAt);
    deadline.setDate(deadline.getDate() + APPEAL_WINDOW_DAYS);
    if (new Date() > deadline) {
      throw new UnprocessableEntityException({
        code: 'APPEAL_WINDOW_CLOSED',
        message: `이의제기는 결과 통보 후 ${APPEAL_WINDOW_DAYS}일 이내에만 가능해요.`,
      });
    }
    // 중복 방지: 같은 결과에 아직 열린(closed 아닌) 이의제기가 있으면 재신청 차단(검토 큐 스팸 방지).
    // closed(기각/종결) 후에는 7일 창 안이라면 재신청 허용.
    const open = await this.prisma.appeal.findFirst({
      where: { resultId: dto.resultId, status: { not: AppealStatus.closed } },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException({
        code: 'APPEAL_ALREADY_OPEN',
        message: '이미 진행 중인 이의제기가 있어요. 처리 완료 후 다시 신청할 수 있어요.',
      });
    }

    return this.prisma.appeal.create({
      data: {
        resultId: dto.resultId,
        userId: current.id,
        reason: dto.reason,
        status: AppealStatus.submitted,
      },
    });
  }

  /** 팀장 1차 답변 (submitted/under_review → answered). */
  async respond(current: AuthUser, id: string, dto: RespondAppealDto) {
    const appeal = await this.findOrThrow(id);
    await this.assertResponder(current, appeal);
    // submitted → under_review → answered: under_review 를 거치도록 보정
    if (appeal.status === AppealStatus.submitted) {
      assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.under_review);
      assertTransition(APPEAL_TRANSITIONS, AppealStatus.under_review, AppealStatus.answered);
    } else {
      assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.answered);
    }
    const now = new Date();
    const updated = await this.prisma.appeal.update({
      where: { id },
      data: {
        status: AppealStatus.answered,
        response: dto.response,
        respondedById: current.id,
        // 진행단계: 검토 시작(최초 1회) + 부서장 답변 시각.
        reviewStartedAt: appeal.reviewStartedAt ?? now,
        respondedAt: now,
      },
    });
    await this.notifications.notifyUser(appeal.userId, 'appeal_answered', {
      appealId: id,
      message: '이의제기 1차 답변이 등록되었어요.',
    });
    return updated;
  }

  /**
   * HR 최종 결정 (3B-3, 고위험). decisionType 5지 분기 캐스케이드.
   * - uphold/reject: 변경 없음 → closed.
   * - score_adjust/grade_adjust: 확정 결과·보상 사후 수정 → closed (감사 필수).
   * - reevaluate: 부서장 평가 재오픈 → appeal answered 유지.
   * 모든 유형에서 사유(reason) 필수, appeal.decide 감사 기록.
   */
  async decide(current: AuthUser, id: string, dto: DecideAppealDto) {
    const appeal = await this.findOrThrow(id);
    const decidedAt = new Date();

    // 전이 가드를 어떤 mutation 보다 먼저(전 유형). closed 는 종단(transitions.ts) — 재오픈 불가.
    const closesAppeal =
      dto.decisionType !== AppealDecisionType.reevaluate;
    if (closesAppeal) {
      assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.closed);
    } else if (appeal.status === AppealStatus.submitted) {
      // reevaluate: appeal 은 answered 로 전이 — respond() 와 동일하게 under_review 경유 보정.
      assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.under_review);
      assertTransition(APPEAL_TRANSITIONS, AppealStatus.under_review, AppealStatus.answered);
    } else if (appeal.status !== AppealStatus.answered) {
      // answered 는 answered 유지(재평가 반복 결정 허용). 그 외(closed 등)는 전이 맵 검사 → 409.
      assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.answered);
    }

    // 캐스케이드: adjust/reevaluate 는 tx 안에서 결과/평가 + appeal 을 원자 갱신(appealPersisted=true).
    // uphold/reject 는 appealPersisted=false → 아래에서 appeal 갱신.
    const { nextStatus, poolOverride, appealPersisted } = await this.cascade.apply(
      current,
      appeal,
      dto,
      decidedAt,
    );

    if (!appealPersisted) {
      await this.prisma.appeal.update({
        where: { id },
        data: {
          status: nextStatus,
          decision: dto.reason,
          decisionType: dto.decisionType,
          newScore: dto.newScore ?? null,
          newGrade: dto.newGrade ?? null,
          decidedById: current.id,
          decidedAt,
        },
      });
    }

    await this.audit.record({
      entity: 'Appeal',
      entityId: id,
      action: 'appeal.decide',
      actorId: current.id,
      before: { status: appeal.status },
      after: {
        status: nextStatus,
        decisionType: dto.decisionType,
        reason: dto.reason,
        newScore: dto.newScore ?? null,
        newGrade: dto.newGrade ?? null,
        poolOverride,
      },
    });
    await this.notifications.notifyUser(appeal.userId, 'appeal_decided', {
      appealId: id,
      message:
        nextStatus === AppealStatus.answered
          ? '이의제기 재평가가 시작되었어요.'
          : '이의제기 최종 결정이 내려졌어요.',
    });

    // 캐스케이드가 tx 안에서 갱신했을 수 있으므로 최신 상태를 재조회해 반환.
    return this.prisma.appeal.findUnique({ where: { id } });
  }

  // ── helpers ──
  private async findOrThrow(id: string): Promise<Appeal> {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } });
    if (!appeal) throw new NotFoundException({ code: 'NOT_FOUND', message: '이의제기를 찾을 수 없어요.' });
    return appeal;
  }

  private async assertResponder(current: AuthUser, appeal: Appeal): Promise<void> {
    if (current.role === Role.hr_admin) return;
    if (
      (current.role === Role.team_lead || current.role === Role.division_head) &&
      (await canViewUser(this.prisma, current, appeal.userId))
    ) {
      return;
    }
    throw new ForbiddenException({ code: 'FORBIDDEN', message: '답변 권한이 없어요.' });
  }
}
