import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CycleStatus, Kpi, KpiStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { assertTransition, KPI_TRANSITIONS } from '../../common/state/transitions';
import { NotificationsService } from '../notifications/notifications.service';
import { CycleLockService } from '../cycles/cycle-lock.service';
import { UnlockKpisDto } from './dto/kpi.dto';

/** 확정 해제 사유 프리픽스 — KPI 작성·검토 화면이 반려/수정요청과 구분해 표시한다. */
export const UNLOCK_REASON_PREFIX = '[확정해제]';

/**
 * KPI 확정 해제(hr_admin 전용, 2026-10-20).
 * 전 단계 결재가 끝난(confirmed) KPI 를 draft 로 되돌려 구성원이 수정·재제출할 수 있게 한다.
 * 재제출하면 결재선 1차부터 다시 결재한다(결재 이력 리셋 — 이력은 AuditLog 에 보존).
 * 마감(closed) 주기는 결과가 동결돼 해제할 수 없다.
 */
@Injectable()
export class KpiUnlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly cycleLock: CycleLockService,
  ) {}

  /** 주기의 확정 KPI 를 구성원별로 묶어 반환(부서명→이름 순). */
  async listCandidates(cycleId: string) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { id: true, status: true },
    });
    if (!cycle) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 주기를 찾을 수 없어요.' });

    const rows = await this.prisma.kpi.findMany({
      where: { cycleId, status: KpiStatus.confirmed },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, position: true, isActive: true, department: { select: { name: true } } },
        },
        _count: { select: { kpiScores: true, midtermCheckIns: true } },
      },
    });
    const codes = [...new Set(rows.map((k) => k.user.position))];
    const posDefs = await this.prisma.positionDef.findMany({
      where: { code: { in: codes } },
      select: { code: true, label: true },
    });
    const posLabel = new Map(posDefs.map((p) => [p.code, p.label]));

    const byUser = new Map<string, {
      userId: string;
      name: string;
      positionLabel: string | null;
      departmentName: string | null;
      isActive: boolean;
      kpis: Array<Record<string, unknown>>;
    }>();
    for (const k of rows) {
      let entry = byUser.get(k.userId);
      if (!entry) {
        entry = {
          userId: k.userId,
          name: k.user.name,
          positionLabel: posLabel.get(k.user.position) ?? (k.user.position || null),
          departmentName: k.user.department?.name ?? null,
          isActive: k.user.isActive,
          kpis: [],
        };
        byUser.set(k.userId, entry);
      }
      entry.kpis.push({
        id: k.id,
        title: k.title,
        category: k.category,
        group: k.group,
        weight: k.weight,
        confirmedAt: confirmedAtOf(k),
        scoreCount: k._count.kpiScores,
        checkInCount: k._count.midtermCheckIns,
      });
    }
    const users = [...byUser.values()].sort(
      (a, b) =>
        (a.departmentName ?? '').localeCompare(b.departmentName ?? '', 'ko') ||
        a.name.localeCompare(b.name, 'ko'),
    );
    return {
      data: {
        cycleId: cycle.id,
        cycleStatus: cycle.status,
        kpiLocked: await this.cycleLock.isKpiLocked(cycle.id),
        users,
      },
    };
  }

  /**
   * 확정 KPI 일괄 해제 → draft(결재 단계·이력 리셋, 사유는 rejectReason 에 프리픽스로 기록).
   * 전부 성공하거나 전부 실패(트랜잭션) — 중간에 다른 처리로 상태가 바뀐 건이 있으면 409.
   */
  async unlock(current: AuthUser, dto: UnlockKpisDto) {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '확정 해제 사유를 입력해 주세요.' });
    }
    const ids = [...new Set(dto.kpiIds)];
    const kpis = await this.prisma.kpi.findMany({
      where: { id: { in: ids } },
      include: { cycle: { select: { status: true } } },
    });
    if (kpis.length !== ids.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '일부 KPI를 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.' });
    }
    if (kpis.some((k) => k.cycle.status === CycleStatus.closed)) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: '마감된 평가 주기의 KPI는 확정을 해제할 수 없어요.',
      });
    }
    const notConfirmed = kpis.filter((k) => k.status !== KpiStatus.confirmed).length;
    if (notConfirmed > 0) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: `확정 상태가 아닌 KPI가 ${notConfirmed}건 포함됐어요. 새로고침 후 다시 시도해 주세요.`,
      });
    }
    for (const k of kpis) assertTransition(KPI_TRANSITIONS, k.status, KpiStatus.draft);

    await this.prisma.$transaction(async (tx) => {
      const res = await tx.kpi.updateMany({
        // status 조건을 다시 걸어 조회 후 다른 처리로 바뀐 건은 갱신하지 않는다(경합 시 전체 롤백).
        where: { id: { in: ids }, status: KpiStatus.confirmed },
        data: {
          status: KpiStatus.draft,
          rejectReason: `${UNLOCK_REASON_PREFIX} ${reason}`,
          approvalStage: 0,
          approvalTrail: Prisma.JsonNull,
        },
      });
      if (res.count !== ids.length) {
        throw new ConflictException({
          code: 'INVALID_STATE_TRANSITION',
          message: '처리 중 상태가 바뀐 KPI가 있어요. 새로고침 후 다시 시도해 주세요.',
        });
      }
    });

    for (const k of kpis) {
      await this.audit.record({
        entity: 'Kpi',
        entityId: k.id,
        action: 'kpi.unlock',
        actorId: current.id,
        before: { status: k.status, approvalStage: k.approvalStage, approvalTrail: k.approvalTrail },
        after: { status: KpiStatus.draft, reason },
      });
    }
    // 구성원별 1건 알림 — 메일 본문엔 사유를 싣지 않는다(KPI 화면에서 확인).
    const countByUser = new Map<string, number>();
    for (const k of kpis) countByUser.set(k.userId, (countByUser.get(k.userId) ?? 0) + 1);
    for (const [userId, n] of countByUser) {
      await this.notifications.notifyUser(userId, 'kpi_unlocked', {
        cycleId: kpis[0].cycleId,
        message: this.notifications.linkedMessage(
          `확정된 KPI ${n}건의 확정이 해제되었어요. 내용을 확인하고 수정한 뒤 다시 제출해 주세요.`,
          '/kpi',
        ),
      });
    }
    return { data: { unlocked: kpis.length, userCount: countByUser.size } };
  }
}

/** 최종 결재 시각 — 결재 이력 마지막 항목의 at, 없으면 updatedAt. */
function confirmedAtOf(k: Kpi): string {
  const trail = Array.isArray(k.approvalTrail) ? (k.approvalTrail as Array<{ at?: unknown }>) : [];
  const at = trail.at(-1)?.at;
  return typeof at === 'string' ? at : k.updatedAt.toISOString();
}
