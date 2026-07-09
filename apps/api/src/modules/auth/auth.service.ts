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

    const tokens = await this.issueTokens(user);
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
    const { sub, email } = await verifyKeycloakToken(kcAccessToken);
    const user = await resolveSsoUser(this.prisma, sub, email);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: toUserDto(user) };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: jwtRefreshSecret(),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('inactive or missing user');
      return this.issueTokens(user);
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
    const tokens = await this.issueTokens(updated);
    return { ...tokens, user: toUserDto(updated) };
  }

  private async issueTokens(user: User) {
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
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: jwtRefreshSecret(),
        expiresIn: jwtRefreshExpiresIn(),
      },
    );
    return { accessToken, refreshToken };
  }
}
