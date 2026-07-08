import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { resolveSsoUser } from './sso-binding';

const SUB = 'kc-sub-001';
const OTHER_SUB = 'kc-sub-999';

function makeUser(over: Partial<Record<string, unknown>> = {}) {
  return { id: 'u1', email: 'a@energyx.co.kr', isActive: true, azureAdSubject: null, ...over };
}

function makePrisma() {
  return {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    userEmailAlias: { findUnique: vi.fn() },
  };
}

describe('resolveSsoUser', () => {
  let prisma: ReturnType<typeof makePrisma>;
  beforeEach(() => {
    prisma = makePrisma();
  });

  it('sub 가 이미 바인딩돼 있으면 그대로 반환하고 재바인딩하지 않는다', async () => {
    const user = makeUser({ azureAdSubject: SUB });
    prisma.user.findUnique.mockResolvedValueOnce(user);

    const result = await resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr');

    expect(result).toBe(user);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('이메일이 일치하고 sub 가 비어 있으면 바인딩한다', async () => {
    const unbound = makeUser();
    const bound = makeUser({ azureAdSubject: SUB });
    prisma.user.findUnique.mockResolvedValueOnce(null); // by sub
    prisma.user.findFirst.mockResolvedValueOnce(unbound); // by email
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.user.findUnique.mockResolvedValueOnce(bound); // re-read

    const result = await resolveSsoUser(prisma as never, SUB, 'A@Energyx.co.kr');

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', azureAdSubject: null },
      data: { azureAdSubject: SUB },
    });
    expect(result.azureAdSubject).toBe(SUB);
  });

  it('이메일이 안 맞아도 별칭이 있으면 바인딩한다', async () => {
    const unbound = makeUser({ email: 'spark@energyx.ai' });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.userEmailAlias.findUnique.mockResolvedValueOnce({
      email: 'spark@energyx.co.kr',
      user: unbound,
    });
    prisma.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.user.findUnique.mockResolvedValueOnce(
      makeUser({ email: 'spark@energyx.ai', azureAdSubject: SUB }),
    );

    const result = await resolveSsoUser(prisma as never, SUB, 'spark@energyx.co.kr');

    expect(result.azureAdSubject).toBe(SUB);
  });

  it('다른 sub 가 이미 박혀 있으면 409 — 계정 탈취 방어', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(makeUser({ azureAdSubject: OTHER_SUB }));

    await expect(resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('동시 로그인 경합으로 updateMany 가 0행이면 409', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(makeUser());
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('사용자를 못 찾으면 403 SSO_USER_NOT_LINKED', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.userEmailAlias.findUnique.mockResolvedValueOnce(null);

    await expect(
      resolveSsoUser(prisma as never, SUB, 'ghost@energyx.co.kr'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('비활성 계정이면 401 — 퇴사자 즉시 차단', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ azureAdSubject: SUB, isActive: false }));

    await expect(resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
