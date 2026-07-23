import { describe, it, expect } from 'vitest';
import { KpiStatus } from '@prisma/client';
import { KpiRevisionService } from './kpi-revision.service';

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
