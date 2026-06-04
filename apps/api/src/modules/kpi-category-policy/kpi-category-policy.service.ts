import { Injectable, NotFoundException } from '@nestjs/common';
import { KpiCategory, Position } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  defaultAllowedCategories,
  POSITION_LABEL,
} from '../../common/access/position.util';
import { AuthUser } from '../../common/decorators/current-user';
import { UpdateKpiCategoryPolicyDto } from './dto/kpi-category-policy.dto';

const ALL_POSITIONS = Object.values(Position);

/**
 * M3 Item3: 직책×KPI 카테고리 허용 매트릭스.
 * DB 미설정 직책은 defaultAllowedCategories 로 폴백(자동기본).
 */
@Injectable()
export class KpiCategoryPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 전체 매트릭스(전 직책). DB 행 없으면 기본값으로 채워 반환. */
  async getMatrix() {
    const rows = await this.prisma.kpiCategoryPolicy.findMany();
    const byPos = new Map(rows.map((r) => [r.position, r.allowed as KpiCategory[]]));
    const matrix = ALL_POSITIONS.map((position) => ({
      position,
      label: POSITION_LABEL[position],
      allowed: byPos.get(position) ?? defaultAllowedCategories(position),
    }));
    return { data: matrix, meta: { total: matrix.length } };
  }

  /** 단일 직책의 허용 카테고리(없으면 기본값). */
  async allowedFor(position: Position): Promise<KpiCategory[]> {
    const row = await this.prisma.kpiCategoryPolicy.findUnique({ where: { position } });
    return (row?.allowed as KpiCategory[]) ?? defaultAllowedCategories(position);
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
    return { data: { position, label: POSITION_LABEL[position], allowed } };
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
