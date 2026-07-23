import { describe, it, expect, vi } from 'vitest';
import { Role, MidtermReviewStatus, CycleStatus, VisibilityScope } from '@prisma/client';
import { MidtermReviewsService } from './midterm-reviews.service';
import { AuthUser } from '../../common/decorators/current-user';

/**
 * Finding 1·2 회귀 테스트 — 두 항목 모두 무거운 시나리오 없이 프리즈마를 얕게
 * 흉내내는 것으로 충분하다(제출 게이트의 출처 판정, list() 의 where 조합 결과).
 */
function makePrisma() {
  return {
    midtermReview: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    evaluationCycle: {
      // 기본은 mid_review(최종 단계 아님) — 자가점검 제출 게이트를 통과시킨다.
      findUnique: vi.fn().mockResolvedValue({ status: CycleStatus.mid_review }),
    },
    kpi: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  };
}

function makeAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    email: 'u1@energyx.co.kr',
    role: Role.employee,
    departmentId: null,
    scope: VisibilityScope.self,
    mustChangePassword: false,
    ...overrides,
  };
}

describe('MidtermReviewsService — Finding 1: 레거시 제출 게이트는 출처(firstReviewerId)로 판정', () => {
  it('firstReviewerId 가 채워진 행(2단계 개시됨)은 상태가 pending 이어도 레거시 제출을 막는다', async () => {
    const prisma = makePrisma();
    prisma.midtermReview.findUnique.mockResolvedValue({
      status: MidtermReviewStatus.pending,
      firstReviewerId: 'head-1',
    });
    const svc = new MidtermReviewsService(prisma as never, makeAudit() as never);

    await expect(
      svc.submitSelf(makeUser(), { cycleId: 'c1', kpiCheckIns: [] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('firstReviewerId 가 null 인 레거시 행(2025 아카이브 등)은 그대로 통과한다', async () => {
    const prisma = makePrisma();
    prisma.midtermReview.findUnique.mockResolvedValue({
      status: MidtermReviewStatus.pending,
      firstReviewerId: null,
    });
    prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        midtermReview: {
          upsert: vi.fn().mockResolvedValue({ id: 'r1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'r1',
            status: MidtermReviewStatus.pending,
          }),
        },
        midtermKpiCheckIn: { upsert: vi.fn() },
      };
      return fn(tx);
    });
    const svc = new MidtermReviewsService(prisma as never, makeAudit() as never);

    await expect(
      svc.submitSelf(makeUser(), { cycleId: 'c1', kpiCheckIns: [] }),
    ).resolves.toBeDefined();
  });

  it('행이 아예 없는 경우(최초 제출)도 그대로 통과한다', async () => {
    const prisma = makePrisma();
    prisma.midtermReview.findUnique.mockResolvedValue(null);
    prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        midtermReview: {
          upsert: vi.fn().mockResolvedValue({ id: 'r1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'r1',
            status: MidtermReviewStatus.pending,
          }),
        },
        midtermKpiCheckIn: { upsert: vi.fn() },
      };
      return fn(tx);
    });
    const svc = new MidtermReviewsService(prisma as never, makeAudit() as never);

    await expect(
      svc.submitSelf(makeUser(), { cycleId: 'c1', kpiCheckIns: [] }),
    ).resolves.toBeDefined();
  });
});

describe('MidtermReviewsService — Finding 2: list() 는 role=employee 특례 없이 체인 스코프를 탄다', () => {
  it('role=employee 인 호출자(직책자일 수 있음)도 evaluateeId 하드 고정이 아니라 chainScope(AND)로 좁혀진다', async () => {
    const prisma = makePrisma();
    const svc = new MidtermReviewsService(prisma as never, makeAudit() as never);

    await svc.list(makeUser({ role: Role.employee, id: 'head-1' }), { cycleId: 'c1' } as never);

    expect(prisma.midtermReview.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.midtermReview.findMany.mock.calls[0][0].where;
    // 예전 버그: where.evaluateeId = 'head-1' 로 하드 고정 — 자신이 1차/최종로 배정된
    // 다른 사람의 리뷰가 결과에서 원천 배제됐다. 지금은 evaluateeId 하드 필터가 없어야 한다.
    expect(where.evaluateeId).toBeUndefined();
    expect(where.AND).toEqual([
      {
        OR: [
          { evaluateeId: 'head-1' },
          { firstReviewerId: 'head-1' },
          { finalReviewerId: 'head-1' },
          { reviewerId: 'head-1', firstReviewerId: null },
        ],
      },
    ]);
  });

  it('일반 직원(체인에 없음)은 결과적으로 본인 것만 보인다 — chainScope 의 evaluateeId 절이 동일 효과를 낸다', async () => {
    const prisma = makePrisma();
    prisma.midtermReview.findMany.mockResolvedValue([
      { id: 'r-self', evaluateeId: 'emp-1', kpiCheckIns: [] },
    ]);
    const svc = new MidtermReviewsService(prisma as never, makeAudit() as never);

    const result = await svc.list(makeUser({ role: Role.employee, id: 'emp-1' }), {
      cycleId: 'c1',
    } as never);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].evaluateeId).toBe('emp-1');
  });
});
