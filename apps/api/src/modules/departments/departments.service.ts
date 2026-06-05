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

    const d = await this.prisma.department.update({
      where: { id },
      data: { name: dto.name },
    });
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
