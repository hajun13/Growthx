import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import { CreateSnapshotDto } from './dto/snapshot.dto';

/** 스냅샷 data 에 직렬화되는 KPI 1건. */
interface SnapshotKpi {
  id: string;
  title: string;
  category: string;
  group: string;
  measureType: string;
  targetValue: number | null;
  weight: number;
  isQualitative: boolean;
  status: string;
}

/** diff 비교 대상 필드(Cycle Ops §4). */
const DIFF_FIELDS: (keyof SnapshotKpi)[] = [
  'title',
  'category',
  'group',
  'measureType',
  'targetValue',
  'weight',
  'isQualitative',
];

/** Cycle Ops §4: 1차 확정 KPI 스냅샷 + diff. */
@Injectable()
export class SnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Kpi 행 → SnapshotKpi 직렬화. */
  private toSnapshotKpi(k: {
    id: string;
    title: string;
    category: string;
    group: string;
    measureType: string;
    targetValue: number | null;
    weight: number;
    isQualitative: boolean;
    status: string;
  }): SnapshotKpi {
    return {
      id: k.id,
      title: k.title,
      category: k.category,
      group: k.group,
      measureType: k.measureType,
      targetValue: k.targetValue,
      weight: k.weight,
      isQualitative: k.isQualitative,
      status: k.status,
    };
  }

  private async currentKpis(cycleId: string, userId: string): Promise<SnapshotKpi[]> {
    const rows = await this.prisma.kpi.findMany({
      where: { cycleId, userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toSnapshotKpi(r));
  }

  /** POST /cycles/:id/kpi-snapshots — 대상별 현재 KPI 캡처(label 기준 사용자별 upsert). */
  async create(cycleId: string, dto: CreateSnapshotDto, actor?: AuthUser) {
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException({ code: 'NOT_FOUND', message: '주기를 찾을 수 없어요.' });

    let userIds = dto.userIds;
    if (!userIds || userIds.length === 0) {
      const distinct = await this.prisma.kpi.findMany({
        where: { cycleId },
        select: { userId: true },
        distinct: ['userId'],
      });
      userIds = distinct.map((d) => d.userId);
    }

    let count = 0;
    for (const userId of userIds) {
      const kpis = await this.currentKpis(cycleId, userId);
      // 같은 (cycle,user,label) 재실행 시 덮어쓰기. 복합 유니크가 없으므로 deleteMany→create.
      // BUG-C: create 실패 시 기존 스냅샷만 삭제된 채 끝나지 않도록 트랜잭션으로 원자화.
      await this.prisma.$transaction([
        this.prisma.kpiSnapshot.deleteMany({ where: { cycleId, userId, label: dto.label } }),
        this.prisma.kpiSnapshot.create({
          data: {
            cycleId,
            userId,
            label: dto.label,
            data: kpis as unknown as Prisma.InputJsonValue,
            createdBy: actor?.id ?? null,
          },
        }),
      ]);
      count += 1;
    }

    await this.audit.record({
      entity: 'EvaluationCycle',
      entityId: cycleId,
      action: 'cycle.kpi_snapshot.create',
      actorId: actor?.id,
      after: { label: dto.label, count },
    });

    return { data: { label: dto.label, count } };
  }

  /** 행수준 권한: hr_admin 전체 · 본인 · 상위 평가자(가시 범위). 권한 밖이면 403. */
  private async assertCanView(current: AuthUser, targetUserId: string) {
    const ok = await canViewUser(this.prisma, current, targetUserId);
    if (!ok) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
  }

  /** GET /cycles/:id/kpi-snapshots?userId= — 메타 목록. */
  async list(cycleId: string, userId: string | undefined, current: AuthUser) {
    const targetUserId = userId ?? current.id;
    await this.assertCanView(current, targetUserId);

    const rows = await this.prisma.kpiSnapshot.findMany({
      where: { cycleId, userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    });
    const data = rows.map((r) => ({
      id: r.id,
      label: r.label,
      createdAt: r.createdAt,
      kpiCount: Array.isArray(r.data) ? (r.data as unknown[]).length : 0,
    }));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** GET /cycles/:id/kpi-snapshots/:snapshotId/diff — 스냅샷 vs 현재 KPI diff. */
  async diff(cycleId: string, snapshotId: string, current: AuthUser) {
    const snapshot = await this.prisma.kpiSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot || snapshot.cycleId !== cycleId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '스냅샷을 찾을 수 없어요.' });
    }
    await this.assertCanView(current, snapshot.userId);

    const before: SnapshotKpi[] = Array.isArray(snapshot.data)
      ? (snapshot.data as unknown as SnapshotKpi[])
      : [];
    const after = await this.currentKpis(cycleId, snapshot.userId);

    const beforeById = new Map(before.map((k) => [k.id, k]));
    const afterById = new Map(after.map((k) => [k.id, k]));

    const added = after
      .filter((k) => !beforeById.has(k.id))
      .map((k) => this.shape(k));
    const removed = before
      .filter((k) => !afterById.has(k.id))
      .map((k) => this.shape(k));

    const changed: { id: string; title: string; fields: { field: string; before: unknown; after: unknown }[] }[] = [];
    let unchangedCount = 0;
    for (const b of before) {
      const a = afterById.get(b.id);
      if (!a) continue; // removed
      const fields: { field: string; before: unknown; after: unknown }[] = [];
      for (const f of DIFF_FIELDS) {
        if (b[f] !== a[f]) fields.push({ field: f, before: b[f], after: a[f] });
      }
      if (fields.length) changed.push({ id: a.id, title: a.title, fields });
      else unchangedCount += 1;
    }

    return {
      data: {
        snapshotId: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt,
        userId: snapshot.userId,
        added,
        removed,
        changed,
        unchangedCount,
      },
    };
  }

  /** added/removed 항목의 노출 필드. */
  private shape(k: SnapshotKpi) {
    return {
      id: k.id,
      title: k.title,
      category: k.category,
      group: k.group,
      measureType: k.measureType,
      targetValue: k.targetValue,
      weight: k.weight,
    };
  }
}
