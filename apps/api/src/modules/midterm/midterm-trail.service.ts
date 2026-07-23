import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { POSITION_LABEL } from '../../common/access/position.util';
import type { KpiFieldChange } from '../kpis/kpi-revision.service';

/** 이력 액션. 화면 타임라인 라벨과 1:1 대응. */
export type MidtermTrailAction =
  | 'commented'
  | 'revised'
  | 'returned'
  | 'approved'
  | 'reopened'
  | 'reassigned';

export interface MidtermTrailView {
  id: string;
  seq: number;
  action: MidtermTrailAction;
  actorId: string;
  actorName: string;
  actorPosition: string | null;
  onBehalfOf: boolean;
  comment: string | null;
  kpiChanges: KpiFieldChange[];
  snapshotId: string | null;
  createdAt: Date;
}

/** 이력 기록·조회. 기록은 항상 상태 전이와 같은 트랜잭션 안에서 이뤄진다. */
@Injectable()
export class MidtermTrailService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 이력 1행 추가. seq 는 해당 리뷰의 마지막 seq+1.
   * 행위자 이름·직책은 인사이동 후에도 "그때 누구였는지"가 남도록 스냅샷 저장한다.
   */
  async record(
    tx: Prisma.TransactionClient,
    params: {
      midtermReviewId: string;
      action: MidtermTrailAction;
      actorId: string;
      onBehalfOf?: boolean;
      comment?: string | null;
      kpiChanges?: KpiFieldChange[];
      snapshotId?: string | null;
    },
  ): Promise<void> {
    const actor = await tx.user.findUnique({
      where: { id: params.actorId },
      select: { name: true, position: true },
    });
    // 직책은 코드(PositionDef.code)로 저장돼 있다 — 표시용 라벨로 바꿔 스냅샷한다.
    // 3단 폴백(레포 관용구, kpi-category-policy.service.ts 와 동일):
    //   PositionDef.label → 시스템 기본 라벨(POSITION_LABEL) → 코드 자체.
    // 2단(레지스트리만)으로 두면 position_defs 에 없는 시스템 코드(예: team_lead)가
    // 그대로 스냅샷돼 타임라인에 "team_lead 홍길동"처럼 영문 코드가 노출된다.
    // 이력 행은 불변 스냅샷이라 한 번 잘못 쓰면 되돌릴 수 없으므로 기록 시점에 바로잡는다.
    const positionDef = actor?.position
      ? await tx.positionDef.findUnique({
          where: { code: actor.position },
          select: { label: true },
        })
      : null;
    const actorPosition = actor?.position
      ? (positionDef?.label ?? POSITION_LABEL[actor.position] ?? actor.position)
      : null;
    const last = await tx.midtermTrail.findFirst({
      where: { midtermReviewId: params.midtermReviewId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    await tx.midtermTrail.create({
      data: {
        midtermReviewId: params.midtermReviewId,
        seq: (last?.seq ?? 0) + 1,
        action: params.action,
        actorId: params.actorId,
        actorName: actor?.name ?? '(알 수 없음)',
        actorPosition,
        onBehalfOf: params.onBehalfOf ?? false,
        comment: params.comment ?? null,
        kpiChanges: (params.kpiChanges as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        snapshotId: params.snapshotId ?? null,
      },
    });
  }

  /** 리뷰 1건의 전체 이력(오래된 순). */
  async list(midtermReviewId: string): Promise<MidtermTrailView[]> {
    const rows = await this.prisma.midtermTrail.findMany({
      where: { midtermReviewId },
      orderBy: { seq: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      seq: r.seq,
      action: r.action as MidtermTrailAction,
      actorId: r.actorId,
      actorName: r.actorName,
      actorPosition: r.actorPosition,
      onBehalfOf: r.onBehalfOf,
      comment: r.comment,
      kpiChanges: Array.isArray(r.kpiChanges) ? (r.kpiChanges as unknown as KpiFieldChange[]) : [],
      snapshotId: r.snapshotId,
      createdAt: r.createdAt,
    }));
  }
}
