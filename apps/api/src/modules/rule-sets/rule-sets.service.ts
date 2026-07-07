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
    // weightPolicy 는 통째 교체가 아닌 **부분 머지** — 프론트/외부 소비자가 아는 키만 보내도
    // seed·마이그레이션으로 적재된 미노출 정책 키(예: stageExceptionWeights)가 보존된다.
    // (WeightPolicy 는 [key: string]: unknown 동적 정책 백이라 임의 키 삭제 기능이 없음 — 머지가 안전.)
    const mergedWeightPolicy =
      dto.weightPolicy === undefined
        ? undefined
        : { ...asJsonObject(before.weightPolicy), ...asJsonObject(dto.weightPolicy) };
    // 제공된 필드만 검증(부분 PATCH 지원). weightPolicy 는 실제 저장될 머지 결과를 검증.
    this.scoring.validateRuleSet({
      gradeScale: dto.gradeScale,
      gradingScales: dto.gradingScales,
      poolRatios: dto.poolRatios,
      raiseRates: dto.raiseRates,
      weightPolicy: mergedWeightPolicy,
    });
    const updated = await this.prisma.ruleSet.update({
      where: { id },
      data: {
        gradeScale: (dto.gradeScale as Prisma.InputJsonValue) ?? undefined,
        gradingScales: (dto.gradingScales as Prisma.InputJsonValue) ?? undefined,
        poolRatios: (dto.poolRatios as Prisma.InputJsonValue) ?? undefined,
        raiseRates: (dto.raiseRates as Prisma.InputJsonValue) ?? undefined,
        weightPolicy: (mergedWeightPolicy as Prisma.InputJsonValue) ?? undefined,
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

/** JSON 값이 평면 객체면 그대로, 아니면(null·배열·원시) 빈 객체 — weightPolicy 머지 base 용. */
function asJsonObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
