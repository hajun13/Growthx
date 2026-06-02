import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import { CreateUserDto, ListUsersQuery, UpdateUserDto } from './dto/user.dto';
import { toUserDto } from './users.serializer';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(current: AuthUser, query: ListUsersQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // 행 수준 가시 범위 제한 (hr_admin 외)
    if (current.role === Role.team_lead) {
      where.OR = [{ managerId: current.id }, { departmentId: current.departmentId ?? '__none__' }];
    } else if (current.role === Role.division_head) {
      const deptIds = await this.descendantDeptIds(current.departmentId);
      where.departmentId = { in: deptIds };
    } else if (current.role === Role.employee) {
      where.id = current.id;
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: rows.map(toUserDto), meta: { page, pageSize, total } };
  }

  async get(current: AuthUser, id: string) {
    const allowed = await canViewUser(this.prisma, current, id);
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });
    return toUserDto(user);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException({ code: 'ALREADY_EXISTS', message: '이미 존재하는 이메일이에요.' });
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role,
        position: dto.position,
        jobLevel: dto.jobLevel ?? null,
        departmentId: dto.departmentId ?? null,
        managerId: dto.managerId ?? null,
      },
    });
    return toUserDto(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        role: dto.role ?? undefined,
        position: dto.position ?? undefined,
        jobLevel: dto.jobLevel ?? undefined,
        departmentId: dto.departmentId ?? undefined,
        managerId: dto.managerId ?? undefined,
      },
    });
    return toUserDto(updated);
  }

  /** division_head 본부 하위 부서 id 전체 (자신 부서 포함). */
  private async descendantDeptIds(rootId: string | null): Promise<string[]> {
    if (!rootId) return ['__none__'];
    const all = await this.prisma.department.findMany();
    const result = new Set<string>([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const d of all) {
        if (d.parentId && result.has(d.parentId) && !result.has(d.id)) {
          result.add(d.id);
          changed = true;
        }
      }
    }
    return Array.from(result);
  }
}
