import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 감사 로그 기록 (C-4).
 * 민감 변경(등급 변경/오버라이드·평가 제출·KPI 승인/반려·풀 조정·RuleSet 변경·
 * 설정 변경·이의제기 결정)을 서비스 단에서 명시적으로 기록한다.
 * 기록 실패가 본 트랜잭션을 깨지 않도록 안전하게 감싼다.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    entity: string;
    entityId: string;
    action: string;
    actorId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entity: params.entity,
          entityId: params.entityId,
          action: params.action,
          userId: params.actorId ?? null,
          ip: params.ip ?? null,
          before: (params.before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          after: (params.after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    } catch (err) {
      // 감사 로그 실패는 비즈니스 트랜잭션을 막지 않는다(로그만 남김).
      this.logger.warn(
        `audit record failed (${params.entity}/${params.action}): ${(err as Error).message}`,
      );
    }
  }
}
