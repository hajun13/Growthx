import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmailChange {
  /** 새 주소(정규화됨). */
  email: string;
  /** 옛 주소 — alias 로 보존해야 SSO 매칭이 끊기지 않는다. */
  previousEmail: string;
}

/**
 * 이메일 변경 계획을 세운다. 쓰기는 하지 않는다(호출자가 트랜잭션 안에서 적용).
 *
 * email 은 @unique 이자 SSO 2순위 매칭 키(sso-binding.ts)다. 중복이면 409로 막는다.
 * 같은 주소(대소문자만 다른 경우 포함)면 변경 없음으로 보고 null 을 돌려준다.
 */
export async function planEmailChange(
  prisma: PrismaService,
  userId: string,
  currentEmail: string,
  requested: string,
): Promise<EmailChange | null> {
  const email = requested.trim().toLowerCase();
  if (email === currentEmail.trim().toLowerCase()) return null;

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken && taken.id !== userId) {
    throw new ConflictException({
      code: 'ALREADY_EXISTS',
      message: '이미 존재하는 이메일이에요.',
    });
  }

  return { email, previousEmail: currentEmail };
}

/**
 * 옛 주소를 user_email_aliases 에 보존한다. 트랜잭션 안에서 호출한다.
 *
 * 이게 없으면 Azure AD 쪽 메일이 아직 옛 주소인 사용자가 로그인하지 못한다
 * (sso-binding 조회 순서: azureAdSubject → users.email → alias).
 * alias 의 PK 는 email 이므로, 이미 있으면 이번 사용자로 소유를 옮긴다 —
 * 옛 주소는 방금 전까지 이 사용자의 @unique primary 였으므로 다른 주인이 있을 수 없다.
 */
export async function preserveEmailAlias(
  tx: Prisma.TransactionClient,
  userId: string,
  previousEmail: string,
  note = '이메일 변경 시 자동 보존',
): Promise<void> {
  await tx.userEmailAlias.upsert({
    where: { email: previousEmail },
    update: { userId },
    create: { email: previousEmail, userId, note },
  });
}
