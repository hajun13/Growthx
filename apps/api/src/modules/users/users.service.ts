import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, Prisma, Role, VisibilityScope } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, applyUserScope } from '../../common/access/access.util';
import {
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
        // 이름 가나다순(한글 음절은 유니코드 코드포인트가 곧 가나다 순서). 동명이인은 생성순.
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
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

    // 직급 기본값은 레지스트리(PositionDef)에서 읽는다(B-5). 없는 코드면 400.
    const def = await this.prisma.positionDef.findUnique({ where: { code: dto.position } });
    if (!def) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `알 수 없는 직급이에요: ${dto.position}`,
      });
    }

    // 소속 부서명으로 HR팀 판정(자동기본 role/scope 오버라이드). 무소속이면 HR 판정 불가.
    let deptName: string | null = null;
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      deptName = dept?.name ?? null;
    }
    const isHr = dto.departmentId ? isHrDeptName(deptName) : false;
    const role = dto.role ?? (isHr ? Role.hr_admin : def.defaultRole);
    const scope = dto.visibilityScope ?? (isHr ? VisibilityScope.company : def.defaultScope);
    const jobLevel = dto.jobLevel ?? def.defaultJobLevel ?? null;

    const passwordHash = await bcrypt.hash(dto.password ?? INITIAL_PASSWORD, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        role,
        position: dto.position,
        jobLevel,
        departmentId: dto.departmentId ?? null,
        managerId: dto.managerId ?? null,
        visibilityScope: scope,
        mustChangePassword: false,
        isActive: true,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      },
    });
    return toUserDto(user);
  }

  /** M3: 사람 수정 (hr_admin) — 이름·직급·소속·role·visibilityScope·관리자·활성. */
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });

    // 직급 변경 시 레지스트리 검증(없는 코드면 400).
    if (dto.position !== undefined) {
      const def = await this.prisma.positionDef.findUnique({ where: { code: dto.position } });
      if (!def) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `알 수 없는 직급이에요: ${dto.position}`,
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        role: dto.role ?? undefined,
        position: dto.position ?? undefined,
        jobLevel: dto.jobLevel ?? undefined,
        // undefined=변경없음, null=소속/관리자 해제 (계약 A-1).
        departmentId: dto.departmentId === undefined ? undefined : dto.departmentId,
        managerId: dto.managerId === undefined ? undefined : dto.managerId,
        visibilityScope: dto.visibilityScope ?? undefined,
        isActive: dto.isActive ?? undefined,
        evaluationExempt: dto.evaluationExempt ?? undefined,
        evaluationExemptReason:
          dto.evaluationExemptReason === undefined ? undefined : dto.evaluationExemptReason,
        // undefined=변경없음, null=해제, 값=설정.
        hireDate:
          dto.hireDate === undefined
            ? undefined
            : dto.hireDate === null
              ? null
              : new Date(dto.hireDate),
        birthDate:
          dto.birthDate === undefined
            ? undefined
            : dto.birthDate === null
              ? null
              : new Date(dto.birthDate),
      },
    });
    return toUserDto(updated);
  }

  /**
   * 라이프사이클 S1: 퇴사 처리 (hr_admin).
   * employmentStatus=resigned · resignedAt=now() · isActive=false. 멱등(이미 퇴사면 그대로).
   * 자기 자신 차단(403). 감사로그.
   */
  async resign(current: AuthUser, id: string) {
    if (current.id === id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인은 퇴사 처리할 수 없어요.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });

    // 멱등: 이미 퇴사 상태면 그대로 반환(상태만 보정).
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        employmentStatus: EmploymentStatus.resigned,
        resignedAt: user.resignedAt ?? new Date(),
        isActive: false,
      },
    });

    await this.audit.record({
      entity: 'user',
      entityId: id,
      action: 'user.resign',
      actorId: current.id,
      before: { employmentStatus: user.employmentStatus, isActive: user.isActive },
      after: { employmentStatus: updated.employmentStatus, isActive: updated.isActive },
    });
    return toUserDto(updated);
  }

  /**
   * 라이프사이클 S1: 복직 (hr_admin).
   * employmentStatus=active · resignedAt=null · isActive=true. 감사로그.
   */
  async reactivate(current: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        employmentStatus: EmploymentStatus.active,
        resignedAt: null,
        isActive: true,
      },
    });

    await this.audit.record({
      entity: 'user',
      entityId: id,
      action: 'user.reactivate',
      actorId: current.id,
      before: { employmentStatus: user.employmentStatus, isActive: user.isActive },
      after: { employmentStatus: updated.employmentStatus, isActive: updated.isActive },
    });
    return toUserDto(updated);
  }

  /**
   * 라이프사이클 S2: 하드 삭제 — 2모드 (hr_admin).
   * 공통 전제: isActive=true 면 409(먼저 퇴사/비활성). 자기 자신·마지막 활성 hr_admin 차단.
   *  - force 미지정(기본): 평가 이력 있으면 409 차단(비활성 보존). 이력 0이면 안전 삭제.
   *  - force=true: 트랜잭션 cascade 완전 삭제(연도비교에서 사라짐).
   */
  async remove(current: AuthUser, id: string, force: boolean) {
    if (current.id === id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인 계정은 삭제할 수 없어요.',
      });
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });

    // 전제: 활성 사용자는 삭제 불가(먼저 퇴사/비활성).
    if (user.isActive) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: '활성 사용자는 바로 삭제할 수 없어요. 먼저 퇴사/비활성 처리해 주세요.',
      });
    }

    // 마지막 활성 hr_admin 보호(권한 잠금 방지). 대상이 hr_admin일 때만 검사.
    if (user.role === Role.hr_admin) {
      const activeAdmins = await this.prisma.user.count({
        where: { role: Role.hr_admin, isActive: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: '마지막 활성 인사관리자는 삭제할 수 없어요.',
        });
      }
    }

    if (force) {
      return this.purge(current, id);
    }
    return this.softDeleteIfNoHistory(current, id);
  }

  /**
   * 기본 삭제: 평가 이력 참조 카운트 → 하나라도 >0 이면 409 차단(비활성 보존).
   * 이력 0이면: notifications 삭제 · auditLogs.userId=null · reports.managerId=null · user 삭제.
   */
  private async softDeleteIfNoHistory(current: AuthUser, id: string) {
    const refs = await this.countHistory(id);
    const total = Object.values(refs).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const details = Object.entries(refs)
        .filter(([, n]) => n > 0)
        .map(([key, count]) => ({ key, count }));
      throw new ConflictException({
        code: 'CONFLICT',
        message:
          '평가 이력이 있어 삭제할 수 없어요. 비활성으로 보존되며, 완전 삭제를 원하면 이력 포함 삭제를 사용하세요.',
        details,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.user.delete({ where: { id } });
    });

    await this.audit.record({
      entity: 'user',
      entityId: id,
      action: 'user.delete',
      actorId: current.id,
      before: { purged: false },
    });
    return { id };
  }

  /**
   * 완전 삭제(force): 트랜잭션으로 종속 전부 삭제(FK 의존 순서).
   * Cascade 걸린 하위(KpiScore·Comment·Achievement·Review·CompetencyResponse)는 부모 삭제로 자동 정리.
   */
  private async purge(current: AuthUser, id: string) {
    await this.prisma.$transaction(async (tx) => {
      // 1) 사용자가 작성자/평가자로 참여한 자식 레코드부터(부모 FK Restrict 우회).
      await tx.comment.deleteMany({ where: { authorId: id } });
      await tx.review.deleteMany({ where: { authorId: id } });
      // 2) 이의제기: 응답자/결정자 참조 해제 후, 본인 신청 이의제기 삭제.
      await tx.appeal.updateMany({ where: { respondedById: id }, data: { respondedById: null } });
      await tx.appeal.updateMany({ where: { decidedById: id }, data: { decidedById: null } });
      await tx.appeal.deleteMany({ where: { userId: id } });
      // 3) 평가(KpiScore·Comment cascade) — evaluator/evaluatee 양쪽.
      await tx.evaluation.deleteMany({
        where: { OR: [{ evaluatorId: id }, { evaluateeId: id }] },
      });
      // 4) 결과·보상.
      await tx.evaluationResult.deleteMany({ where: { userId: id } });
      await tx.compensation.deleteMany({ where: { userId: id } });
      // 5) KPI(Achievement·Review·KpiScore cascade) — 단, 다른 KPI의 parentKpiId 참조 해제.
      const kpiIds = (
        await tx.kpi.findMany({ where: { userId: id }, select: { id: true } })
      ).map((k) => k.id);
      if (kpiIds.length) {
        await tx.kpi.updateMany({
          where: { parentKpiId: { in: kpiIds } },
          data: { parentKpiId: null },
        });
        await tx.kpi.deleteMany({ where: { userId: id } });
      }
      // 6) 역량(응답 cascade) · 월별실적 · 스냅샷.
      await tx.competencyResponse.deleteMany({ where: { userId: id } });
      await tx.competencyQuestion.deleteMany({ where: { createdById: id } });
      await tx.monthlyPerformance.deleteMany({ where: { enteredById: id } });
      await tx.kpiSnapshot.deleteMany({ where: { userId: id } });
      // 7) 알림 · 감사로그 익명화 · 부하 관리자 해제.
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
      // 8) 사용자 삭제.
      await tx.user.delete({ where: { id } });
    });

    await this.audit.record({
      entity: 'user',
      entityId: id,
      action: 'user.purge',
      actorId: current.id,
      before: { purged: true },
    });
    return { id, purged: true };
  }

  /** 평가 이력 참조 카운트(기본 삭제 차단 판정용). */
  private async countHistory(id: string): Promise<Record<string, number>> {
    const [
      results,
      evaluationsAsEvaluator,
      evaluationsAsEvaluatee,
      kpis,
      compensations,
      appeals,
      competencyResponses,
      monthlyPerformances,
      kpiSnapshots,
      reviews,
      comments,
      competencyQuestions,
    ] = await Promise.all([
      this.prisma.evaluationResult.count({ where: { userId: id } }),
      this.prisma.evaluation.count({ where: { evaluatorId: id } }),
      this.prisma.evaluation.count({ where: { evaluateeId: id } }),
      this.prisma.kpi.count({ where: { userId: id } }),
      this.prisma.compensation.count({ where: { userId: id } }),
      this.prisma.appeal.count({ where: { userId: id } }),
      this.prisma.competencyResponse.count({ where: { userId: id } }),
      this.prisma.monthlyPerformance.count({ where: { enteredById: id } }),
      this.prisma.kpiSnapshot.count({ where: { userId: id } }),
      this.prisma.review.count({ where: { authorId: id } }),
      this.prisma.comment.count({ where: { authorId: id } }),
      this.prisma.competencyQuestion.count({ where: { createdById: id } }),
    ]);
    return {
      results,
      evaluations: evaluationsAsEvaluator + evaluationsAsEvaluatee,
      kpis,
      compensations,
      appeals,
      competencyResponses,
      monthlyPerformances,
      kpiSnapshots,
      reviews,
      comments,
      competencyQuestions,
    };
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
