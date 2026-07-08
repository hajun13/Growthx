import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function conflict(): never {
  throw new ConflictException({
    code: 'SSO_SUBJECT_CONFLICT',
    message: '이미 다른 SSO 계정에 연결된 사용자예요. 관리자에게 문의해 주세요.',
  });
}

function assertActive(user: User): User {
  if (!user.isActive) {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: '유효하지 않거나 비활성화된 계정이에요.',
    });
  }
  return user;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/**
 * Keycloak 신원(sub, email)으로 org.users 를 찾는다. 없으면 최초 로그인 바인딩(TOFU).
 *
 * 조회 순서:
 *   1) azureAdSubject == sub                  → 바인딩 완료된 사용자
 *   2) users.email == lower(email)            → 최초 로그인, 바인딩
 *   3) user_email_aliases.email == lower(...) → 도메인 불일치 사용자, 바인딩
 *   4) 없음                                    → 403
 *
 * 바인딩은 azureAdSubject 가 null 일 때만 허용한다. 이미 다른 sub 가 있으면 409.
 * 이 검사가 없으면, Azure AD 에서 아무 계정이나 만들어 기존 사용자 이메일을 붙이는 것으로
 * 계정을 탈취할 수 있다.
 */
export async function resolveSsoUser(
  prisma: PrismaService,
  sub: string,
  email: string,
): Promise<User> {
  const bySub = await prisma.user.findUnique({ where: { azureAdSubject: sub } });
  if (bySub) return assertActive(bySub);

  const norm = email.trim().toLowerCase();

  let target = await prisma.user.findFirst({
    where: { email: { equals: norm, mode: 'insensitive' } },
  });

  if (!target) {
    const alias = await prisma.userEmailAlias.findUnique({
      where: { email: norm },
      include: { user: true },
    });
    target = alias?.user ?? null;
  }

  if (!target) {
    throw new ForbiddenException({
      code: 'SSO_USER_NOT_LINKED',
      message: '연결된 사용자 계정이 없어요. 관리자에게 문의해 주세요.',
    });
  }

  assertActive(target);

  if (target.azureAdSubject !== null) {
    if (target.azureAdSubject !== sub) conflict();
    return target;
  }

  // 원자적 바인딩. where 에 azureAdSubject: null 을 넣어 경합 시 0행이 되게 한다.
  let count: number;
  try {
    ({ count } = await prisma.user.updateMany({
      where: { id: target.id, azureAdSubject: null },
      data: { azureAdSubject: sub },
    }));
  } catch (e) {
    // 다른 사용자가 이미 이 sub 를 갖고 있다(@unique 위반).
    if (isUniqueViolation(e)) conflict();
    throw e;
  }
  if (count === 0) conflict();

  const bound = await prisma.user.findUnique({ where: { id: target.id } });
  return assertActive(bound as User);
}
