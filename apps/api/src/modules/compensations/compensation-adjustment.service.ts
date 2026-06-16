import { Injectable } from '@nestjs/common';
import { CompensationAdjustment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCompensationAdjustmentDto } from './dto/compensation.dto';

/** 시뮬레이션 병합용 조정 값(자유 메모 포함). buildSimulation 에 주입된다. */
export interface AdjustmentValues {
  adjustmentAmount: number | null;
  promotionPositionCode: string | null;
  incentiveAmount: number | null;
  note: string | null;
}

const EMPTY_ADJUSTMENT: AdjustmentValues = {
  adjustmentAmount: null,
  promotionPositionCode: null,
  incentiveAmount: null,
  note: null,
};

/**
 * 보상 수기 조정(CompensationAdjustment) — 2026 연봉갱신 엑셀(T~AC) 양식.
 * (userId, cycleId) 유니크에 조정분·승격·인센티브·비고를 upsert·일괄 조회한다.
 * 자동 산정(CompensationsService)과 분리된 책임(수기 입력) — 파일당 ~200줄 상한 준수.
 */
@Injectable()
export class CompensationAdjustmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** (userId, cycleId) 멱등 upsert. null 전송 필드는 명시적 클리어, undefined 는 보존하지 않고 그대로 기록. */
  async upsert(dto: UpsertCompensationAdjustmentDto) {
    const data = {
      adjustmentAmount: dto.adjustmentAmount ?? null,
      promotionPositionCode: dto.promotionPositionCode ?? null,
      incentiveAmount: dto.incentiveAmount ?? null,
      note: dto.note ?? null,
    };
    const row = await this.prisma.compensationAdjustment.upsert({
      where: { userId_cycleId: { userId: dto.userId, cycleId: dto.cycleId } },
      create: { userId: dto.userId, cycleId: dto.cycleId, ...data },
      update: data,
    });
    return this.toDto(row);
  }

  /**
   * (cycleId, userIds) 의 조정 행을 1회 조회해 userId→값 맵으로 반환(N+1 금지).
   * 행 없는 user 는 맵에 없음 — 호출부에서 EMPTY_ADJUSTMENT 폴백.
   */
  async mapForUsers(
    cycleId: string,
    userIds: string[],
  ): Promise<Map<string, AdjustmentValues>> {
    const map = new Map<string, AdjustmentValues>();
    if (!userIds.length) return map;
    const rows = await this.prisma.compensationAdjustment.findMany({
      where: { cycleId, userId: { in: userIds } },
    });
    for (const r of rows) map.set(r.userId, this.toValues(r));
    return map;
  }

  /** 단건 조회(없으면 EMPTY_ADJUSTMENT). simulation(단건)용. */
  async valuesFor(cycleId: string, userId: string): Promise<AdjustmentValues> {
    const row = await this.prisma.compensationAdjustment.findUnique({
      where: { userId_cycleId: { userId, cycleId } },
    });
    return row ? this.toValues(row) : { ...EMPTY_ADJUSTMENT };
  }

  static empty(): AdjustmentValues {
    return { ...EMPTY_ADJUSTMENT };
  }

  private toValues(r: CompensationAdjustment): AdjustmentValues {
    return {
      adjustmentAmount: r.adjustmentAmount,
      promotionPositionCode: r.promotionPositionCode,
      incentiveAmount: r.incentiveAmount,
      note: r.note,
    };
  }

  private toDto(r: CompensationAdjustment) {
    return {
      id: r.id,
      userId: r.userId,
      cycleId: r.cycleId,
      adjustmentAmount: r.adjustmentAmount,
      promotionPositionCode: r.promotionPositionCode,
      incentiveAmount: r.incentiveAmount,
      note: r.note,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    };
  }
}
