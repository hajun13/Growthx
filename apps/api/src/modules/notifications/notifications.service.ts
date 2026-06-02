import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  CreateNotificationDto,
  GenerateNotificationsDto,
  ListNotificationsQuery,
} from './dto/notification.dto';

/**
 * 알림: KPI 입력 마감·중간평가·최종평가 D-7/D-1 + 코멘트 미작성 D-3 독촉 (business-rules §7).
 * 본인 알림 조회·읽음 처리. HR/시스템이 생성.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** 단건 생성(HR/시스템). */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        payload: (dto.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  /** cycle 대상자 일괄 D-7/D-1/D-3 알림 생성. */
  async generate(dto: GenerateNotificationsDto) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
    });
    if (!cycle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 주기를 찾을 수 없어요.' });
    }
    // 전 사용자 대상 (실제 운영에서는 cycle 대상자로 좁힐 수 있음)
    const users = await this.prisma.user.findMany({ select: { id: true } });
    const type = `deadline_${dto.kind}`;
    const data = users.map((u) => ({
      userId: u.id,
      type,
      payload: { cycleId: dto.cycleId, message: dto.message } as Prisma.InputJsonValue,
    }));
    const created = await this.prisma.notification.createMany({ data });
    return { data: { count: created.count, type } };
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
}
