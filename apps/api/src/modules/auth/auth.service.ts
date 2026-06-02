import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserDto } from '../users/users.serializer';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
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

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-in-production',
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('no user');
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

  private async issueTokens(user: {
    id: string;
    email: string;
    role: string;
    departmentId: string | null;
  }) {
    const claims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '3600s',
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-in-production',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
      },
    );
    return { accessToken, refreshToken };
  }
}
