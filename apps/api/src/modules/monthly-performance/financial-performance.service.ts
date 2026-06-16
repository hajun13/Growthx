import { Injectable } from '@nestjs/common';
import { KpiCategory, MonthlyPerformance, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { MonthlyPerformanceService } from './monthly-performance.service';
import {
  FinancialGridQuery,
  FinancialPerformanceBulkDto,
} from './dto/financial-performance.dto';
import { buildFinancialGrid } from './financial-grid.builder';

/** 전년도(2024) 연간 참고값 sentinel 행의 month 값(집계 제외). */
const PREV_YEAR_MONTH = 0;

/**
 * 경영실적(월별 손익) — 엑셀 양식("2025년 경영실적") 기반 일괄 적재 + 그리드 조회.
 * 저장 입력값은 매출(revenue=target/actualAmount) + 원가(cost=costTarget/costActual)뿐.
 * 매출총이익/율/년계는 그리드 응답에서 파생(저장 안 함). 전년(2024)은 month=0 sentinel.
 * category 는 항상 revenue 단일 행(매출+원가를 한 행에 담음) — 대시보드/summary 매출 소스 보존.
 */
@Injectable()
export class FinancialPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly base: MonthlyPerformanceService,
  ) {}

  /** 부서·연도 단위 일괄 upsert(트랜잭션). 월별 매출/원가 + 전년 참고. */
  async bulkUpsert(current: AuthUser, dto: FinancialPerformanceBulkDto) {
    await this.base.assertWriteAccess(current, dto.departmentId);

    const upsertOne = (
      tx: Prisma.TransactionClient,
      month: number,
      year: number,
      revenueTarget: number,
      revenueActual: number,
      costTarget: number | null,
      costActual: number | null,
    ) =>
      tx.monthlyPerformance.upsert({
        where: {
          cycleId_departmentId_year_month_category: {
            cycleId: dto.cycleId,
            departmentId: dto.departmentId,
            year,
            month,
            category: KpiCategory.revenue,
          },
        },
        create: {
          cycleId: dto.cycleId,
          departmentId: dto.departmentId,
          year,
          month,
          category: KpiCategory.revenue,
          targetAmount: revenueTarget,
          actualAmount: revenueActual,
          costTarget,
          costActual,
          enteredById: current.id,
        },
        update: {
          targetAmount: revenueTarget,
          actualAmount: revenueActual,
          costTarget,
          costActual,
          enteredById: current.id,
        },
      });

    let upsertedMonths = 0;
    let prevYearSaved = false;

    await this.prisma.$transaction(async (tx) => {
      for (const m of dto.months) {
        await upsertOne(
          tx,
          m.month,
          dto.year,
          m.revenueTarget ?? 0,
          m.revenueActual ?? 0,
          m.costTarget ?? null,
          m.costActual ?? null,
        );
        upsertedMonths += 1;
      }
      if (dto.prevYear) {
        const p = dto.prevYear;
        await upsertOne(
          tx,
          PREV_YEAR_MONTH,
          dto.year - 1,
          p.revenueTarget ?? 0,
          p.revenueActual ?? 0,
          p.costTarget ?? null,
          p.costActual ?? null,
        );
        prevYearSaved = true;
      }
    });

    await this.audit.record({
      entity: 'MonthlyPerformance',
      entityId: `${dto.departmentId}:${dto.year}`,
      action: 'monthly_performance.upsert',
      actorId: current.id,
      after: {
        cycleId: dto.cycleId,
        departmentId: dto.departmentId,
        year: dto.year,
        upsertedMonths,
        prevYearSaved,
      },
    });

    return {
      data: {
        ok: true,
        cycleId: dto.cycleId,
        departmentId: dto.departmentId,
        year: dto.year,
        upsertedMonths,
        prevYearSaved,
      },
    };
  }

  /** 그리드 조회 — 4행×(2024+12월+년계) 표용. 파생값 포함. */
  async financialGrid(current: AuthUser, query: FinancialGridQuery) {
    await this.base.assertReadAccess(current, query.departmentId);

    const rows: MonthlyPerformance[] =
      await this.prisma.monthlyPerformance.findMany({
        where: {
          cycleId: query.cycleId,
          departmentId: query.departmentId,
          category: KpiCategory.revenue,
          OR: [
            { year: query.year, month: { gte: 1, lte: 12 } },
            { year: query.year - 1, month: PREV_YEAR_MONTH },
          ],
        },
      });

    const dept = await this.prisma.department.findUnique({
      where: { id: query.departmentId },
      select: { name: true },
    });

    return {
      data: buildFinancialGrid({
        cycleId: query.cycleId,
        departmentId: query.departmentId,
        departmentName: dept?.name ?? null,
        year: query.year,
        rows,
      }),
    };
  }
}
