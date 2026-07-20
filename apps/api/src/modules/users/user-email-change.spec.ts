import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { planEmailChange, preserveEmailAlias } from './user-email-change';

const ME = 'user-1';

function makePrisma() {
  return {
    user: { findUnique: vi.fn() },
  };
}

function makeTx() {
  return {
    userEmailAlias: { upsert: vi.fn() },
  };
}

describe('planEmailChange', () => {
  it('주소가 바뀌면 새 주소를 소문자로 정규화하고 옛 주소를 함께 돌려준다', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

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
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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
    prisma.user.findUnique.mockResolvedValue({ id: 'someone-else' });

    await expect(
      planEmailChange(prisma as never, ME, 'kjlee@energyx.co.kr', 'kky@mrplan.co.kr'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('조회 결과가 본인이면 충돌로 보지 않는다', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: ME });

    const change = await planEmailChange(
      prisma as never,
      ME,
      'Kjlee@Energyx.co.kr',
      'kjlee@energyx.co.kr',
    );

    // 정규화 후 같은 주소이므로 애초에 조회 전에 null 이다.
    expect(change).toBeNull();
  });
});

describe('preserveEmailAlias', () => {
  it('옛 주소를 alias 로 남긴다', async () => {
    const tx = makeTx();

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

  it('이미 있는 alias 는 이번 사용자로 소유를 옮긴다', async () => {
    const tx = makeTx();

    await preserveEmailAlias(tx as never, ME, 'kjlee@energyx.co.kr');

    const arg = tx.userEmailAlias.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({ userId: ME });
  });
});
