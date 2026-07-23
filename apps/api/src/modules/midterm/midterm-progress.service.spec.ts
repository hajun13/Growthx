import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermProgressService } from './midterm-progress.service';
import { AuthUser } from '../../common/decorators/current-user';

/**
 * C1 회귀 테스트 — 진척 조회의 대상 판정.
 *
 * 중간점검은 부서장을 계정 role 이 아니라 Department.headUserId 명시 지정으로 판정한다(B-1).
 * 그래서 role='employee' 인 1차 평가자가 정상적으로 존재하고, 예전 코드처럼
 * `role === 'employee' ? current.id : ...` 로 대상을 갈아끼우면 그 사람이 구성원 점검 화면을
 * 열었을 때 200 과 함께 **본인 KPI** 가 조용히 내려왔다.
 *
 * 프리즈마·스코어링은 최소한의 가짜로 대체한다 — 이 테스트가 보는 것은 권한 분기와
 * 응답의 userId 뿐이고, 그 경로에서 실제로 호출되는 쿼리는 몇 개 되지 않는다.
 */

const VIEWER = 'reviewer-1';
const MEMBER = 'member-1';
const CYCLE = 'cycle-1';

function makeService(review: {
  firstReviewerId: string | null;
  finalReviewerId: string | null;
} | null) {
  const prisma = {
    midtermReview: {
      // isMidtermReviewerOf(권한 판정)와 selfCheckIn prefill 이 같은 유니크 키로 조회한다.
      findUnique: async () => (review ? { ...review, kpiCheckIns: [] } : null),
    },
    kpi: { findMany: async () => [] },
    // canViewUser(대상 조회) + orgProgress(소속 부서) 양쪽이 쓴다. departmentId=null 이면
    // orgProgress 는 즉시 null 을 반환해 조직 집계 쿼리로 내려가지 않는다.
    user: { findUnique: async () => ({ id: MEMBER, departmentId: null }) },
  } as never;
  const scoring = {
    loadRuleSetForCycle: async () => ({
      gradingScales: [],
      gradeScale: [],
      weightPolicy: {},
    }),
  } as never;
  return new MidtermProgressService(prisma, scoring);
}

/** 부서장이지만 계정 role 은 employee, 가시 범위도 본인뿐인 사용자. */
function employeeRoleUser(id: string): AuthUser {
  return {
    id,
    email: `${id}@energyx.co.kr`,
    role: Role.employee,
    departmentId: null,
    scope: VisibilityScope.self,
    mustChangePassword: false,
  };
}

describe('MidtermProgressService.progress — C1: 배정 기반 대상 판정', () => {
  it('role=employee 인 1차 평가자가 구성원을 조회하면 그 구성원의 데이터를 돌려준다', async () => {
    const svc = makeService({ firstReviewerId: VIEWER, finalReviewerId: 'group-head' });
    const res = await svc.progress(employeeRoleUser(VIEWER), {
      cycleId: CYCLE,
      userId: MEMBER,
    });
    // 핵심: 본인 id 로 바꿔치기되지 않는다.
    expect(res.data.userId).toBe(MEMBER);
  });

  it('2차(그룹대표) 평가자도 같은 경로로 허용된다', async () => {
    const svc = makeService({ firstReviewerId: 'division-head', finalReviewerId: VIEWER });
    const res = await svc.progress(employeeRoleUser(VIEWER), {
      cycleId: CYCLE,
      userId: MEMBER,
    });
    expect(res.data.userId).toBe(MEMBER);
  });

  it('배정도 없고 가시 범위도 아니면 조용한 본인 대체가 아니라 403 이다', async () => {
    const svc = makeService(null);
    await expect(
      svc.progress(employeeRoleUser(VIEWER), { cycleId: CYCLE, userId: MEMBER }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('체인에 있어도 다른 사람의 배정이면(1차·2차 모두 아님) 403 이다', async () => {
    const svc = makeService({ firstReviewerId: 'someone-else', finalReviewerId: 'group-head' });
    await expect(
      svc.progress(employeeRoleUser(VIEWER), { cycleId: CYCLE, userId: MEMBER }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('userId 를 생략하면 본인 데이터를 돌려준다(권한 검사 없음)', async () => {
    const svc = makeService(null);
    const res = await svc.progress(employeeRoleUser(VIEWER), { cycleId: CYCLE });
    expect(res.data.userId).toBe(VIEWER);
  });
});
