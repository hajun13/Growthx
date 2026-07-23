import { describe, it, expect } from 'vitest';
import { KpiStatus } from '@prisma/client';
import { KpiRevisionService, SnapshotKpi } from './kpi-revision.service';

/** 최소 Prisma 스텁 — validate 가 쓰는 두 쿼리만 흉내낸다. */
function makePrisma(kpis: Array<Record<string, unknown>>) {
  return {
    kpi: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id) {
          const ids = (where.id as { in: string[] }).in;
          return kpis.filter((k) => ids.includes(k.id as string));
        }
        return kpis.filter((k) => k.status === KpiStatus.confirmed);
      },
    },
  } as never;
}

/**
 * apply() 가 쓰는 전체 쿼리(kpi.findMany where.id 없이 cycleId+userId 로 전체 조회,
 * $transaction, kpiSnapshot, kpi.update)까지 흉내내는 확장 스텁. Finding 1(스냅샷 payload
 * 필드 누락) 회귀 테스트용 — 만들어진 KpiSnapshot.data 를 캡처해 검사한다.
 */
function makeApplyPrisma(kpis: Array<Record<string, unknown>>) {
  let capturedSnapshotData: unknown = null;
  const prisma = {
    kpi: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id) {
          const ids = (where.id as { in: string[] }).in;
          return kpis.filter((k) => ids.includes(k.id as string));
        }
        // apply() 의 beforeKpis 조회 — 상태 필터 없이 cycleId+userId 전체.
        return kpis.filter(
          (k) => k.cycleId === where.cycleId && k.userId === where.userId,
        );
      },
      update: async () => undefined,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        kpiSnapshot: {
          findFirst: async () => null,
          create: async ({ data }: { data: { data: unknown } }) => {
            capturedSnapshotData = data.data;
            return { id: 'snap-1' };
          },
        },
        kpi: { update: async () => undefined },
      };
      return fn(tx);
    },
  };
  return { prisma: prisma as never, getSnapshotData: () => capturedSnapshotData as SnapshotKpi[] };
}

const scoring = {
  loadRuleSetForCycle: async () => ({ weightPolicy: {} }),
  validateWeights: (rows: Array<{ weight: number }>) => {
    const sum = rows.reduce((a, r) => a + r.weight, 0);
    if (Math.round(sum) !== 100) throw new Error(`가중치 합계가 100%가 아니에요 (현재 ${sum}%)`);
  },
} as never;

const audit = { record: async () => undefined } as never;

const KPI_A = {
  id: 'kpi-a',
  userId: 'u1',
  cycleId: 'c1',
  status: KpiStatus.confirmed,
  weight: 60,
  isQualitative: true,
  group: 'performance',
  targetValue: null,
  targetText: '기존 목표',
  title: 'KPI A',
};
const KPI_B = { ...KPI_A, id: 'kpi-b', weight: 40, title: 'KPI B' };

describe('KpiRevisionService.validate', () => {
  const svc = () => new KpiRevisionService(makePrisma([KPI_A, KPI_B]), scoring, audit);

  it('빈 items 는 통과한다 (변경 0건 제출 허용)', async () => {
    await expect(svc().validate('c1', 'u1', [])).resolves.toBeUndefined();
  });

  it('확정되지 않은 KPI 는 거부한다', async () => {
    const draft = { ...KPI_A, id: 'kpi-draft', status: KpiStatus.draft };
    const s = new KpiRevisionService(makePrisma([draft]), scoring, audit);
    await expect(s.validate('c1', 'u1', [{ kpiId: 'kpi-draft', targetText: 'x' }])).rejects.toThrow(
      /확정/,
    );
  });

  it('다른 사람의 KPI 는 거부한다', async () => {
    await expect(
      svc().validate('c1', 'other-user', [{ kpiId: 'kpi-a', targetText: 'x' }]),
    ).rejects.toThrow(/속하지 않아요/);
  });

  it('같은 KPI 중복은 거부한다', async () => {
    await expect(
      svc().validate('c1', 'u1', [
        { kpiId: 'kpi-a', targetText: 'x' },
        { kpiId: 'kpi-a', weight: 50 },
      ]),
    ).rejects.toThrow(/중복/);
  });

  it('가중치 합계가 100이 아니면 거부한다', async () => {
    await expect(svc().validate('c1', 'u1', [{ kpiId: 'kpi-a', weight: 50 }])).rejects.toThrow(
      /가중치/,
    );
  });

  it('가중치 합계가 100이면 통과한다', async () => {
    await expect(
      svc().validate('c1', 'u1', [
        { kpiId: 'kpi-a', weight: 50 },
        { kpiId: 'kpi-b', weight: 50 },
      ]),
    ).resolves.toBeUndefined();
  });

  it('정량 KPI 의 음수 목표값은 거부한다', async () => {
    const quant = { ...KPI_A, id: 'kpi-q', isQualitative: false };
    const s = new KpiRevisionService(makePrisma([quant]), scoring, audit);
    await expect(s.validate('c1', 'u1', [{ kpiId: 'kpi-q', targetValue: -1 }])).rejects.toThrow(
      /0 이상/,
    );
  });
});

describe('KpiRevisionService.apply — 스냅샷 payload (Finding 1 회귀 테스트)', () => {
  const KPI_A_FULL = {
    ...KPI_A,
    category: '매출액',
    measureType: 'amount_rate',
    createdAt: new Date('2026-01-01'),
  };
  // status=draft — 예전 currentKpis 는 상태 필터가 없었다. 이 KPI 가 스냅샷에 포함돼야
  // "confirmed 로 좁혀졌던" 리그레션이 재발하지 않았음을 보증한다.
  const KPI_DRAFT = {
    ...KPI_A_FULL,
    id: 'kpi-draft',
    status: KpiStatus.draft,
    title: 'KPI Draft',
    category: '협업성과',
    measureType: 'count',
    weight: 10,
    createdAt: new Date('2026-01-02'),
  };

  it('KpiSnapshot.data 에 10필드가 전 상태(confirmed 아닌 것 포함) 그대로 담긴다', async () => {
    const { prisma, getSnapshotData } = makeApplyPrisma([KPI_A_FULL, KPI_DRAFT]);
    const svc = new KpiRevisionService(prisma, scoring, audit);

    await svc.apply({
      actorId: 'actor-1',
      cycleId: 'c1',
      evaluateeId: 'u1',
      items: [{ kpiId: 'kpi-a', targetText: '새 목표' }],
      snapshotLabel: '테스트 스냅샷',
      auditAction: 'kpi.rebaseline',
      auditContext: {},
    });

    const snapshot = getSnapshotData();
    expect(snapshot).toHaveLength(2); // draft 도 포함(상태 필터 없음).

    const a = snapshot.find((k) => k.id === 'kpi-a');
    expect(a).toEqual({
      id: 'kpi-a',
      title: 'KPI A',
      category: '매출액',
      group: 'performance',
      measureType: 'amount_rate',
      targetValue: null,
      targetText: '기존 목표',
      weight: 60,
      isQualitative: true,
      status: KpiStatus.confirmed,
    });

    const draft = snapshot.find((k) => k.id === 'kpi-draft');
    expect(draft?.status).toBe(KpiStatus.draft);
    expect(draft?.category).toBe('협업성과');
    expect(draft?.measureType).toBe('count');
  });
});

describe('KpiRevisionService.apply — tx 분기 (Finding 1 회귀 테스트)', () => {
  /**
   * tx 를 넘기면 prisma.$transaction 을 아예 열지 않고 그 tx 로 바로 써야 한다
   * (중첩 $transaction 이 아니라 분기). $transaction 스텁 자체를 "호출되면 실패"로
   * 만들어, 실수로 다시 열리면 테스트가 즉시 드러낸다.
   */
  function makeTxAwarePrisma(kpis: Array<Record<string, unknown>>) {
    const outerUpdateCalls: string[] = [];
    const externalTxUpdateCalls: string[] = [];
    let externalSnapshotCreated = false;

    const prisma = {
      kpi: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) {
            const ids = (where.id as { in: string[] }).in;
            return kpis.filter((k) => ids.includes(k.id as string));
          }
          return kpis.filter((k) => k.cycleId === where.cycleId && k.userId === where.userId);
        },
        update: async ({ where }: { where: { id: string } }) => {
          outerUpdateCalls.push(where.id); // this.prisma.$transaction 경로로 쓰였다면 여기로 온다.
        },
      },
      $transaction: () => {
        throw new Error('tx 가 주어졌는데 this.prisma.$transaction 을 열면 안 돼요');
      },
    };

    const externalTx = {
      kpiSnapshot: {
        findFirst: async () => null,
        create: async () => {
          externalSnapshotCreated = true;
          return { id: 'snap-external' };
        },
      },
      kpi: {
        update: async ({ where }: { where: { id: string } }) => {
          externalTxUpdateCalls.push(where.id); // 호출자가 넘긴 tx 로 쓰였다면 여기로 온다.
        },
      },
    };

    return {
      prisma: prisma as never,
      externalTx: externalTx as never,
      outerUpdateCalls,
      externalTxUpdateCalls,
      wasExternalSnapshotCreated: () => externalSnapshotCreated,
    };
  }

  it('tx 를 넘기면 스냅샷·kpi.update 가 그 tx 로 가고 prisma.$transaction 은 열리지 않는다', async () => {
    const kpi = { ...KPI_A, category: '매출액', measureType: 'amount_rate', createdAt: new Date() };
    const { prisma, externalTx, outerUpdateCalls, externalTxUpdateCalls, wasExternalSnapshotCreated } =
      makeTxAwarePrisma([kpi]);
    const svc = new KpiRevisionService(prisma, scoring, audit);

    const result = await svc.apply({
      actorId: 'actor-1',
      cycleId: 'c1',
      evaluateeId: 'u1',
      items: [{ kpiId: 'kpi-a', targetText: '새 목표(tx)' }],
      snapshotLabel: '중간점검 수정 전 (1회차)',
      auditAction: 'kpi.midterm_revision',
      auditContext: {},
      tx: externalTx,
    });

    expect(result.snapshotId).toBe('snap-external');
    expect(result.changes).toHaveLength(1);
    expect(wasExternalSnapshotCreated()).toBe(true);
    expect(externalTxUpdateCalls).toEqual(['kpi-a']);
    expect(outerUpdateCalls).toEqual([]); // this.prisma 쪽 update 는 한 번도 안 불림.
  });
});
