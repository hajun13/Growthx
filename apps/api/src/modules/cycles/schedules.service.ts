import { Injectable, NotFoundException } from '@nestjs/common';
import { CycleSchedule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { UpsertSchedulesDto } from './dto/schedule.dto';

/** 주기 단계별 일정·대상자·알림 트리거 설정 (B-2). */
@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(cycleId: string) {
    const rows = await this.prisma.cycleSchedule.findMany({
      where: { cycleId },
      orderBy: { dueDate: 'asc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** phase 기준 upsert(일괄 저장). */
  async upsert(cycleId: string, dto: UpsertSchedulesDto, actor?: AuthUser) {
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException({ code: 'NOT_FOUND', message: '주기를 찾을 수 없어요.' });

    const results: CycleSchedule[] = [];
    for (const s of dto.schedules) {
      const row = await this.prisma.cycleSchedule.upsert({
        where: { cycleId_phase: { cycleId, phase: s.phase } },
        create: {
          cycleId,
          phase: s.phase,
          dueDate: new Date(s.dueDate),
          notifyOffsets: (s.notifyOffsets ?? [7, 3, 1]) as Prisma.InputJsonValue,
          notifyEnabled: s.notifyEnabled ?? true,
          targetUserIds: (s.targetUserIds ?? []) as Prisma.InputJsonValue,
          targetDeptIds: (s.targetDeptIds ?? []) as Prisma.InputJsonValue,
        },
        update: {
          dueDate: new Date(s.dueDate),
          notifyOffsets: (s.notifyOffsets ?? [7, 3, 1]) as Prisma.InputJsonValue,
          notifyEnabled: s.notifyEnabled ?? true,
          targetUserIds: (s.targetUserIds ?? []) as Prisma.InputJsonValue,
          targetDeptIds: (s.targetDeptIds ?? []) as Prisma.InputJsonValue,
        },
      });
      results.push(row);
    }

    await this.audit.record({
      entity: 'EvaluationCycle',
      entityId: cycleId,
      action: 'cycle.schedule.update',
      actorId: actor?.id,
      after: results,
    });

    return { data: results, meta: { page: 1, pageSize: results.length, total: results.length } };
  }
}
