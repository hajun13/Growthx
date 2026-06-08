import { Injectable } from '@nestjs/common';
import { Department, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { visibleDeptIds } from '../../common/access/access.util';

export interface OrgChartNode {
  id: string;
  name: string;
  type: Department['type'];
  parentId: string | null;
  /** 명시적으로 지정된 부서장(그룹장·본부장·팀장) id. null=자동 추론. */
  headUserId: string | null;
  /** 지정된 부서장 이름(표시용). */
  headName: string | null;
  /** 이 노드에 직접 소속된(직속) 활성 인원 수. */
  directCount: number;
  /** 이 노드 + 하위 전체 활성 인원 수. */
  totalCount: number;
  children: OrgChartNode[];
}

/**
 * M3 조직도: 회사 루트(가상) → group → division → team 트리 + 노드별 인원 카운트.
 * 가시 범위(visibilityScope) 내 부서만 반영. hr_admin/company=전체.
 */
@Injectable()
export class OrgChartService {
  constructor(private readonly prisma: PrismaService) {}

  async getChart(current: AuthUser) {
    const deptScope = await this.scopeDeptIds(current);

    const allDepts = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { head: { select: { id: true, name: true } } },
    });
    const depts =
      deptScope === null ? allDepts : allDepts.filter((d) => deptScope.has(d.id));
    const visibleIds = new Set(depts.map((d) => d.id));

    // 활성 인원의 직속 부서별 카운트.
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(deptScope === null ? {} : { departmentId: { in: Array.from(visibleIds) } }),
      },
      select: { departmentId: true },
    });
    const directCount = new Map<string, number>();
    for (const u of users) {
      if (!u.departmentId) continue;
      directCount.set(u.departmentId, (directCount.get(u.departmentId) ?? 0) + 1);
    }

    // 노드 빌드
    const nodeMap = new Map<string, OrgChartNode>();
    for (const d of depts) {
      nodeMap.set(d.id, {
        id: d.id,
        name: d.name,
        type: d.type,
        parentId: d.parentId,
        headUserId: d.headUserId ?? null,
        headName: d.head?.name ?? null,
        directCount: directCount.get(d.id) ?? 0,
        totalCount: 0,
        children: [],
      });
    }
    const roots: OrgChartNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // totalCount = 직속 + 자식 합 (후위 순회)
    const computeTotal = (n: OrgChartNode): number => {
      let sum = n.directCount;
      for (const c of n.children) sum += computeTotal(c);
      n.totalCount = sum;
      return sum;
    };
    roots.forEach(computeTotal);

    // 회사 가상 루트(표시 레벨)로 그룹들을 묶는다.
    const companyTotal = roots.reduce((s, r) => s + r.totalCount, 0);
    const companyRoot: OrgChartNode = {
      id: 'company',
      name: '에너지엑스 주식회사',
      type: 'group',
      parentId: null,
      headUserId: null,
      headName: null,
      directCount: 0,
      totalCount: companyTotal,
      children: roots,
    };

    return { data: companyRoot, meta: { total: companyTotal } };
  }

  /** 가시 범위 부서 id 집합(Set) 또는 null(전체). */
  private async scopeDeptIds(current: AuthUser): Promise<Set<string> | null> {
    if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) {
      return null;
    }
    const ids = await visibleDeptIds(this.prisma, current);
    if (ids === null) return null;
    // self/소속없음 → 본인 부서만(있으면)
    if (ids.length === 0 && current.departmentId) return new Set([current.departmentId]);
    return new Set(ids);
  }
}
