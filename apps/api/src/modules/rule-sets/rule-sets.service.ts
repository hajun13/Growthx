import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { CreateRuleSetDto, UpdateRuleSetDto } from './dto/rule-set.dto';

@Injectable()
export class RuleSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.ruleSet.findMany({ orderBy: { createdAt: 'desc' } });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  async get(id: string) {
    const rs = await this.prisma.ruleSet.findUnique({ where: { id } });
    if (!rs) throw new NotFoundException({ code: 'NOT_FOUND', message: '규칙 세트를 찾을 수 없어요.' });
    return rs;
  }

  async create(dto: CreateRuleSetDto, actor?: AuthUser) {
    // 전 필드 검증(가중치 합·정성 상한·등급 구간 단조성·풀 비율 합).
    this.scoring.validateRuleSet({
      gradeScale: dto.gradeScale,
      gradingScales: dto.gradingScales,
      poolRatios: dto.poolRatios,
      raiseRates: dto.raiseRates,
      weightPolicy: dto.weightPolicy,
    });
    const created = await this.prisma.ruleSet.create({
      data: {
        cycleId: dto.cycleId ?? null,
        gradeScale: dto.gradeScale as Prisma.InputJsonValue,
        gradingScales: dto.gradingScales as Prisma.InputJsonValue,
        poolRatios: dto.poolRatios as Prisma.InputJsonValue,
        raiseRates: dto.raiseRates as Prisma.InputJsonValue,
        weightPolicy: dto.weightPolicy as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      entity: 'RuleSet',
      entityId: created.id,
      action: 'rule_set.create',
      actorId: actor?.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateRuleSetDto, actor?: AuthUser) {
    const before = await this.get(id);
    // 제공된 필드만 검증(부분 PATCH 지원).
    this.scoring.validateRuleSet({
      gradeScale: dto.gradeScale,
      gradingScales: dto.gradingScales,
      poolRatios: dto.poolRatios,
      raiseRates: dto.raiseRates,
      weightPolicy: dto.weightPolicy,
    });
    const updated = await this.prisma.ruleSet.update({
      where: { id },
      data: {
        gradeScale: (dto.gradeScale as Prisma.InputJsonValue) ?? undefined,
        gradingScales: (dto.gradingScales as Prisma.InputJsonValue) ?? undefined,
        poolRatios: (dto.poolRatios as Prisma.InputJsonValue) ?? undefined,
        raiseRates: (dto.raiseRates as Prisma.InputJsonValue) ?? undefined,
        weightPolicy: (dto.weightPolicy as Prisma.InputJsonValue) ?? undefined,
      },
    });
    await this.audit.record({
      entity: 'RuleSet',
      entityId: id,
      action: 'rule_set.update',
      actorId: actor?.id,
      before,
      after: updated,
    });
    return updated;
  }
}
