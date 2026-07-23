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
 *
 * emailVerified: 2)·3) 의 "이메일을 근거로 처음 바인딩"하는 경로는 email_verified=true 를
 * 요구한다(미검증 이메일은 IdP 에서 임의 기입이 가능 → TOFU 탈취 프리미티브).
 * 1) 의 이미 바인딩된 사용자는 요구하지 않는다 — 기존 로그인은 계속돼야 한다.
 */
export async function resolveSsoUser(
  prisma: PrismaService,
  sub: string,
  email: string,
  emailVerified: boolean,
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

  // TOFU 바인딩 게이트: 여기부터는 email 클레임만 근거로 계정을 "처음" 연결하는 경로다.
  // email_verified=false 인 이메일은 IdP(Azure AD/Keycloak)에서 검증 없이 기입될 수 있어,
  // 그대로 믿으면 공격자가 기존 사용자 이메일을 단 미검증 계정으로 로그인해 계정을
  // 탈취(자기 sub 를 바인딩)할 수 있다. Keycloak 기본 `email` 클라이언트 스코프가
  // email_verified 를 access token 에 매핑하므로(기본 동작) 정상 사용자는 통과한다.
  // 이미 sub 로 바인딩된 사용자(위 반환 경로)는 이 게이트를 타지 않는다.
  if (!emailVerified) {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: '이메일이 검증되지 않은 SSO 계정이에요. 관리자에게 문의해 주세요.',
    });
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
