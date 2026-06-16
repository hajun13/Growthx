import { User } from '@prisma/client';

/** 생년월일 → 만 나이. 생일이 아직 안 지났으면 한 살 빼고, 미입력/미래값은 null. */
export function computeAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

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
    // 입사일(입사일 기준 평가 제외 EvaluationCycle.hireCutoffDate 적용 시 참조).
    hireDate: user.hireDate,
    // 생년월일 + 만 나이(파생). birthDate 미입력 시 age=null.
    birthDate: user.birthDate,
    age: computeAge(user.birthDate),
    // 평가 제외(재직 중이나 평가 대상 아님).
    evaluationExempt: user.evaluationExempt,
    evaluationExemptReason: user.evaluationExemptReason,
    createdAt: user.createdAt,
  };
}
