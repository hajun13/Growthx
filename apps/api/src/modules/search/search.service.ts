import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { applyUserScope, visibleDeptIds } from '../../common/access/access.util';

/**
 * 전역 검색 — 상단바 검색창(명령 팔레트)용.
 * 사용자(이름·이메일)와 부서(이름)를 함께 찾는다.
 * 모든 결과는 호출자의 visibilityScope(행수준 RBAC)로 축소한다 —
 * 검색으로 가시 범위를 우회할 수 없다.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(current: AuthUser, rawQ: string | undefined, rawLimit: string | undefined) {
    const term = (rawQ ?? '').trim();
    const take = Math.min(20, Math.max(1, Number(rawLimit) || 8));
    if (!term) return { users: [], departments: [] };

    const [users, departments] = await Promise.all([
      this.searchUsers(current, term, take),
      this.searchDepartments(current, term, take),
    ]);
    return { users, departments };
  }

  private async searchUsers(current: AuthUser, term: string, take: number) {
    let where: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    };
    // 가시 범위 적용(hr_admin/company 외 — 본인 OR 가시 부서로 제한).
    where = await applyUserScope(this.prisma, current, where);

    const rows = await this.prisma.user.findMany({
      where,
      take,
      // 재직자 우선 → 이름 가나다순.
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        position: true,
        role: true,
        isActive: true,
        employmentStatus: true,
        legalEntity: true,
        department: { select: { name: true } },
      },
    });

    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      position: u.position,
      role: u.role,
      departmentName: u.department?.name ?? null,
      isActive: u.isActive,
      employmentStatus: u.employmentStatus,
      legalEntity: u.legalEntity,
    }));
  }

  private async searchDepartments(current: AuthUser, term: string, take: number) {
    let where: Prisma.DepartmentWhereInput = {
      name: { contains: term, mode: 'insensitive' },
    };
    // 가시 부서 집합으로 제한(null=제한 없음).
    const deptIds = await visibleDeptIds(this.prisma, current);
    if (deptIds !== null) {
      where = { AND: [where, { id: { in: deptIds } }] };
    }

    const rows = await this.prisma.department.findMany({
      where,
      take,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        parent: { select: { name: true } },
      },
    });

    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      parentName: d.parent?.name ?? null,
    }));
  }
}
