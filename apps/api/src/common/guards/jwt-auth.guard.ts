import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { AuthUser } from '../decorators/current-user';

/**
 * JWT(Bearer) 검증. @Public() 표시 엔드포인트는 통과.
 * 토큰 없음/만료 = 401 UNAUTHORIZED.
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
