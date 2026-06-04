import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public';
import { ALLOW_PW_CHANGE_KEY } from '../decorators/allow-password-change';
import { AuthUser } from '../decorators/current-user';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M3 Item1: 초기 비밀번호 강제 변경 가드.
 * mustChangePassword=true 인 사용자는 @AllowDuringPasswordChange() 또는 @Public() 외
 * 모든 요청을 403 FORCE_PASSWORD_CHANGE 로 차단한다.
 * 토큰 클레임이 아닌 DB 의 최신 mustChangePassword 를 읽어 강제(토큰 stale 방지).
 */
@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PW_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return true; // JwtAuthGuard 가 이미 처리

    // 토큰 클레임이 false 면 빠른 통과(변경 완료). true 일 때만 DB 확인(비용 최소화).
    if (!user.mustChangePassword) return true;

    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { mustChangePassword: true },
    });
    if (fresh?.mustChangePassword) {
      throw new ForbiddenException({
        code: 'FORCE_PASSWORD_CHANGE',
        message: '초기 비밀번호를 먼저 변경해야 해요.',
      });
    }
    return true;
  }
}
