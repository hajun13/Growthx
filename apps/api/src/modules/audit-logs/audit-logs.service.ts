import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAuditLogsQuery } from './dto/audit-log.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 필터 + 페이지네이션 조회. actor 이름을 비정규화해 동봉. */
  async list(query: ListAuditLogsQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.userId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.at = {};
      if (query.from) (where.at as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.at as Prisma.DateTimeFilter).lte = new Date(query.to);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      action: r.action,
      before: r.before,
      after: r.after,
      actorId: r.userId,
      actorName: r.user?.name ?? null,
      actorEmail: r.user?.email ?? null,
      ip: r.ip,
      at: r.at,
    }));

    return { data, meta: { page, pageSize, total } };
  }
}
