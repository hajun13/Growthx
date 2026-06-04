import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, VisibilityScope } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  departmentId: string | null;
  /** M3 Item2: 가시 범위(행수준 RBAC). */
  scope: VisibilityScope;
  /** M3 Item1: 초기 비밀번호 강제 변경 여부. */
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
