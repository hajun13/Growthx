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
    currentSalary: user.currentSalary,
    // M3 Item1·2 + 조직도
    mustChangePassword: user.mustChangePassword,
    visibilityScope: user.visibilityScope,
    isActive: user.isActive,
    // 라이프사이클: 법인·재직상태·퇴사일 (퇴사/복직·뱃지용). 필드 추가만(비회귀).
    legalEntity: user.legalEntity,
    employmentStatus: user.employmentStatus,
    resignedAt: user.resignedAt,
    createdAt: user.createdAt,
  };
}
