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

    // 비고: 빈 문자열/공백은 null 로 정규화(빈 비고를 저장하지 않음).
    const normNote = (v: string | null | undefined): string | null => {
      const t = v?.trim();
      return t ? t : null;
    };

    /**
     * 단월 저장 — 데이터 손실 가드 3종:
     *  1) 값이 기존 행과 동일하면 아무것도 하지 않는다(final 을 draft 로 강등 금지 — 임시저장이
     *     확정(final)된 월을 파괴하던 결함 수정. 클라이언트가 12개월 전부를 보내도 안전).
     *  2) 전 셀이 빈(null) 월은 행을 생성하지 않는다(미입력 월에 targetAmount=0 오염 행 금지).
     *  3) 전 셀을 비운(클리어) 경우: draft 행·전년(month=0) sentinel 은 삭제해 빈칸을 복원하고,
     *     확정(final) 월 행은 건드리지 않는다(빈 페이로드로 확정 데이터를 지울 수 없음 —
     *     확정 월 변경은 명시적 값 입력 후 재확정으로만).
     * 값이 실제로 바뀐 경우에만 편집=미확정(draft) 정책대로 status 를 draft 로 내린다.
     * 반환: 쓰기(생성/갱신/삭제)가 일어났으면 true.
     */
    const upsertOne = async (
      tx: Prisma.TransactionClient,
      month: number,
      year: number,
      revenueTarget: number | null,
      revenueActual: number | null,
      costTarget: number | null,
      costActual: number | null,
      revenueNote: string | null = null,
      costNote: string | null = null,
    ): Promise<boolean> => {
      const key = {
        cycleId: dto.cycleId,
        departmentId: dto.departmentId,
        year,
        month,
        category: KpiCategory.revenue,
      };
      const existing = await tx.monthlyPerformance.findUnique({
        where: { cycleId_departmentId_year_month_category: key },
      });
      const isEmpty =
        revenueTarget === null &&
        revenueActual === null &&
        costTarget === null &&
        costActual === null &&
        revenueNote === null &&
        costNote === null;

      // 스키마상 targetAmount/actualAmount 는 non-null — 저장 시에만 0 폴백(빈 월은 애초에 저장 안 함).
      const next = {
        targetAmount: revenueTarget ?? 0,
        actualAmount: revenueActual ?? 0,
        costTarget,
        costActual,
        revenueNote,
        costNote,
      };

      if (!existing) {
        if (isEmpty) return false; // 가드 2: 미입력 월 — 0 행 생성 금지.
        await tx.monthlyPerformance.create({
          data: {
            ...key,
            ...next,
            // 쓰기=임시저장(draft). 사용자가 최종저장(finalize)해야 집계 반영.
            status: 'draft',
            enteredById: current.id,
          },
        });
        return true;
      }

      const unchanged =
        existing.targetAmount === next.targetAmount &&
        existing.actualAmount === next.actualAmount &&
        (existing.costTarget ?? null) === costTarget &&
        (existing.costActual ?? null) === costActual &&
        (existing.revenueNote ?? null) === revenueNote &&
        (existing.costNote ?? null) === costNote;
      if (unchanged) return false; // 가드 1: 변경 없음 — status(final 포함) 유지.

      if (isEmpty) {
        // 가드 3: 전 셀 클리어. 전년 sentinel(month=0, 집계 제외 참고값)과 draft 행은
        // 삭제로 빈칸을 복원(0 저장으로 "영원히 빈칸 복원 불가"가 되던 결함 수정).
        // 확정(final) 월 행은 빈 페이로드로 지울 수 없음 — 보존.
        if (month === PREV_YEAR_MONTH || existing.status === 'draft') {
          await tx.monthlyPerformance.delete({ where: { id: existing.id } });
          return true;
        }
        return false;
      }

      await tx.monthlyPerformance.update({
        where: { id: existing.id },
        data: {
          ...next,
          // 편집=미확정(draft). 재확정은 finalize 로.
          status: 'draft',
          enteredById: current.id,
        },
      });
      return true;
    };

    let upsertedMonths = 0;
    let prevYearSaved = false;

    await this.prisma.$transaction(async (tx) => {
      for (const m of dto.months) {
        const wrote = await upsertOne(
          tx,
          m.month,
          dto.year,
          m.revenueTarget ?? null,
          m.revenueActual ?? null,
          m.costTarget ?? null,
          m.costActual ?? null,
          normNote(m.revenueNote),
          normNote(m.costNote),
        );
        if (wrote) upsertedMonths += 1;
      }
      if (dto.prevYear) {
        // 전년 참고값 — 두 칸 모두 비워 저장하면 sentinel 행 삭제(클리어 가능, 옛 값 부활 방지).
        const p = dto.prevYear;
        prevYearSaved = await upsertOne(
          tx,
          PREV_YEAR_MONTH,
          dto.year - 1,
          p.revenueTarget ?? null,
          p.revenueActual ?? null,
          p.costTarget ?? null,
          p.costActual ?? null,
        );
      }
      // 그룹 실적 캐시(GroupPerformance tier)는 여기서 갱신하지 않는다.
      // bulk 쓰기 = draft(미확정)이므로, DTO 인메모리 값으로 그룹 tier 를 갱신하면
      // finalize 전에 draft 가 등급풀/목표보드에 새어 draft/final 취지가 깨진다.
      // → 그룹 tier 는 finalize(MonthlyPerformanceService)에서 DB final 행 기준으로만 재동기화.
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

    // 편집=all: 경영실적 그리드(편집 뷰)는 draft+final 모두 노출 — 사용자가 자기 임시저장을 편집·확인.
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
