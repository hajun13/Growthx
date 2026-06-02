import { Injectable, NotFoundException } from '@nestjs/common';
import { Department, DepartmentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto, ListDepartmentsQuery } from './dto/department.dto';

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
