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

    const result = await resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', true);

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

    const result = await resolveSsoUser(prisma as never, SUB, 'A@Energyx.co.kr', true);

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

    const result = await resolveSsoUser(prisma as never, SUB, 'spark@energyx.co.kr', true);

    expect(result.azureAdSubject).toBe(SUB);
  });

  it('미검증 이메일로는 바인딩하지 않는다 — TOFU 탈취 차단(401)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null); // by sub
    prisma.user.findFirst.mockResolvedValueOnce(makeUser()); // 미바인딩 사용자, 이메일 일치

    await expect(
      resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', false),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('미검증 이메일이어도 별칭 경로에서 바인딩하지 않는다(401)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.userEmailAlias.findUnique.mockResolvedValueOnce({
      email: 'spark@energyx.co.kr',
      user: makeUser({ email: 'spark@energyx.ai' }),
    });

    await expect(
      resolveSsoUser(prisma as never, SUB, 'spark@energyx.co.kr', false),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('이미 sub 로 바인딩된 사용자는 미검증 이메일이어도 로그인된다', async () => {
    const user = makeUser({ azureAdSubject: SUB });
    prisma.user.findUnique.mockResolvedValueOnce(user); // by sub

    const result = await resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', false);

    expect(result).toBe(user);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('다른 sub 가 이미 박혀 있으면 409 — 계정 탈취 방어', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(makeUser({ azureAdSubject: OTHER_SUB }));

    await expect(
      resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', true),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('동시 로그인 경합으로 updateMany 가 0행이면 409', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(makeUser());
    prisma.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', true),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('사용자를 못 찾으면 403 SSO_USER_NOT_LINKED', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.userEmailAlias.findUnique.mockResolvedValueOnce(null);

    await expect(
      resolveSsoUser(prisma as never, SUB, 'ghost@energyx.co.kr', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('비활성 계정이면 401 — 퇴사자 즉시 차단', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ azureAdSubject: SUB, isActive: false }));

    await expect(
      resolveSsoUser(prisma as never, SUB, 'a@energyx.co.kr', true),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
