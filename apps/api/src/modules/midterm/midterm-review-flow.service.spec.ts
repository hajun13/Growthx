import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { AuthUser } from '../../common/decorators/current-user';
import type { KpiFieldChange } from '../kpis/kpi-revision.service';

/**
 * Finding A 회귀 테스트 — open/reassign 는 프리즘을 건드리기도 전에 역할부터 거부해야
 * 한다. 그 순서 덕분에 여기서는 프리즈마·감사·이력 의존성을 흉내낼 필요 없이
 * 전부 `{} as never` 로 넘겨도 된다(호출되지 않으므로).
 */
function makeService() {
  return new MidtermReviewFlowService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function makeUser(role: Role): AuthUser {
  return {
    id: 'u1',
    email: 'u1@energyx.co.kr',
    role,
    departmentId: null,
    scope: VisibilityScope.self,
    mustChangePassword: false,
  };
}

describe('MidtermReviewFlowService — Finding A: open/reassign 권한 가드', () => {
  it('open 은 hr_admin 이 아니면 ForbiddenException 을 던진다', async () => {
    const svc = makeService();
    await expect(
      svc.open(makeUser(Role.team_lead), { cycleId: 'c1' }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('reassign 은 hr_admin 이 아니면 ForbiddenException 을 던진다', async () => {
    const svc = makeService();
    await expect(svc.reassign(makeUser(Role.division_head), 'c1')).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
  });
});

/**
 * 변경 0건 게이트 — 판정 기준은 "items 를 보냈는지"가 아니라 "실제로 무엇이 바뀌었는지".
 * 현재 값과 똑같은 items 를 보내면 changes 가 []가 되는데, 예전 게이트는 items 가
 * 비어 있지 않다는 이유만으로 통과시켜 회신 사유 없이 다음 단계로 넘어갔다.
 */
const REVIEW = {
  id: 'r1',
  cycleId: 'c1',
  evaluateeId: 'u1',
  status: 'commented',
  firstReviewerId: 'first-1',
  finalReviewerId: 'final-1',
  revisionRound: 0,
};

function makeFlowService(changes: KpiFieldChange[]) {
  const prisma = {
    midtermReview: {
      findUnique: async () => REVIEW,
      findUniqueOrThrow: async () => ({ ...REVIEW, kpiCheckIns: [], evaluatee: { id: 'u1', name: '홍길동' } }),
    },
    evaluationCycle: { findUnique: async () => ({ status: 'mid_review' }) },
    // 트랜잭션 콜백을 그대로 실행한다 — 게이트가 콜백 안에서 던지는지 확인해야 한다.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ midtermReview: { update: async () => undefined } }),
  } as never;
  const revision = {
    validate: async () => undefined,
    apply: async () => ({ snapshotId: null, changes }),
  } as never;
  const trail = { record: async () => undefined, list: async () => [] } as never;
  const audit = { record: async () => undefined } as never;
  return new MidtermReviewFlowService(prisma, revision, trail, audit);
}

const MEMBER: AuthUser = {
  id: 'u1',
  email: 'u1@energyx.co.kr',
  role: Role.employee,
  departmentId: null,
  scope: VisibilityScope.self,
  mustChangePassword: false,
};

const ONE_CHANGE: KpiFieldChange[] = [
  { kpiId: 'k1', kpiTitle: '매출', field: 'weight', before: 30, after: 40 },
];

describe('MidtermReviewFlowService.submitRevision — 변경 0건 게이트', () => {
  it('items 를 보냈어도 실제 변경이 0건이고 회신 사유가 없으면 거절한다', async () => {
    const svc = makeFlowService([]);
    await expect(
      svc.submitRevision(MEMBER, 'r1', { items: [{ kpiId: 'k1', weight: 30 }] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('items 도 회신 사유도 없으면 거절한다(빠른 경로)', async () => {
    const svc = makeFlowService([]);
    await expect(svc.submitRevision(MEMBER, 'r1', {})).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });
  });

  it('변경 0건이어도 회신 사유가 있으면 제출된다', async () => {
    const svc = makeFlowService([]);
    const res = await svc.submitRevision(MEMBER, 'r1', {
      items: [{ kpiId: 'k1', weight: 30 }],
      memberNote: '코멘트를 확인했고 조정할 필요가 없다고 판단했어요.',
    });
    expect(res.notify).toHaveLength(1);
  });

  it('실제 변경이 있으면 회신 사유가 없어도 제출된다', async () => {
    const svc = makeFlowService(ONE_CHANGE);
    const res = await svc.submitRevision(MEMBER, 'r1', {
      items: [{ kpiId: 'k1', weight: 40 }],
    });
    expect(res.notify).toHaveLength(1);
  });
});
