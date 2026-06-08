import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature';
import { AuthUser } from '../decorators/current-user';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import {
  FeatureKey,
  levelOf,
} from '../../modules/permissions/perm-config.constants';

/**
 * @RequireFeature(key) 메타데이터가 있으면 권한 매트릭스로 추가 차단(restrict-only).
 * - 메타데이터 없으면 통과.
 * - request.user(role,scope) → levelOf → matrix[level][key]===false 면 403 FEATURE_DENIED.
 * - config row 없거나 키 누락이면 DEFAULT_MATRIX 폴백(크래시 금지, fail-to-default).
 *
 * 가드 체인: JwtAuthGuard(인증) → RolesGuard(상한) → FeatureGuard(추가차단).
 * RolesGuard 가 먼저 통과한 뒤에만 동작하므로 role 이상의 권한은 절대 부여하지 않는다.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureKey | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true; // 기능 게이트 없음 — 통과.

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      // 인증 누락은 JwtAuthGuard 책임이지만 방어적으로 차단.
      throw new ForbiddenException({
        code: 'FEATURE_DENIED',
        message: '이 기능을 사용할 권한이 없어요.',
      });
    }

    const level = levelOf(user.role, user.scope);
    const allowed = await this.permissions.hasFeature(level, required);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FEATURE_DENIED',
        message: '이 기능을 사용할 권한이 없어요.',
      });
    }
    return true;
  }
}
