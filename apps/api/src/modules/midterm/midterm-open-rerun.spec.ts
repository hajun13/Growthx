import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { AuthUser } from '../../common/decorators/current-user';

/**
 * 재개시(open 두 번째 실행) 회귀 테스트 — 이 흐름의 증상은 전부 "두 번째 실행이 첫 번째와
 * 다르게 동작한다"였다.
 *
 * HR 은 진행 현황의 "아직 개시되지 않은 건" 안내를 보고 개시를 다시 실행하게 되어 있다.
 * 그때 이미 개시돼 1차 코멘트를 기다리던 pending 행까지 초기화되면
 *  ①경과일(pending 은 updatedAt 기준)이 전부 "오늘"로 리셋되고
 *  ②그 1차 평가자에게 안내 메일이 다시 나가고
 *  ③평가자가 'reassigned' 이력 없이 덮어써지고
 *  ④created 가 부풀려져 "87건 생성"으로 보고된다.
 * 판정 기준은 상태값이 아니라 **평가자 스냅샷의 유무(출처)** 여야 한다.
 */

const HR: AuthUser = {
  id: 'hr-1',
  email: 'hr@energyx.co.kr',
  role: Role.hr_admin,
  departmentId: null,
  scope: VisibilityScope.company,
  mustChangePassword: false,
};

/** 개시 대상 1명(m1)에 대한 최소 목 세트. existing 을 바꿔 가며 재개시를 재현한다. */
function makeOpenService(existing: Record<string, unknown>[]) {
  const upserts: { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }[] =
    [];
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
      findMany: async () => existing,
      upsert: async (args: {
        where: unknown;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        upserts.push(args);
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

describe('open() 재개시 — 이미 개시된 행은 건드리지 않는다', () => {
  it('평가자 스냅샷이 있는 pending 행은 upsert·created·알림 어디에도 들어가지 않는다', async () => {
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'pending', firstReviewerId: 'lead-1', finalReviewerId: 'grp-1' },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    // 아무것도 쓰지 않는다 → updatedAt 이 그대로라 경과일이 리셋되지 않는다.
    expect(upserts).toHaveLength(0);
    expect(res.data.created).toBe(0);
    expect(res.data.skipped).toBe(1);
    // 손대지 않은 건의 1차 평가자에게 안내 메일이 다시 나가면 안 된다.
    expect(res.notify).toHaveLength(0);
    // 초기화 경고도 없다(초기화하지 않으므로).
    expect(res.data.warnings.filter((w) => w.reason.includes('초기화'))).toHaveLength(0);
  });

  it('진행 중인(commented) 행도 그대로 둔다', async () => {
    const { svc, upserts } = makeOpenService([
      {
        evaluateeId: 'm1',
        status: 'commented',
        firstReviewerId: 'lead-1',
        finalReviewerId: 'grp-1',
      },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(upserts).toHaveLength(0);
    expect(res.data.created).toBe(0);
    expect(res.notify).toHaveLength(0);
  });

  it('평가자 스냅샷이 없더라도 신규 흐름 상태(revised)면 초기화하지 않는다', async () => {
    // HR 대리 전이 등으로 평가자 없이 진행된 이례적 행 — 상태 자체가 신규 흐름의 증거다.
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'revised', firstReviewerId: null, finalReviewerId: null },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(upserts).toHaveLength(0);
    expect(res.data.created).toBe(0);
  });
});

describe('open() — 진짜 레거시·신규 대상은 그대로 개시한다', () => {
  it('레거시 자가점검 행(self_done, 평가자 없음)은 초기화하고 알림을 보낸다', async () => {
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'self_done', firstReviewerId: null, finalReviewerId: null },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].update).toMatchObject({
      status: 'pending',
      firstReviewerId: 'grp-1',
      finalReviewerId: 'grp-1',
      revisionRound: 0,
      firstCommentedAt: null,
    });
    expect(res.data.created).toBe(1);
    expect(res.data.skipped).toBe(0);
    expect(res.notify).toHaveLength(1);
    // 진행 중이던 자가점검이 사라진다는 사실은 미리보기 경고에 이름과 함께 드러나야 한다.
    expect(res.data.warnings.some((w) => w.name === '김구성' && w.reason.includes('초기화'))).toBe(
      true,
    );
  });

  it('평가자 없는 pending(레거시 총평-단독 저장) 행은 초기화 경고 없이 개시된다', async () => {
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'pending', firstReviewerId: null, finalReviewerId: null },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(upserts).toHaveLength(1);
    expect(res.data.created).toBe(1);
    expect(res.notify).toHaveLength(1);
    // 되돌릴 진행분이 없고, 이 행의 경과일은 createdAt 기준이라 부풀려지지도 않는다.
    expect(res.data.warnings.filter((w) => w.reason.includes('초기화'))).toHaveLength(0);
  });

  it('리뷰 행이 없는 신규 대상은 생성한다', async () => {
    const { svc, upserts } = makeOpenService([]);
    const res = await svc.open(HR, { cycleId: 'c1' });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].create).toMatchObject({ evaluateeId: 'm1', status: 'pending' });
    expect(res.data.created).toBe(1);
    expect(res.notify).toHaveLength(1);
  });
});

describe('open(dryRun) — 미리보기는 실제로 바뀔 것만 보여 준다', () => {
  it('이미 개시된 건만 있으면 created=0·skipped=1 로 "바뀌는 것이 없음"을 알린다', async () => {
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'pending', firstReviewerId: 'lead-1', finalReviewerId: 'grp-1' },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1', dryRun: true });
    expect(upserts).toHaveLength(0);
    expect(res.data.created).toBe(0);
    expect(res.data.skipped).toBe(1);
    expect(res.notify).toHaveLength(0);
  });

  it('초기화될 레거시 행은 미리보기의 created 와 경고 양쪽에 나타난다', async () => {
    const { svc, upserts } = makeOpenService([
      { evaluateeId: 'm1', status: 'confirmed', firstReviewerId: null, finalReviewerId: null },
    ]);
    const res = await svc.open(HR, { cycleId: 'c1', dryRun: true });
    // 미리보기는 부작용이 없어야 한다.
    expect(upserts).toHaveLength(0);
    expect(res.data.created).toBe(1);
    expect(res.data.skipped).toBe(0);
    expect(res.data.warnings.some((w) => w.reason.includes('부서장 확인 완료'))).toBe(true);
  });
});
