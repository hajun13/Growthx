import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import {
  CreateKpiTemplateDto,
  ListKpiTemplatesQuery,
  UpdateKpiTemplateDto,
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

  async get(id: string) {
    const tpl = await this.prisma.kpiTemplate.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!tpl) throw new NotFoundException({ code: 'NOT_FOUND', message: 'KPI 양식을 찾을 수 없어요.' });
    return tpl;
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

  /** 양식 항목 전체 교체. 가중치 합·정성 상한 재검증. */
  async update(id: string, dto: UpdateKpiTemplateDto) {
    const tpl = await this.get(id);
    if (!dto.items) return tpl;

    const rules = await this.scoring.loadRuleSetForCycle(tpl.cycleId);
    this.scoring.validateWeights(
      dto.items.map((i) => ({ weight: i.defaultWeight, isQualitative: i.isQualitative })),
      rules.weightPolicy,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.kpiTemplateItem.deleteMany({ where: { templateId: id } });
      await tx.kpiTemplateItem.createMany({
        data: dto.items!.map((i) => ({
          templateId: id,
          category: i.category,
          group: i.group,
          sampleStrategy: i.sampleStrategy ?? null,
          defaultMeasureType: i.defaultMeasureType,
          defaultWeight: i.defaultWeight,
          isQualitative: i.isQualitative,
        })),
      });
    });

    return this.prisma.kpiTemplate.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.kpiTemplateItem.deleteMany({ where: { templateId: id } }),
      this.prisma.kpiTemplate.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }
}
