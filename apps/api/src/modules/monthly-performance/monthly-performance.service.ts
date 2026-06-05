import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MeasureType, MonthlyPerformance, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { VisibilityScope } from '@prisma/client';
import { isDepartmentUnder, visibleDeptIds } from '../../common/access/access.util';
import {
  CreateMonthlyPerformanceDto,
  ListMonthlyPerformanceQuery,
  MonthlyPerformanceSummaryQuery,
  UpdateMonthlyPerformanceDto,
} from './dto/monthly-performance.dto';

/**
 * 월별 실적 입력 (M3 Item 4).
 * 그룹/본부의 월별 목표·실적을 카테고리별로 입력 → 누적 달성률 + 현재 등급 산출.
 * 권한: hr_admin 전체 입력, division_head 본인 본부만, team_lead 조회만.
 */
@Injectable()
export class MonthlyPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
  ) {}

  async list(current: AuthUser, query: ListMonthlyPerformanceQuery) {
    const where: Prisma.MonthlyPerformanceWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.year) where.year = Number(query.year);
    if (query.category) where.category = query.category;

    // 읽기 스코프 강제:
    //  - departmentId 지정 시: 가시 범위 안인지 검증(아니면 403).
    //  - 미지정 시: hr_admin/company 는 전체, 그 외는 가시 부서로 한정(임의 전사 조회 차단).
    if (query.departmentId) {
      await this.assertReadAccess(current, query.departmentId);
      where.departmentId = query.departmentId;
    } else if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      // 이 분기에서는 deptIds 가 null 이 아님(hr_admin/company 제외). 가시 부서로 한정.
      if (deptIds !== null) where.departmentId = { in: deptIds };
    }

    const rows = await this.prisma.monthlyPerformance.findMany({
      where,
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    const data = rows.map((r) => this.toDto(r));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async create(current: AuthUser, dto: CreateMonthlyPerformanceDto) {
    await this.assertWriteAccess(current, dto.departmentId);

    const row = await this.prisma.monthlyPerformance.upsert({
      where: {
        cycleId_departmentId_year_month_category: {
          cycleId: dto.cycleId,
          departmentId: dto.departmentId,
          year: dto.year,
          month: dto.month,
          category: dto.category,
        },
      },
      create: {
        cycleId: dto.cycleId,
        departmentId: dto.departmentId,
        year: dto.year,
        month: dto.month,
        category: dto.category,
        targetAmount: dto.targetAmount,
        actualAmount: dto.actualAmount,
        enteredById: current.id,
      },
      update: {
        targetAmount: dto.targetAmount,
        actualAmount: dto.actualAmount,
        enteredById: current.id,
      },
    });
    await this.audit.record({
      entity: 'MonthlyPerformance',
      entityId: row.id,
      action: 'monthly_performance.upsert',
      actorId: current.id,
      after: { ...dto },
    });
    return this.toDto(row);
  }

  async update(current: AuthUser, id: string, dto: UpdateMonthlyPerformanceDto) {
    const row = await this.findOrThrow(id);
    await this.assertWriteAccess(current, row.departmentId);
    const updated = await this.prisma.monthlyPerformance.update({
      where: { id },
      data: {
        targetAmount: dto.targetAmount ?? undefined,
        actualAmount: dto.actualAmount ?? undefined,
      },
    });
    await this.audit.record({
      entity: 'MonthlyPerformance',
      entityId: id,
      action: 'monthly_performance.update',
      actorId: current.id,
      before: { targetAmount: row.targetAmount, actualAmount: row.actualAmount },
      after: { targetAmount: updated.targetAmount, actualAmount: updated.actualAmount },
    });
    return this.toDto(updated);
  }

  /**
   * 누적 달성률 + 현재 등급 (카테고리별 + 종합).
   * 누적 달성률 = Σ(actualAmount) / Σ(targetAmount) × 100 → amount 달성률표로 Grade 매핑.
   */
  async summary(current: AuthUser, query: MonthlyPerformanceSummaryQuery) {
    await this.assertReadAccess(current, query.departmentId);
    const rows = await this.prisma.monthlyPerformance.findMany({
      where: { cycleId: query.cycleId, departmentId: query.departmentId },
    });
    const rules = await this.scoring.loadRuleSetForCycle(query.cycleId);

    const dept = await this.prisma.department.findUnique({
      where: { id: query.departmentId },
    });

    // 카테고리별 누적.
    const byCategoryMap = new Map<
      string,
      { targetTotal: number; actualTotal: number }
    >();
    let targetTotal = 0;
    let actualTotal = 0;
    for (const r of rows) {
      targetTotal += r.targetAmount;
      actualTotal += r.actualAmount;
      const bucket = byCategoryMap.get(r.category) ?? {
        targetTotal: 0,
        actualTotal: 0,
      };
      bucket.targetTotal += r.targetAmount;
      bucket.actualTotal += r.actualAmount;
      byCategoryMap.set(r.category, bucket);
    }

    const rate = (actual: number, target: number) =>
      target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;

    const byCategory = Array.from(byCategoryMap.entries()).map(
      ([category, b]) => {
        const achievementRate = rate(b.actualTotal, b.targetTotal);
        return {
          category,
          targetAmount: Math.round(b.targetTotal * 100) / 100,
          actualAmount: Math.round(b.actualTotal * 100) / 100,
          achievementRate,
          currentGrade: this.scoring.measureToGrade(
            MeasureType.amount,
            achievementRate,
            rules.gradingScales,
            null,
            null,
          ),
        };
      },
    );

    // 월별 트렌드(전체 카테고리 합산 기준 누적).
    const monthMap = new Map<number, { target: number; actual: number }>();
    for (const r of rows) {
      const m = monthMap.get(r.month) ?? { target: 0, actual: 0 };
      m.target += r.targetAmount;
      m.actual += r.actualAmount;
      monthMap.set(r.month, m);
    }
    let cumTarget = 0;
    let cumActual = 0;
    const monthlyTrend: {
      month: number;
      achievementRate: number;
      grade: string;
    }[] = [];
    for (let month = 1; month <= 12; month++) {
      const m = monthMap.get(month);
      if (!m) continue;
      cumTarget += m.target;
      cumActual += m.actual;
      const achievementRate = rate(cumActual, cumTarget);
      monthlyTrend.push({
        month,
        achievementRate,
        grade: this.scoring.measureToGrade(
          MeasureType.amount,
          achievementRate,
          rules.gradingScales,
          null,
          null,
        ),
      });
    }

    const overallRate = rate(actualTotal, targetTotal);
    const overallGrade = this.scoring.measureToGrade(
      MeasureType.amount,
      overallRate,
      rules.gradingScales,
      null,
      null,
    );

    return {
      data: {
        cycleId: query.cycleId,
        departmentId: query.departmentId,
        departmentName: dept?.name ?? null,
        targetAmount: Math.round(targetTotal * 100) / 100,
        actualAmount: Math.round(actualTotal * 100) / 100,
        achievementRate: overallRate,
        currentGrade: overallGrade,
        byCategory,
        monthlyTrend,
      },
    };
  }

  // ── helpers ──
  private async findOrThrow(id: string): Promise<MonthlyPerformance> {
    const row = await this.prisma.monthlyPerformance.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '월별 실적을 찾을 수 없어요.',
      });
    }
    return row;
  }

  /**
   * 읽기 권한: hr_admin·company scope 전체.
   * 그 외(division_head/team_lead/employee)는 요청한 departmentId 가 본인 가시 범위 안일 때만.
   * 가시 범위 = visibleDeptIds(부서 트리 스코프) 또는 본인 부서 하위 트리.
   */
  private async assertReadAccess(
    current: AuthUser,
    departmentId: string,
  ): Promise<void> {
    if (current.role === Role.hr_admin || current.scope === VisibilityScope.company) return;
    const deptIds = await visibleDeptIds(this.prisma, current);
    if (deptIds === null) return; // company 동등
    const within =
      deptIds.includes(departmentId) ||
      current.departmentId === departmentId ||
      (await isDepartmentUnder(this.prisma, departmentId, current.departmentId));
    if (within) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: '해당 부서의 월별 실적 조회 권한이 없어요.',
    });
  }

  /** 쓰기 권한: hr_admin·ceo 전체. division_head 는 본인 본부(하위 트리) 한정. 그 외 거부. */
  private async assertWriteAccess(
    current: AuthUser,
    departmentId: string,
  ): Promise<void> {
    if (current.role === Role.hr_admin) return;
    // ceo position 사용자도 전체 쓰기 허용 — DB 조회로 position 확인.
    const dbUser = await this.prisma.user.findUnique({ where: { id: current.id }, select: { position: true } });
    if (dbUser?.position === 'ceo') return;
    if (current.role === Role.division_head) {
      const within =
        current.departmentId === departmentId ||
        (await isDepartmentUnder(this.prisma, departmentId, current.departmentId));
      if (within) return;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: '월별 실적 입력 권한이 없어요.',
    });
  }

  private toDto(r: MonthlyPerformance) {
    return {
      id: r.id,
      cycleId: r.cycleId,
      departmentId: r.departmentId,
      year: r.year,
      month: r.month,
      category: r.category,
      targetAmount: r.targetAmount,
      actualAmount: r.actualAmount,
      achievementRate:
        r.targetAmount > 0
          ? Math.round((r.actualAmount / r.targetAmount) * 1000) / 10
          : 0,
      enteredById: r.enteredById,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
