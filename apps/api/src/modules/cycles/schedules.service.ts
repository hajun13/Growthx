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
          startDate: s.startDate ? new Date(s.startDate) : null,
          dueDate: new Date(s.dueDate),
          // notifyOffsets: 명시적 제공(빈 배열 포함) 시 그 값을, 미제공(undefined) 시에만 기본값.
          notifyOffsets: (s.notifyOffsets !== undefined
            ? s.notifyOffsets
            : [7, 3, 1]) as Prisma.InputJsonValue,
          notifyEnabled: s.notifyEnabled ?? true,
          targetUserIds: (s.targetUserIds ?? []) as Prisma.InputJsonValue,
          targetDeptIds: (s.targetDeptIds ?? []) as Prisma.InputJsonValue,
          isLocked: s.isLocked ?? false,
        },
        update: {
          startDate: s.startDate ? new Date(s.startDate) : null,
          dueDate: new Date(s.dueDate),
          // notifyOffsets: 명시적 빈 배열을 기본값이 덮어쓰지 않도록 undefined 일 때만 기본값 적용.
          notifyOffsets: (s.notifyOffsets !== undefined
            ? s.notifyOffsets
            : [7, 3, 1]) as Prisma.InputJsonValue,
          notifyEnabled: s.notifyEnabled ?? true,
          targetUserIds: (s.targetUserIds ?? []) as Prisma.InputJsonValue,
          targetDeptIds: (s.targetDeptIds ?? []) as Prisma.InputJsonValue,
          // M3 Item 5: isLocked 제공 시에만 갱신(미제공 시 기존 잠금 유지).
          ...(s.isLocked !== undefined ? { isLocked: s.isLocked } : {}),
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

  /** M3 Item 5: 특정 phase 잠금/열기 토글. */
  async setLock(
    cycleId: string,
    phase: string,
    isLocked: boolean,
    actor?: AuthUser,
  ) {
    const existing = await this.prisma.cycleSchedule.findUnique({
      where: { cycleId_phase: { cycleId, phase } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '해당 단계 일정을 찾을 수 없어요.',
      });
    }
    const row = await this.prisma.cycleSchedule.update({
      where: { cycleId_phase: { cycleId, phase } },
      data: { isLocked },
    });
    await this.audit.record({
      entity: 'CycleSchedule',
      entityId: row.id,
      action: isLocked ? 'cycle.schedule.lock' : 'cycle.schedule.unlock',
      actorId: actor?.id,
      before: { isLocked: existing.isLocked },
      after: { isLocked },
    });
    return { data: row };
  }

  /**
   * M3 Item 5: 현재 활성 phase + 잠금 상태.
   * dueDate 가 가장 가까운 미래(또는 오늘 이후) 단계를 '현재' 로 본다.
   * 모두 마감 지났으면 마지막(가장 늦은) 단계를 반환.
   */
  async currentPhase(cycleId: string) {
    const schedules = await this.prisma.cycleSchedule.findMany({
      where: { cycleId },
      orderBy: { dueDate: 'asc' },
    });
    if (schedules.length === 0) {
      return { data: { cycleId, phase: null, dueDate: null, isLocked: false, schedules: [] } };
    }
    const now = new Date();
    const upcoming = schedules.find((s) => s.dueDate >= now);
    const current = upcoming ?? schedules[schedules.length - 1];
    return {
      data: {
        cycleId,
        phase: current.phase,
        dueDate: current.dueDate,
        isLocked: current.isLocked,
        schedules: schedules.map((s) => ({
          phase: s.phase,
          dueDate: s.dueDate,
          isLocked: s.isLocked,
        })),
      },
    };
  }
}
