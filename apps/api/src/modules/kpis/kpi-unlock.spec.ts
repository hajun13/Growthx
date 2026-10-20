import { describe, it, expect } from 'vitest';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CycleStatus, KpiStatus, Role } from '@prisma/client';
import { KpiUnlockService, UNLOCK_REASON_PREFIX } from './kpi-unlock.service';

type Row = { id: string; userId: string; cycleId: string; status: KpiStatus; cycleStatus?: CycleStatus };

/** unlock() 가 쓰는 쿼리(kpi.findMany·$transaction→updateMany)만 흉내내는 스텁. */
function setup(rows: Row[], opts: { raceCount?: number } = {}) {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const notified: Array<{ userId: string; type: string }> = [];
  const prisma = {
    kpi: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        rows
          .filter((r) => where.id.in.includes(r.id))
          .map((r) => ({
            ...r,
            approvalStage: 3,
            approvalTrail: [{ stage: 3 }],
            cycle: { status: r.cycleStatus ?? CycleStatus.active },
          })),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        kpi: {
          updateMany: async (args: { where: { id: { in: string[] } }; data: Record<string, unknown> }) => {
            updates.push(args);
            return { count: opts.raceCount ?? args.where.id.in.length };
          },
        },
      }),
  };
  const audit = { record: async (p: Record<string, unknown>) => void audits.push(p) };
  const notifications = {
    notifyUser: async (userId: string, type: string) => void notified.push({ userId, type }),
    linkedMessage: (s: string) => s,
  };
  const service = new KpiUnlockService(prisma as never, audit as never, notifications as never, {} as never);
  return { service, updates, audits, notified };
}

const hr = { id: 'hr-1', role: Role.hr_admin } as never;
const confirmed = (id: string, userId: string): Row => ({ id, userId, cycleId: 'c1', status: KpiStatus.confirmed });

describe('KpiUnlockService.unlock', () => {
  it('확정 KPI 를 draft 로 되돌리고 결재 단계·이력을 리셋, 사유는 프리픽스로 기록', async () => {
    const { service, updates, audits, notified } = setup([
      confirmed('k1', 'u1'),
      confirmed('k2', 'u1'),
      confirmed('k3', 'u2'),
    ]);
    const res = await service.unlock(hr, { kpiIds: ['k1', 'k2', 'k3', 'k1'], reason: '  목표 재설정  ' });
    expect(res).toEqual({ data: { unlocked: 3, userCount: 2 } });
    expect(updates).toHaveLength(1);
    expect(updates[0].data).toMatchObject({
      status: KpiStatus.draft,
      approvalStage: 0,
      rejectReason: `${UNLOCK_REASON_PREFIX} 목표 재설정`,
    });
    expect(audits.map((a) => a.action)).toEqual(['kpi.unlock', 'kpi.unlock', 'kpi.unlock']);
    // 구성원별 1건 알림.
    expect(notified).toEqual([
      { userId: 'u1', type: 'kpi_unlocked' },
      { userId: 'u2', type: 'kpi_unlocked' },
    ]);
  });

  it('공백뿐인 사유는 400', async () => {
    const { service } = setup([confirmed('k1', 'u1')]);
    await expect(service.unlock(hr, { kpiIds: ['k1'], reason: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('확정이 아닌 KPI 가 섞이면 409 — 아무것도 바꾸지 않음', async () => {
    const { service, updates } = setup([
      confirmed('k1', 'u1'),
      { id: 'k2', userId: 'u1', cycleId: 'c1', status: KpiStatus.approved },
    ]);
    await expect(service.unlock(hr, { kpiIds: ['k1', 'k2'], reason: '사유' })).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toHaveLength(0);
  });

  it('마감(closed) 주기 KPI 는 409', async () => {
    const { service, updates } = setup([{ ...confirmed('k1', 'u1'), cycleStatus: CycleStatus.closed }]);
    await expect(service.unlock(hr, { kpiIds: ['k1'], reason: '사유' })).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toHaveLength(0);
  });

  it('조회 후 상태가 바뀐 건이 있으면(경합) 409 — 감사·알림 없음', async () => {
    const { service, audits, notified } = setup([confirmed('k1', 'u1'), confirmed('k2', 'u1')], { raceCount: 1 });
    await expect(service.unlock(hr, { kpiIds: ['k1', 'k2'], reason: '사유' })).rejects.toBeInstanceOf(ConflictException);
    expect(audits).toHaveLength(0);
    expect(notified).toHaveLength(0);
  });
});
