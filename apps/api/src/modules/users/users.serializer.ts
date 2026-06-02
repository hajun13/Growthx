import { User } from '@prisma/client';

/** passwordHash 등 민감 필드를 제거한 camelCase User DTO. */
export function toUserDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    position: user.position,
    jobLevel: user.jobLevel,
    departmentId: user.departmentId,
    managerId: user.managerId,
    createdAt: user.createdAt,
  };
}
