import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  CreateNotificationDto,
  GenerateNotificationsDto,
  ListNotificationsQuery,
} from './dto/notification.dto';

/**
 * 알림 (C-2): 인앱 + 이메일.
 * 트리거: 일정 D-7/D-3/D-1, KPI 반려, 결과 확정, 이의제기 답변.
 * 인앱은 DB Notification 저장(읽음/안읽음). 이메일은 MailService(미설정 시 콘솔 폴백).
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** 본인 알림 목록. */
  async list(current: AuthUser, query: ListNotificationsQuery) {
    const where: Prisma.NotificationWhereInput = { userId: current.id };
    if (query.unreadOnly === 'true') where.readAt = null;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 본인 미읽음 카운트(뱃지). */
  async unreadCount(current: AuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: current.id, readAt: null },
    });
    return { data: { count } };
  }

  /** 단건 생성(HR/시스템) + 이메일 발송. */
  async create(dto: CreateNotificationDto) {
    return this.notifyUser(dto.userId, dto.type, dto.payload ?? null);
  }

  /**
   * 재사용 가능한 알림 발송 헬퍼.
   * 인앱 Notification 저장 + 사용자 이메일로 발송(폴백 안전).
   * 다른 모듈(evaluations·kpis·appeals)에서 트리거로 호출.
   */
  async notifyUser(userId: string, type: string, payload: Record<string, unknown> | null) {
    const notif = await this.prisma.notification.create({
      data: {
        userId,
        type,
        payload: (payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
    // 이메일 채널(베스트 에포트).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      const message =
        (payload && typeof payload.message === 'string' && payload.message) ||
        this.subjectForType(type);
      await this.mail.send(user.email, `[에너지엑스 인사 평가] ${this.subjectForType(type)}`, message);
    }
    return notif;
  }

  /** cycle 대상자 일괄 D-7/D-1/D-3 알림 생성. */
  async generate(dto: GenerateNotificationsDto) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
    });
    if (!cycle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 주기를 찾을 수 없어요.' });
    }
    const users = await this.prisma.user.findMany({ select: { id: true, email: true } });
    const type = `deadline_${dto.kind}`;
    for (const u of users) {
      await this.notifyUser(u.id, type, { cycleId: dto.cycleId, message: dto.message });
    }
    return { data: { count: users.length, type, emailMode: this.mail.enabled ? 'smtp' : 'console' } };
  }

  /** 읽음 처리(본인). */
  async markRead(current: AuthUser, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== current.id) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '알림을 찾을 수 없어요.' });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /** 모두 읽음 처리(본인). */
  async markAllRead(current: AuthUser) {
    const res = await this.prisma.notification.updateMany({
      where: { userId: current.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { updated: res.count } };
  }

  private subjectForType(type: string): string {
    const map: Record<string, string> = {
      deadline_d7: '평가 마감 D-7 안내',
      deadline_d3: '평가 마감 D-3 독촉',
      deadline_d1: '평가 마감 D-1 안내',
      kpi_rejected: 'KPI가 반려되었어요',
      result_finalized: '평가 결과가 확정되었어요',
      appeal_answered: '이의제기 답변이 등록되었어요',
      appeal_decided: '이의제기 최종 결정이 내려졌어요',
    };
    return map[type] ?? '새로운 알림';
  }
}
