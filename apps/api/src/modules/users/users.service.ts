import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, applyUserScope } from '../../common/access/access.util';
import {
  defaultRoleScope,
  deriveJobLevel,
  isHrDeptName,
  INITIAL_PASSWORD,
} from '../../common/access/position.util';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateSalaryDto,
  UpdateUserDto,
} from './dto/user.dto';
import { toUserDto } from './users.serializer';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(current: AuthUser, query: ListUsersQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 20));

    let where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.includeInactive !== 'true') where.isActive = true;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // M3 Item2: visibilityScope 기준 행 수준 가시 범위 제한 (hr_admin/company 외).
    where = await applyUserScope(this.prisma, current, where);

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

  /**
   * M3 조직도: 사람 추가 (hr_admin).
   * password 미지정 시 초기비번 1234 + mustChangePassword=true.
   * role/visibilityScope 미지정 시 직급 자동기본(소속 HR팀 판정 포함).
   */
  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException({ code: 'ALREADY_EXISTS', message: '이미 존재하는 이메일이에요.' });
    }

    // 소속 부서명으로 HR팀 판정(자동기본 role/scope).
    let deptName: string | null = null;
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      deptName = dept?.name ?? null;
    }
    const auto = defaultRoleScope(dto.position, isHrDeptName(deptName));

    const initial = !dto.password;
    const passwordHash = await bcrypt.hash(dto.password ?? INITIAL_PASSWORD, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? auto.role,
        position: dto.position,
        jobLevel: dto.jobLevel ?? deriveJobLevel(dto.position),
        departmentId: dto.departmentId ?? null,
        managerId: dto.managerId ?? null,
        visibilityScope: dto.visibilityScope ?? auto.scope,
        mustChangePassword: initial,
        isActive: true,
      },
    });
    return toUserDto(user);
  }

  /** M3: 사람 수정 (hr_admin) — 이름·직급·소속·role·visibilityScope·관리자·활성. */
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
        visibilityScope: dto.visibilityScope ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    return toUserDto(updated);
  }

  /** M3 조직도: 비활성(soft delete). hr_admin. */
  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return toUserDto(updated);
  }

  /** M3 Item 8: 현재 연봉 입력/수정 (hr_admin). */
  async updateSalary(id: string, dto: UpdateSalaryDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });
    const updated = await this.prisma.user.update({
      where: { id },
      data: { currentSalary: dto.currentSalary },
    });
    return toUserDto(updated);
  }
}
