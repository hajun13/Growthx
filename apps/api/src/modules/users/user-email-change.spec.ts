import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { planEmailChange, preserveEmailAlias } from './user-email-change';

const ME = 'user-1';

function makePrisma() {
  return {
    user: { findFirst: vi.fn() },
    userEmailAlias: { findFirst: vi.fn() },
  };
}

function makeTx() {
  return {
    userEmailAlias: { findUnique: vi.fn(), upsert: vi.fn() },
  };
}

describe('planEmailChange', () => {
  it('주소가 바뀌면 새 주소를 소문자로 정규화하고 옛 주소를 함께 돌려준다', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.userEmailAlias.findFirst.mockResolvedValue(null);

    const change = await planEmailChange(
      prisma as never,
      ME,
      'kjlee@energyx.co.kr',
      '  KJLee@MRPlan.co.kr  ',
    );

    expect(change).toEqual({
      email: 'kjlee@mrplan.co.kr',
      previousEmail: 'kjlee@energyx.co.kr',
    });
  });

  it('같은 주소면 변경 없음(null)으로 본다', async () => {
    const prisma = makePrisma();

    const change = await planEmailChange(
      prisma as never,
      ME,
      'kjlee@energyx.co.kr',
      'kjlee@energyx.co.kr',
    );

    expect(change).toBeNull();
    // 변경이 없으면 중복 조회조차 하지 않는다.
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.userEmailAlias.findFirst).not.toHaveBeenCalled();
  });

  it('대소문자만 다른 주소도 변경 없음으로 본다', async () => {
    const prisma = makePrisma();

    const change = await planEmailChange(
      prisma as never,
      ME,
      'kjlee@energyx.co.kr',
      'KJLEE@ENERGYX.CO.KR',
    );

    expect(change).toBeNull();
  });

  it('다른 사용자가 쓰는 주소면 409로 막는다', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'someone-else' });

    await expect(
      planEmailChange(prisma as never, ME, 'kjlee@energyx.co.kr', 'kky@mrplan.co.kr'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('사용자 조회는 대소문자 무시 비교로 한다 — 레거시 혼합 대소문자 행 탐지', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.userEmailAlias.findFirst.mockResolvedValue(null);

    await planEmailChange(prisma as never, ME, 'kjlee@energyx.co.kr', 'kky@mrplan.co.kr');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'kky@mrplan.co.kr', mode: 'insensitive' } },
    });
  });

  it('다른 사용자의 SSO 별칭으로 남아 있는 주소면 409로 막는다', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.userEmailAlias.findFirst.mockResolvedValue({
      email: 'kky@mrplan.co.kr',
      userId: 'someone-else',
    });

    await expect(
      planEmailChange(prisma as never, ME, 'kjlee@energyx.co.kr', 'kky@mrplan.co.kr'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('본인 소유 별칭이면 허용한다 — 과거 본인 주소로 되돌리기', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.userEmailAlias.findFirst.mockResolvedValue({
      email: 'old@energyx.co.kr',
      userId: ME,
    });

    const change = await planEmailChange(
      prisma as never,
      ME,
      'kjlee@energyx.co.kr',
      'old@energyx.co.kr',
    );

    expect(change).toEqual({
      email: 'old@energyx.co.kr',
      previousEmail: 'kjlee@energyx.co.kr',
    });
  });
});

describe('preserveEmailAlias', () => {
  it('옛 주소를 alias 로 남긴다', async () => {
    const tx = makeTx();
    tx.userEmailAlias.findUnique.mockResolvedValue(null);

    await preserveEmailAlias(tx as never, ME, 'kjlee@energyx.co.kr');

    expect(tx.userEmailAlias.upsert).toHaveBeenCalledWith({
      where: { email: 'kjlee@energyx.co.kr' },
      update: { userId: ME },
      create: {
        email: 'kjlee@energyx.co.kr',
        userId: ME,
        note: '이메일 변경 시 자동 보존',
      },
    });
  });

  it('옛 주소는 소문자로 정규화해 저장한다 — SSO 별칭 조회는 소문자 정확 일치', async () => {
    const tx = makeTx();
    tx.userEmailAlias.findUnique.mockResolvedValue(null);

    await preserveEmailAlias(tx as never, ME, 'KJLee@EnergyX.co.kr');

    const arg = tx.userEmailAlias.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ email: 'kjlee@energyx.co.kr' });
    expect(arg.create.email).toBe('kjlee@energyx.co.kr');
  });

  it('본인 소유 alias 가 이미 있으면 갱신한다', async () => {
    const tx = makeTx();
    tx.userEmailAlias.findUnique.mockResolvedValue({
      email: 'kjlee@energyx.co.kr',
      userId: ME,
    });

    await preserveEmailAlias(tx as never, ME, 'kjlee@energyx.co.kr');

    const arg = tx.userEmailAlias.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({ userId: ME });
  });

  it('다른 사용자 소유 alias 면 409 — 소유권을 조용히 빼앗지 않는다', async () => {
    const tx = makeTx();
    tx.userEmailAlias.findUnique.mockResolvedValue({
      email: 'kjlee@energyx.co.kr',
      userId: 'someone-else',
    });

    await expect(
      preserveEmailAlias(tx as never, ME, 'kjlee@energyx.co.kr'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userEmailAlias.upsert).not.toHaveBeenCalled();
  });
});
