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
        secret: process.env.JWT_SECRET ?? 'change-me-in-production',
        ignoreExpiration: allowPwChange ?? false,
      });
      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        departmentId: payload.departmentId ?? null,
        scope: payload.scope ?? 'self',
        mustChangePassword: payload.mustChangePassword ?? false,
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
