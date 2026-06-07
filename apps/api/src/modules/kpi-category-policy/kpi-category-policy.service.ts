import { Injectable, NotFoundException } from '@nestjs/common';
import { KpiCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  Position,
  defaultAllowedCategories,
  POSITION_LABEL,
} from '../../common/access/position.util';
import { AuthUser } from '../../common/decorators/current-user';
import { UpdateKpiCategoryPolicyDto } from './dto/kpi-category-policy.dto';

/**
 * M3 Item3: 직책×KPI 카테고리 허용 매트릭스.
 * 직책 목록은 레지스트리(PositionDef)에서 읽는다(B-7). DB 미설정 직책은
 * isManagement 기준 기본값으로 폴백(직책자=전 카테고리, 비직책자=revenue·orders 차단).
 */
@Injectable()
export class KpiCategoryPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly ALL_CATS: KpiCategory[] = [
    KpiCategory.revenue,
    KpiCategory.construction,
    KpiCategory.orders,
    KpiCategory.collaboration,
    KpiCategory.development,
  ];
  private readonly NON_MGMT_CATS: KpiCategory[] = [
    KpiCategory.construction,
    KpiCategory.collaboration,
    KpiCategory.development,
  ];

  /** 전체 매트릭스(레지스트리 직책 전체). DB 행 없으면 기본값으로 채워 반환. */
  async getMatrix() {
    const [defs, rows] = await Promise.all([
      this.prisma.positionDef.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.kpiCategoryPolicy.findMany(),
    ]);
    const byPos = new Map(rows.map((r) => [r.position, r.allowed as KpiCategory[]]));
    const matrix = defs.map((d) => ({
      position: d.code,
      label: d.label ?? POSITION_LABEL[d.code] ?? d.code,
      allowed: byPos.get(d.code) ?? (d.isManagement ? this.ALL_CATS : this.NON_MGMT_CATS),
    }));
    return { data: matrix, meta: { total: matrix.length } };
  }

  /** 단일 직책의 허용 카테고리(없으면 레지스트리/시스템 기본값). */
  async allowedFor(position: Position): Promise<KpiCategory[]> {
    const row = await this.prisma.kpiCategoryPolicy.findUnique({ where: { position } });
    if (row?.allowed) return row.allowed as KpiCategory[];
    const def = await this.prisma.positionDef.findUnique({ where: { code: position } });
    if (def) return def.isManagement ? this.ALL_CATS : this.NON_MGMT_CATS;
    return defaultAllowedCategories(position);
  }

  /** 직책 라벨(레지스트리 우선 → 정적맵 → 코드). */
  private async labelFor(position: Position): Promise<string> {
    const def = await this.prisma.positionDef.findUnique({ where: { code: position } });
    return def?.label ?? POSITION_LABEL[position] ?? position;
  }

  /** KPI 작성용: 사용자 또는 직책의 허용 카테고리. */
  async allowedForUserOrPosition(opts: { userId?: string; position?: Position }) {
    let position = opts.position;
    if (!position && opts.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: opts.userId },
        select: { position: true },
      });
      if (!user) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '사용자를 찾을 수 없어요.' });
      }
      position = user.position;
    }
    if (!position) {
      throw new NotFoundException({
        code: 'VALIDATION_ERROR',
        message: 'userId 또는 position 이 필요해요.',
      });
    }
    const allowed = await this.allowedFor(position);
    const label = await this.labelFor(position);
    return { data: { position, label, allowed } };
  }

  /** 매트릭스 부분 갱신(전달된 직책만 upsert). hr_admin. */
  async update(current: AuthUser, dto: UpdateKpiCategoryPolicyDto) {
    for (const entry of dto.entries) {
      const before = await this.prisma.kpiCategoryPolicy.findUnique({
        where: { position: entry.position },
      });
      await this.prisma.kpiCategoryPolicy.upsert({
        where: { position: entry.position },
        create: { position: entry.position, allowed: entry.allowed },
        update: { allowed: entry.allowed },
      });
      await this.audit.record({
        entity: 'KpiCategoryPolicy',
        entityId: entry.position,
        action: 'kpi_category_policy.update',
        actorId: current.id,
        before: before ? { allowed: before.allowed } : null,
        after: { allowed: entry.allowed },
      });
    }
    return this.getMatrix();
  }
}
