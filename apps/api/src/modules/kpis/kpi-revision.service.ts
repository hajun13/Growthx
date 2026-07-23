import { BadRequestException, Injectable } from '@nestjs/common';
import { KpiStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';

/**
 * KPI 수정안 검증·적용 공용 서비스(2026-07-23).
 * 중간점검(본인 수정)과 레거시 재조정이 공유한다. 호출자가 스냅샷 라벨과 감사 action 을 정해
 * 넘기므로, 회차별 스냅샷(중간점검)과 날짜별 스냅샷(레거시)이 서로 덮어쓰지 않는다.
 */
export interface KpiRevisionItem {
  kpiId: string;
  targetValue?: number | null;
  targetText?: string | null;
  weight?: number;
}

export interface KpiFieldChange {
  kpiId: string;
  kpiTitle: string;
  field: 'targetValue' | 'targetText' | 'weight';
  before: unknown;
  after: unknown;
}

@Injectable()
export class KpiRevisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 수정안 검증. items 가 비면 통과한다(변경 0건 제출 허용 — 중간점검에서 "코멘트 수용,
   * 목표 조정 불필요" 경로). 레거시 재조정은 호출 전에 자체적으로 1건 이상을 요구한다.
   */
  async validate(cycleId: string, evaluateeId: string, items: KpiRevisionItem[]): Promise<void> {
    if (!items.length) return;

    const kpiIds = items.map((i) => i.kpiId);
    if (new Set(kpiIds).size !== kpiIds.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '같은 KPI가 중복으로 포함됐어요.',
      });
    }

    const targets = await this.prisma.kpi.findMany({ where: { id: { in: kpiIds } } });
    const byId = new Map(targets.map((k) => [k.id, k]));
    for (const item of items) {
      const kpi = byId.get(item.kpiId);
      if (!kpi || kpi.userId !== evaluateeId || kpi.cycleId !== cycleId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '수정 대상 KPI가 해당 구성원·주기에 속하지 않아요.',
        });
      }
      if (kpi.status !== KpiStatus.confirmed) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `확정된 KPI만 수정할 수 있어요. (kpiId=${item.kpiId})`,
        });
      }
      if (!kpi.isQualitative && typeof item.targetValue === 'number' && item.targetValue < 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `정량 목표값은 0 이상이어야 해요. (kpiId=${item.kpiId})`,
        });
      }
    }

    if (items.some((i) => i.weight !== undefined)) {
      const all = await this.prisma.kpi.findMany({
        where: { userId: evaluateeId, cycleId, status: KpiStatus.confirmed },
        select: { id: true, weight: true, isQualitative: true, group: true },
      });
      const weightById = new Map(items.map((i) => [i.kpiId, i.weight]));
      const projected = all.map((k) => ({
        weight: weightById.get(k.id) ?? k.weight,
        isQualitative: k.isQualitative,
        group: k.group as string,
      }));
      const ruleSet = await this.scoring.loadRuleSetForCycle(cycleId);
      this.scoring.validateWeights(projected, ruleSet.weightPolicy);
    }
  }

  /**
   * 실제 반영. 변경이 0건이면 스냅샷·감사 없이 즉시 반환한다.
   * snapshotLabel 은 호출자가 회차 등으로 유일하게 만들어 넘긴다(같은 라벨은 재사용됨).
   */
  async apply(params: {
    actorId: string;
    cycleId: string;
    evaluateeId: string;
    items: KpiRevisionItem[];
    snapshotLabel: string;
    auditAction: string;
    auditContext: Record<string, unknown>;
  }): Promise<{ snapshotId: string | null; changes: KpiFieldChange[] }> {
    const { actorId, cycleId, evaluateeId, items, snapshotLabel } = params;
    if (!items.length) return { snapshotId: null, changes: [] };

    const targets = await this.prisma.kpi.findMany({ where: { id: { in: items.map((i) => i.kpiId) } } });
    const byId = new Map(targets.map((k) => [k.id, k]));

    const changes: KpiFieldChange[] = [];
    for (const item of items) {
      const kpi = byId.get(item.kpiId);
      if (!kpi) continue;
      const push = (field: KpiFieldChange['field'], before: unknown, after: unknown) =>
        changes.push({ kpiId: kpi.id, kpiTitle: kpi.title, field, before, after });
      if (item.targetValue !== undefined && item.targetValue !== kpi.targetValue) {
        push('targetValue', kpi.targetValue, item.targetValue);
      }
      if (item.targetText !== undefined && (item.targetText ?? null) !== kpi.targetText) {
        push('targetText', kpi.targetText, item.targetText ?? null);
      }
      if (item.weight !== undefined && item.weight !== kpi.weight) {
        push('weight', kpi.weight, item.weight);
      }
    }
    if (!changes.length) return { snapshotId: null, changes: [] };

    const changedKpiIds = new Set(changes.map((c) => c.kpiId));
    const beforeKpis = await this.prisma.kpi.findMany({
      where: { cycleId, userId: evaluateeId, status: KpiStatus.confirmed },
      select: {
        id: true,
        title: true,
        weight: true,
        targetText: true,
        targetValue: true,
        group: true,
      },
    });

    const snapshotId = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.kpiSnapshot.findFirst({
        where: { cycleId, userId: evaluateeId, label: snapshotLabel },
        select: { id: true },
      });
      const snap =
        existing ??
        (await tx.kpiSnapshot.create({
          data: {
            cycleId,
            userId: evaluateeId,
            label: snapshotLabel,
            data: beforeKpis as unknown as Prisma.InputJsonValue,
            createdBy: actorId,
          },
          select: { id: true },
        }));
      for (const item of items) {
        if (!changedKpiIds.has(item.kpiId)) continue;
        await tx.kpi.update({
          where: { id: item.kpiId },
          data: {
            targetValue: item.targetValue !== undefined ? item.targetValue : undefined,
            targetText: item.targetText !== undefined ? (item.targetText ?? null) : undefined,
            weight: item.weight !== undefined ? item.weight : undefined,
          },
        });
      }
      return snap.id;
    });

    for (const kpiId of changedKpiIds) {
      const fields = changes.filter((c) => c.kpiId === kpiId);
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const f of fields) {
        before[f.field] = f.before;
        after[f.field] = f.after;
      }
      await this.audit.record({
        entity: 'Kpi',
        entityId: kpiId,
        action: params.auditAction,
        actorId,
        before,
        after: { ...after, ...params.auditContext, snapshotId },
      });
    }

    return { snapshotId, changes };
  }
}
