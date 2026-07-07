import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, DepartmentType, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { visibleDeptIds } from '../../common/access/access.util';
import {
  CreateDepartmentDto,
  ListDepartmentsQuery,
  UpdateDepartmentDto,
} from './dto/department.dto';

export interface DepartmentNode {
  id: string;
  name: string;
  type: DepartmentType;
  parentId: string | null;
  children?: DepartmentNode[];
}

function toDto(d: Department): DepartmentNode {
  return { id: d.id, name: d.name, type: d.type, parentId: d.parentId };
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(current: AuthUser, query: ListDepartmentsQuery) {
    const where: { type?: DepartmentType; id?: { in: string[] } } = {};
    if (query.type) where.type = query.type;
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      where.id = { in: deptIds ?? [] };
    }
    const rows = await this.prisma.department.findMany({ where, orderBy: { name: 'asc' } });

    if (query.tree === 'true') {
      const tree = this.buildTree(rows);
      return { data: tree, meta: { page: 1, pageSize: tree.length, total: tree.length } };
    }
    return {
      data: rows.map(toDto),
      meta: { page: 1, pageSize: rows.length, total: rows.length },
    };
  }

  async get(current: AuthUser, id: string) {
    const d = await this.prisma.department.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ code: 'NOT_FOUND', message: '부서를 찾을 수 없어요.' });
    // 목록(list)과 동일한 가시 범위를 단건 조회에도 적용(비 hr_admin/company 스코프).
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null && !deptIds.includes(id)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '이 조직을 조회할 권한이 없어요.',
        });
      }
    }
    return toDto(d);
  }

  async create(dto: CreateDepartmentDto) {
    const d = await this.prisma.department.create({
      data: { name: dto.name, type: dto.type, parentId: dto.parentId ?? null },
    });
    return toDto(d);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '부서를 찾을 수 없어요.' });

    const data: {
      name?: string;
      parentId?: string;
      headUserId?: string | null;
      deputyHeadUserId?: string | null;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;

    // 부서장 지정/해제.
    if (dto.headUserId !== undefined) {
      data.headUserId = await this.validateHeadUser(dto.headUserId, '부서장');
    }

    // 부(副)그룹장 지정/해제 — 다단계 평가의 중간 단계라 group 에서만 의미가 있다.
    if (dto.deputyHeadUserId !== undefined) {
      const did = await this.validateHeadUser(dto.deputyHeadUserId, '부그룹장');
      if (did !== null && existing.type !== DepartmentType.group) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: '부그룹장은 그룹에만 지정할 수 있어요.',
        });
      }
      data.deputyHeadUserId = did;
    }

    // 부서 이동(parentId 변경) — 계층 정합·순환 검증.
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      const newParentId = dto.parentId;
      if (newParentId === id) {
        throw new ConflictException({
          code: 'INVALID_MOVE',
          message: '자기 자신을 상위 조직으로 둘 수 없어요.',
        });
      }
      const parent = await this.prisma.department.findUnique({ where: { id: newParentId } });
      if (!parent) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '상위 조직을 찾을 수 없어요.' });
      }
      // 계층 정합: 본부는 그룹 아래, 팀은 본부 또는 그룹 아래(그룹 직속 팀 허용).
      const ok =
        (existing.type === DepartmentType.division && parent.type === DepartmentType.group) ||
        (existing.type === DepartmentType.team &&
          (parent.type === DepartmentType.division || parent.type === DepartmentType.group));
      if (!ok) {
        throw new ConflictException({
          code: 'INVALID_MOVE',
          message: '조직 계층에 맞지 않는 이동이에요. (본부는 그룹 아래, 팀은 본부 또는 그룹 아래)',
        });
      }
      // 순환 방지: 새 상위의 조상 중 자신(id)이 있으면 거부.
      let cursor: string | null = parent.parentId;
      for (let depth = 0; cursor && depth < 20; depth++) {
        if (cursor === id) {
          throw new ConflictException({
            code: 'INVALID_MOVE',
            message: '하위 조직으로는 이동할 수 없어요.',
          });
        }
        const c: { parentId: string | null } | null =
          await this.prisma.department.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
        cursor = c?.parentId ?? null;
      }
      data.parentId = newParentId;
    }

    const d = await this.prisma.department.update({ where: { id }, data });
    return toDto(d);
  }

  /**
   * 부서장/부그룹장 지정 값 검증 — 빈 문자열은 해제(null), 아니면 활성 사용자만 허용.
   * @returns 저장할 값(null=해제, string=사용자 id).
   */
  private async validateHeadUser(raw: string, label: string): Promise<string | null> {
    const uid = raw.trim();
    if (uid === '') return null; // 지정 해제(자동 추론으로 복귀).
    const u = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, isActive: true },
    });
    if (!u) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `${label}으로 지정할 사용자를 찾을 수 없어요.`,
      });
    }
    // 퇴사자(비활성)를 장으로 지정하면 다단계 평가자 배정이 엉뚱해진다.
    if (!u.isActive) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: `비활성(퇴사) 사용자는 ${label}으로 지정할 수 없어요.`,
      });
    }
    return uid;
  }

  async remove(id: string) {
    const existing = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true, children: true } } },
    });
    if (!existing)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '부서를 찾을 수 없어요.' });

    if (existing._count.users > 0 || existing._count.children > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: '구성원이나 하위 조직이 있어 삭제할 수 없어요.',
      });
    }

    await this.prisma.department.delete({ where: { id } });
    return { id };
  }

  private buildTree(rows: Department[]): DepartmentNode[] {
    const map = new Map<string, DepartmentNode>();
    rows.forEach((r) => map.set(r.id, { ...toDto(r), children: [] }));
    const roots: DepartmentNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }
}
