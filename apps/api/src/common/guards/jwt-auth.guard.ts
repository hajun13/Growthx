import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { ALLOW_PW_CHANGE_KEY } from '../decorators/allow-password-change';
import { AuthUser } from '../decorators/current-user';
import { jwtAccessSecret } from '../config/jwt.config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * JWT(Bearer) 검증. @Public() 표시 엔드포인트는 통과.
 * @AllowDuringPasswordChange() 엔드포인트는 만료된 토큰도 신원 확인용으로 허용
 * (mustChangePassword=true 사용자가 토큰 만료 후에도 비밀번호를 변경할 수 있도록).
 * 토큰 없음/위변조 = 401 UNAUTHORIZED.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowPwChange = this.reflector.getAllAndOverride<boolean>(ALLOW_PW_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '인증 토큰이 필요해요.',
      });
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtAccessSecret(),
        ignoreExpiration: allowPwChange ?? false,
      });

      // 서명·만료만으로는 부족하다: 토큰 발급 이후 퇴사(비활성)·역할 강등이 반영되지 않아
      // 무효화된 계정/구권한이 토큰 TTL(~1h) 동안 살아있게 된다. 매 요청 DB 로 신원 재확인:
      //  - 계정이 없거나 비활성이면 401.
      //  - role/departmentId/scope 는 (클레임이 아니라) DB 현재값을 신뢰 → 강등 즉시 반영.
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          departmentId: true,
          visibilityScope: true,
          isActive: true,
          mustChangePassword: true,
        },
      });
      if (!dbUser || !dbUser.isActive) {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: '유효하지 않거나 비활성화된 계정이에요.',
        });
      }
      const user: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        departmentId: dbUser.departmentId ?? null,
        scope: dbUser.visibilityScope ?? 'self',
        mustChangePassword: dbUser.mustChangePassword ?? false,
      };
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '토큰이 유효하지 않거나 만료되었어요.',
      });
    }
  }
}
