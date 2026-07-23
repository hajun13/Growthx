import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserDto } from '../users/users.serializer';
import {
  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessExpiresIn,
  jwtRefreshExpiresIn,
} from '../../common/config/jwt.config';
import { authMode } from '../../common/config/keycloak.config';
import { verifyKeycloakToken } from './kc-token.verifier';
import { resolveSsoUser } from './sso-binding';

/** 초기/금지 비밀번호. */
const FORBIDDEN_PASSWORDS = ['1234', '12345678', 'password'];
const MIN_PASSWORD_LENGTH = 8;

/**
 * 타이밍 오라클 방지용 더미 해시(cost 10 — 실제 사용자 해시와 동일 비용).
 * 계정 부재/게이트 탈락 경로도 bcrypt.compare 1회를 소모해, 응답 시간으로
 * 계정 존재 여부를 구분할 수 없게 한다. 어떤 비밀번호와도 일치하지 않는다.
 */
const DUMMY_PASSWORD_HASH = '$2a$10$c5fm7wKyJSzELwHKgPX0W.lt8Ttp/QfpN5fSL9YGFOF6HbORfHic2';

/** 세션 발급 경로. refresh 재게이트(break-glass 회수 즉시 반영)의 판별 근거. */
type LoginMethod = 'password' | 'sso';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // SSO 모드에서 비밀번호 로그인은 break-glass 전용(allowPasswordLogin=true 계정만).
    // AUTH_MODE=password 롤백 시에는 전 사용자에게 허용한다.
    // 계정 존재 여부를 노출하지 않으려 게이트 실패도 같은 메시지를 쓴다.
    const passwordAllowed =
      authMode() === 'password' || (user?.allowPasswordLogin ?? false);

    if (!user || !user.isActive || !passwordAllowed) {
      // 탈락 경로도 bcrypt 1회 소모(타이밍 오라클 방지). 결과는 쓰지 않는다.
      await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '이메일 또는 비밀번호가 일치하지 않아요.',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '이메일 또는 비밀번호가 일치하지 않아요.',
      });
    }

    const tokens = await this.issueTokens(user, 'password');
    return { ...tokens, user: toUserDto(user) };
  }

  /**
   * Keycloak access token 으로 로그인. 검증 → 바인딩 → 기존 issueTokens() 재사용.
   * Keycloak 은 신원만 증명한다. role/scope 는 org.users 가 결정한다.
   */
  async ssoLogin(kcAccessToken: string) {
    if (authMode() === 'password') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'SSO 가 비활성화돼 있어요.' });
    }
    const { sub, email, emailVerified } = await verifyKeycloakToken(kcAccessToken);
    let user = await resolveSsoUser(this.prisma, sub, email, emailVerified);
    // 레거시 mustChangePassword=true 는 SSO 사용자를 영구 403 에 가둔다 —
    // ForcePasswordChangeGuard 를 풀려면 현재 비밀번호가 필요한데 SSO 사용자는 모른다.
    // sso 모드에서만(위 404 게이트가 보장) 로그인 시점에 해제한다.
    if (user.mustChangePassword) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: false },
      });
    }
    const tokens = await this.issueTokens(user, 'sso');
    return { ...tokens, user: toUserDto(user) };
  }

  /**
   * 리프레시. isActive 재확인 + break-glass 재게이트:
   * password 세션(method=password)은 `authMode()==='password' || allowPasswordLogin` 을
   * 매 refresh 마다 다시 요구한다 — break-glass 회수(allowPasswordLogin=false)가
   * refresh TTL 만료를 기다리지 않고 즉시 반영된다.
   * sso 세션(method=sso)은 게이트하지 않는다 — 일반 SSO 사용자는 allowPasswordLogin=false
   * 이므로 여기서 게이트하면 전원이 access 만료 시점에 로그아웃된다.
   * method 클레임이 없는 구버전 토큰은 password 로 간주한다(전부 password 로그인 발급분).
   */
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: jwtRefreshSecret(),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('inactive or missing user');
      const method: LoginMethod = payload.method === 'sso' ? 'sso' : 'password';
      if (
        method === 'password' &&
        !(authMode() === 'password' || user.allowPasswordLogin)
      ) {
        throw new Error('password login revoked');
      }
      return this.issueTokens(user, method);
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '리프레시 토큰이 유효하지 않아요.',
      });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '사용자를 찾을 수 없어요.' });
    }
    return toUserDto(user);
  }

  /**
   * M3 Item1: 비밀번호 변경.
   * 현재 비번 검증 → 신규(최소 8자, '1234' 등 금지) → mustChangePassword=false.
   * 새 토큰을 재발급해 갱신된 mustChangePassword 클레임을 반영한다.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: '사용자를 찾을 수 없어요.' });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '현재 비밀번호가 일치하지 않아요.',
      });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`,
      });
    }
    if (FORBIDDEN_PASSWORDS.includes(newPassword)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '사용할 수 없는 비밀번호예요. 다른 비밀번호를 입력해 주세요.',
      });
    }
    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '기존 비밀번호와 다른 비밀번호를 입력해 주세요.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    const tokens = await this.issueTokens(updated, 'password');
    return { ...tokens, user: toUserDto(updated) };
  }

  private async issueTokens(user: User, method: LoginMethod) {
    const claims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      scope: user.visibilityScope,
      mustChangePassword: user.mustChangePassword,
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: jwtAccessSecret(),
      expiresIn: jwtAccessExpiresIn(),
    });
    // method 는 refresh 재게이트 판별용(위 refresh() 참조) — access 클레임에는 넣지 않는다.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, method },
      {
        secret: jwtRefreshSecret(),
        expiresIn: jwtRefreshExpiresIn(),
      },
    );
    return { accessToken, refreshToken };
  }
}
