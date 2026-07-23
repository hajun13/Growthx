import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { AuthUser } from '../../common/decorators/current-user';

/**
 * 진행 현황(설계 §7.5)의 경과일이 "언제부터 멈춰 있는지"를 실제로 가리키게 하는 회귀 테스트.
 *
 * 경과일은 전이 시각 컬럼에서 나오는데, 재개시(open 의 update 브랜치)와 되돌림(reopen)이
 * 예전 회차의 시각을 그대로 남겨 두면 몇 주 전 값이 살아남아 경과일이 부풀려진다.
 * HR 은 이 경과일 순서로 재촉 대상을 정하므로, 부풀려진 값은 곧 잘못된 재촉 순서가 된다.
 */

const HR: AuthUser = {
  id: 'hr-1',
  email: 'hr@energyx.co.kr',
  role: Role.hr_admin,
  departmentId: null,
  scope: VisibilityScope.company,
  mustChangePassword: false,
};

describe('open() 재개시 — 전이 시각 초기화', () => {
  /** 레거시 pending 행 1건이 있는 주기를 개시하는 최소 목 세트. */
  function makeOpenService() {
    const upserts: { update: Record<string, unknown> }[] = [];
    const prisma = {
      evaluationCycle: { findUnique: async () => ({ status: 'mid_review' }) },
      user: {
        findMany: async () => [{ id: 'm1', name: '김구성' }],
        // resolveMidtermReviewers: 대상자 소속 + 그룹대표 활성 여부 확인.
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === 'm1' ? { departmentId: 'g1' } : { isActive: true },
      },
      kpi: { groupBy: async () => [{ userId: 'm1', _count: { _all: 3 } }] },
      department: {
        // 본부장 목록(대상 제외용) — 없음.
        findMany: async () => [],
        findUnique: async () => ({
          id: 'g1',
          type: 'group',
          parentId: null,
          headUserId: 'grp-1',
          deputyHeadUserId: null,
        }),
      },
      midtermReview: {
        // 이미 존재하는 레거시 pending 행 → upsert 의 update 브랜치를 탄다.
        findMany: async () => [{ evaluateeId: 'm1', status: 'pending' }],
        upsert: async (args: { update: Record<string, unknown> }) => {
          upserts.push({ update: args.update });
          return {};
        },
      },
      rebaselineRequest: { count: async () => 0 },
    } as never;
    const audit = { record: async () => undefined } as never;
    return {
      svc: new MidtermReviewFlowService(prisma, {} as never, {} as never, audit),
      upserts,
    };
  }

  it('재개시는 firstCommentedAt·memberSubmittedAt·decidedAt 을 함께 비운다', async () => {
    const { svc, upserts } = makeOpenService();
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(res.data.created).toBe(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].update).toMatchObject({
      status: 'pending',
      firstCommentedAt: null,
      memberSubmittedAt: null,
      decidedAt: null,
    });
  });
});

describe('reopen() 되돌림 — 제출 시각 초기화', () => {
  const CLOSED_REVIEW = {
    id: 'r1',
    cycleId: 'c1',
    evaluateeId: 'm1',
    status: 'closed',
    firstReviewerId: 'div-1',
    finalReviewerId: 'grp-1',
    revisionRound: 1,
  };

  function makeReopenService() {
    const updates: Record<string, unknown>[] = [];
    const prisma = {
      evaluationCycle: { findUnique: async () => ({ status: 'mid_review' }) },
      midtermReview: {
        findUnique: async () => CLOSED_REVIEW,
        findUniqueOrThrow: async () => ({
          ...CLOSED_REVIEW,
          kpiCheckIns: [],
          evaluatee: { id: 'm1', name: '김구성' },
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          midtermReview: {
            update: async ({ data }: { data: Record<string, unknown> }) => {
              updates.push(data);
              return CLOSED_REVIEW;
            },
          },
        }),
    } as never;
    const trail = { record: async () => undefined, list: async () => [] } as never;
    const audit = { record: async () => undefined } as never;
    return {
      svc: new MidtermReviewFlowService(prisma, {} as never, trail, audit),
      updates,
    };
  }

  it('되돌리면 memberSubmittedAt·decidedAt 이 비워져 경과일이 되돌린 시점부터 세진다', async () => {
    const { svc, updates } = makeReopenService();
    await svc.reopen(HR, 'r1');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: 'revised',
      decidedAt: null,
      memberSubmittedAt: null,
    });
  });
});
