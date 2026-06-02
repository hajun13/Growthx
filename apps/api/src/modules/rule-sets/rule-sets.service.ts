import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRuleSetDto, UpdateRuleSetDto } from './dto/rule-set.dto';

@Injectable()
export class RuleSetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.ruleSet.findMany({ orderBy: { createdAt: 'desc' } });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  async get(id: string) {
    const rs = await this.prisma.ruleSet.findUnique({ where: { id } });
    if (!rs) throw new NotFoundException({ code: 'NOT_FOUND', message: '규칙 세트를 찾을 수 없어요.' });
    return rs;
  }

  async create(dto: CreateRuleSetDto) {
    return this.prisma.ruleSet.create({
      data: {
        cycleId: dto.cycleId ?? null,
        gradeScale: dto.gradeScale as Prisma.InputJsonValue,
        gradingScales: dto.gradingScales as Prisma.InputJsonValue,
        poolRatios: dto.poolRatios as Prisma.InputJsonValue,
        raiseRates: dto.raiseRates as Prisma.InputJsonValue,
        weightPolicy: dto.weightPolicy as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateRuleSetDto) {
    await this.get(id);
    return this.prisma.ruleSet.update({
      where: { id },
      data: {
        gradeScale: (dto.gradeScale as Prisma.InputJsonValue) ?? undefined,
        gradingScales: (dto.gradingScales as Prisma.InputJsonValue) ?? undefined,
        poolRatios: (dto.poolRatios as Prisma.InputJsonValue) ?? undefined,
        raiseRates: (dto.raiseRates as Prisma.InputJsonValue) ?? undefined,
        weightPolicy: (dto.weightPolicy as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
