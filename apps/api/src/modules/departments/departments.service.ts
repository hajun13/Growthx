import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Department, DepartmentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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

  async list(query: ListDepartmentsQuery) {
    const where = query.type ? { type: query.type } : {};
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

  async get(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id } });
    if (!d) throw new NotFoundException({ code: 'NOT_FOUND', message: '부서를 찾을 수 없어요.' });
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

    const data: { name?: string; parentId?: string; headUserId?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name;

    // 부서장 지정/해제.
    if (dto.headUserId !== undefined) {
      const hid = dto.headUserId.trim();
      if (hid === '') {
        data.headUserId = null; // 자동 추론으로 복귀.
      } else {
        const u = await this.prisma.user.findUnique({
          where: { id: hid },
          select: { id: true },
        });
        if (!u) {
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: '부서장으로 지정할 사용자를 찾을 수 없어요.',
          });
        }
        data.headUserId = hid;
      }
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
      // 계층 정합: 본부는 그룹 아래, 팀은 본부 아래.
      const ok =
        (existing.type === DepartmentType.division && parent.type === DepartmentType.group) ||
        (existing.type === DepartmentType.team && parent.type === DepartmentType.division);
      if (!ok) {
        throw new ConflictException({
          code: 'INVALID_MOVE',
          message: '조직 계층에 맞지 않는 이동이에요. (본부는 그룹 아래, 팀은 본부 아래)',
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
