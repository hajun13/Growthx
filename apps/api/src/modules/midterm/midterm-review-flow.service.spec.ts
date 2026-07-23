import { describe, it, expect } from 'vitest';
import { Role, VisibilityScope } from '@prisma/client';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { AuthUser } from '../../common/decorators/current-user';

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
