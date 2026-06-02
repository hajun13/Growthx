import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import {
  CreateKpiTemplateDto,
  ListKpiTemplatesQuery,
} from './dto/kpi-template.dto';

@Injectable()
export class KpiTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  async list(query: ListKpiTemplatesQuery) {
    const where: Prisma.KpiTemplateWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.jobLevel) where.jobLevel = query.jobLevel;
    const rows = await this.prisma.kpiTemplate.findMany({
      where,
      include: { items: true },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  async create(dto: CreateKpiTemplateDto) {
    // 가중치 합=100 · 정성 ≤30% 검증 (RuleSet 정책 경유)
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    this.scoring.validateWeights(
      dto.items.map((i) => ({ weight: i.defaultWeight, isQualitative: i.isQualitative })),
      rules.weightPolicy,
    );

    return this.prisma.kpiTemplate.create({
      data: {
        cycleId: dto.cycleId,
        jobLevel: dto.jobLevel,
        items: {
          create: dto.items.map((i) => ({
            category: i.category,
            group: i.group,
            sampleStrategy: i.sampleStrategy ?? null,
            defaultMeasureType: i.defaultMeasureType,
            defaultWeight: i.defaultWeight,
            isQualitative: i.isQualitative,
          })),
        },
      },
      include: { items: true },
    });
  }
}
