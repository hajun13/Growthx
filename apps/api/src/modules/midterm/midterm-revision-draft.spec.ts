import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { AuthUser } from '../../common/decorators/current-user';

/**
 * 수정안 임시저장(PUT /midterm/reviews/:id/revision) 경계 테스트.
 *
 * 확인하려는 것은 두 가지다.
 *  1) 권한 — 초안은 피평가자 본인의 작업본이므로 1차·2차 검토자도, HR 대리도 쓸 수 없다.
 *  2) 부작용 없음 — 저장은 전이가 아니다. status·revisionRound 를 건드리지 않고,
 *     이력(trail)·감사(audit)·알림도 남기지 않아야 한다.
 */

const REVIEW = {
  id: 'r1',
  cycleId: 'c1',
  evaluateeId: 'member-1',
  status: 'commented',
  firstReviewerId: 'first-1',
  finalReviewerId: 'final-1',
  revisionRound: 0,
  revisionDraft: null as unknown,
};

interface Spy {
  updates: Record<string, unknown>[];
  trailCalls: number;
  auditCalls: number;
}

function makeService(overrides: Partial<typeof REVIEW> = {}, ownedKpiIds: string[] = ['k1']) {
  const review = { ...REVIEW, ...overrides };
  const spy: Spy = { updates: [], trailCalls: 0, auditCalls: 0 };
  const prisma = {
    midtermReview: {
      findUnique: async () => review,
      findUniqueOrThrow: async () => ({
        ...review,
        kpiCheckIns: [],
        evaluatee: { id: review.evaluateeId, name: '홍길동' },
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        spy.updates.push(data);
        return review;
      },
    },
    // 임시저장은 KPI 소유만 확인하고 KPI 행은 쓰지 않는다(update 자체를 두지 않았다 —
    // 호출하면 TypeError 로 즉시 드러난다).
    kpi: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.filter((id) => ownedKpiIds.includes(id)).map((id) => ({ id })),
    },
    evaluationCycle: { findUnique: async () => ({ status: 'mid_review' }) },
  } as never;
  const revision = {
    // 임시저장 경로에서는 절대 호출되면 안 된다.
    validate: async () => {
      throw new Error('임시저장은 KPI 수정안을 적용하지 않아야 한다');
    },
    apply: async () => {
      throw new Error('임시저장은 KPI 를 반영하지 않아야 한다');
    },
  } as never;
  const trail = {
    record: async () => {
      spy.trailCalls += 1;
    },
    list: async () => [],
  } as never;
  const audit = {
    record: async () => {
      spy.auditCalls += 1;
    },
  } as never;
  return { svc: new MidtermReviewFlowService(prisma, revision, trail, audit), spy };
}

function makeUser(id: string, role: Role): AuthUser {
  return {
    id,
    email: `${id}@energyx.co.kr`,
    role,
    departmentId: null,
    scope: VisibilityScope.self,
    mustChangePassword: false,
  };
}

const MEMBER = makeUser('member-1', Role.employee);

describe('MidtermReviewFlowService.saveRevisionDraft — 권한 경계', () => {
  it('1차 평가자는 피평가자의 임시저장본을 쓸 수 없다', async () => {
    const { svc, spy } = makeService();
    await expect(
      svc.saveRevisionDraft(makeUser('first-1', Role.division_head), 'r1', {
        memberNote: '남의 초안',
      }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    expect(spy.updates).toHaveLength(0);
  });

  it('2차 검토자(그룹대표)도 쓸 수 없다', async () => {
    const { svc } = makeService();
    await expect(
      svc.saveRevisionDraft(makeUser('final-1', Role.division_head), 'r1', {
        memberNote: '남의 초안',
      }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('HR 담당자도 대리로 쓸 수 없다(다른 전이와 달리 대리 개념이 없다)', async () => {
    const { svc, spy } = makeService();
    await expect(
      svc.saveRevisionDraft(makeUser('hr-1', Role.hr_admin), 'r1', { memberNote: '대리 작성' }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    expect(spy.updates).toHaveLength(0);
  });

  it('없는 리뷰는 NOT_FOUND', async () => {
    const { svc } = makeService();
    const prismaless = svc as unknown as {
      prisma: { midtermReview: { findUnique: () => Promise<null> } };
    };
    prismaless.prisma.midtermReview.findUnique = async () => null;
    await expect(svc.saveRevisionDraft(MEMBER, 'r1', {})).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});

describe('MidtermReviewFlowService.saveRevisionDraft — 전이 아님', () => {
  it('본인이 저장하면 status·revisionRound 를 건드리지 않고 초안만 쓴다', async () => {
    const { svc, spy } = makeService();
    await svc.saveRevisionDraft(MEMBER, 'r1', {
      items: [{ kpiId: 'k1', weight: 40 }],
      memberNote: '  작성 중  ',
    });
    expect(spy.updates).toHaveLength(1);
    const data = spy.updates[0] as { revisionDraft: { items: unknown[]; memberNote: string } };
    expect(Object.keys(data)).toEqual(['revisionDraft']);
    expect(data.revisionDraft.items).toEqual([{ kpiId: 'k1', weight: 40 }]);
    expect(data.revisionDraft.memberNote).toBe('작성 중');
  });

  it('이력·감사 로그를 남기지 않는다(저장 버튼 횟수만큼 타임라인이 오염되면 안 된다)', async () => {
    const { svc, spy } = makeService();
    await svc.saveRevisionDraft(MEMBER, 'r1', { memberNote: '작성 중' });
    expect(spy.trailCalls).toBe(0);
    expect(spy.auditCalls).toBe(0);
  });

  it('본인 응답에는 임시저장본이 실려 돌아온다(복원용)', async () => {
    const { svc } = makeService({ revisionDraft: { items: [], memberNote: 'x', savedAt: 'z' } });
    const res = await svc.saveRevisionDraft(MEMBER, 'r1', { memberNote: '작성 중' });
    expect(res.data.revisionDraft).not.toBeNull();
  });

  it('수정 단계가 아니면(revised) INVALID_STATE_TRANSITION', async () => {
    const { svc, spy } = makeService({ status: 'revised' });
    await expect(svc.saveRevisionDraft(MEMBER, 'r1', { memberNote: 'x' })).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    expect(spy.updates).toHaveLength(0);
  });

  it('반려(returned) 상태에서는 저장할 수 있다', async () => {
    const { svc, spy } = makeService({ status: 'returned' });
    await svc.saveRevisionDraft(MEMBER, 'r1', { memberNote: '다시 작성 중' });
    expect(spy.updates).toHaveLength(1);
  });

  it('남의 KPI(또는 다른 주기 KPI)가 섞이면 VALIDATION_ERROR', async () => {
    const { svc, spy } = makeService({}, ['k1']);
    await expect(
      svc.saveRevisionDraft(MEMBER, 'r1', { items: [{ kpiId: 'k1' }, { kpiId: 'other' }] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(spy.updates).toHaveLength(0);
  });
});

describe('MidtermReviewFlowService.detail — 초안 가시성', () => {
  it('검토자에게는 임시저장본을 내보내지 않는다', async () => {
    const { svc } = makeService({ revisionDraft: { items: [], memberNote: '내 메모', savedAt: 'z' } });
    const asOther = await svc.detail('r1', 'first-1');
    expect(asOther.revisionDraft).toBeNull();
    const asMember = await svc.detail('r1', 'member-1');
    expect(asMember.revisionDraft).not.toBeNull();
  });
});
