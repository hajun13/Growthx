import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';
import {
  CreateAchievementDto,
  ListAchievementsQuery,
} from './dto/achievement.dto';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(current: AuthUser, query: ListAchievementsQuery) {
    const where: Prisma.AchievementWhereInput = {};
    if (query.kpiId) where.kpiId = query.kpiId;
    if (query.quarter) where.quarter = Number(query.quarter);
    const rows = await this.prisma.achievement.findMany({
      where,
      include: { kpi: true },
      orderBy: { quarter: 'asc' },
    });
    // 행 수준 필터
    const visible: typeof rows = [];
    for (const a of rows) {
      if (await canViewUser(this.prisma, current, a.kpi.userId)) visible.push(a);
    }
    return {
      data: visible.map(({ kpi: _kpi, ...rest }) => rest),
      meta: { page: 1, pageSize: visible.length, total: visible.length },
    };
  }

  async create(current: AuthUser, dto: CreateAchievementDto) {
    const kpi = await this.prisma.kpi.findUnique({ where: { id: dto.kpiId } });
    if (!kpi) throw new NotFoundException({ code: 'NOT_FOUND', message: 'KPI를 찾을 수 없어요.' });
    if (kpi.userId !== current.id && current.role !== 'hr_admin') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '본인 KPI 실적만 입력할 수 있어요.' });
    }
    if (!kpi.targetValue || kpi.targetValue === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '목표값이 없는 KPI에는 달성률을 산출할 수 없어요.',
      });
    }

    // 달성률 = 실적 / 목표 × 100 (백엔드 계산)
    const achievementRate =
      Math.round((dto.actualValue / kpi.targetValue) * 100 * 100) / 100;

    return this.prisma.achievement.create({
      data: {
        kpiId: dto.kpiId,
        quarter: dto.quarter,
        actualValue: dto.actualValue,
        achievementRate,
        evidenceUrl: dto.evidenceUrl ?? null,
      },
    });
  }
}
