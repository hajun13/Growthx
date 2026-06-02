import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Appeal, AppealStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import { assertTransition, APPEAL_TRANSITIONS } from '../../common/state/transitions';
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
  constructor(private readonly prisma: PrismaService) {}

  async list(current: AuthUser, query: ListAppealsQuery) {
    const where: Prisma.AppealWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (current.role === Role.employee) where.userId = current.id;

    const rows = await this.prisma.appeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    // 행 수준 필터(팀장·본부장은 가시 범위)
    if (current.role === Role.hr_admin || current.role === Role.employee) {
      return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
    }
    const visible: Appeal[] = [];
    for (const a of rows) {
      if (await canViewUser(this.prisma, current, a.userId)) visible.push(a);
    }
    return { data: visible, meta: { page: 1, pageSize: visible.length, total: visible.length } };
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
    return this.prisma.appeal.update({
      where: { id },
      data: {
        status: AppealStatus.answered,
        response: dto.response,
        respondedById: current.id,
      },
    });
  }

  /** HR 최종 결정 (answered → closed). 조정 시 사유 필수(decision). */
  async decide(current: AuthUser, id: string, dto: DecideAppealDto) {
    const appeal = await this.findOrThrow(id);
    assertTransition(APPEAL_TRANSITIONS, appeal.status, AppealStatus.closed);
    return this.prisma.appeal.update({
      where: { id },
      data: {
        status: AppealStatus.closed,
        decision: dto.decision,
        decidedById: current.id,
      },
    });
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
