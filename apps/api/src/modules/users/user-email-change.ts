import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmailChange {
  /** 새 주소(정규화됨). */
  email: string;
  /** 옛 주소 — alias 로 보존해야 SSO 매칭이 끊기지 않는다. */
  previousEmail: string;
}

function alreadyExists(): never {
  throw new ConflictException({
    code: 'ALREADY_EXISTS',
    message: '이미 존재하는 이메일이에요.',
  });
}

/**
 * 이메일 변경 계획을 세운다. 쓰기는 하지 않는다(호출자가 트랜잭션 안에서 적용).
 *
 * email 은 @unique 이자 SSO 2순위 매칭 키(sso-binding.ts)다. 중복이면 409로 막는다.
 * 같은 주소(대소문자만 다른 경우 포함)면 변경 없음으로 보고 null 을 돌려준다.
 *
 * 충돌 검사 2종:
 *  - users.email — DB 유니크는 대소문자 구분이라 정확 일치(findUnique)로는 레거시
 *    혼합 대소문자 행을 놓친다. SSO 매칭과 같은 insensitive 비교로 잡는다.
 *  - user_email_aliases — 다른 사용자의 SSO 로그인 별칭으로 남아 있는 주소를 주면,
 *    그 주소로 SSO 로그인 시 별칭 주인 계정에 바인딩된다(잘못된 계정 연결).
 *    본인 소유 별칭(과거 본인 주소로 되돌리기)은 허용.
 */
export async function planEmailChange(
  prisma: PrismaService,
  userId: string,
  currentEmail: string,
  requested: string,
): Promise<EmailChange | null> {
  const email = requested.trim().toLowerCase();
  if (email === currentEmail.trim().toLowerCase()) return null;

  const taken = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (taken && taken.id !== userId) alreadyExists();

  const aliased = await prisma.userEmailAlias.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (aliased && aliased.userId !== userId) alreadyExists();

  return { email, previousEmail: currentEmail };
}

/**
 * 옛 주소를 user_email_aliases 에 보존한다. 트랜잭션 안에서 호출한다.
 *
 * 이게 없으면 Azure AD 쪽 메일이 아직 옛 주소인 사용자가 로그인하지 못한다
 * (sso-binding 조회 순서: azureAdSubject → users.email → alias).
 * SSO 의 별칭 조회는 소문자 정확 일치(findUnique)라 소문자로 정규화해 저장한다.
 *
 * alias 의 PK 는 email 인데, 이미 다른 사용자 소유의 행이면 절대 소유권을 옮기지
 * 않는다(409) — 옮기면 그 사용자의 SSO 로그인 경로를 조용히 빼앗게 된다.
 * (users.email 이 대소문자 구분 유니크라 "옛 주소의 주인은 반드시 나"라는 가정은
 * 레거시 데이터에서 성립하지 않을 수 있다.) 본인 소유 행이면 갱신만 한다.
 */
export async function preserveEmailAlias(
  tx: Prisma.TransactionClient,
  userId: string,
  previousEmail: string,
  note = '이메일 변경 시 자동 보존',
): Promise<void> {
  const email = previousEmail.trim().toLowerCase();

  const existing = await tx.userEmailAlias.findUnique({ where: { email } });
  if (existing && existing.userId !== userId) {
    throw new ConflictException({
      code: 'ALREADY_EXISTS',
      message: '다른 사용자의 로그인 별칭으로 이미 등록된 주소예요.',
    });
  }

  await tx.userEmailAlias.upsert({
    where: { email },
    update: { userId },
    create: { email, userId, note },
  });
}
