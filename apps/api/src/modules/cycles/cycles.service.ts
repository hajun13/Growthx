import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTransition, CYCLE_TRANSITIONS } from '../../common/state/transitions';
import {
  CreateCycleDto,
  ListCyclesQuery,
  UpdateCycleStatusDto,
} from './dto/cycle.dto';

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCyclesQuery) {
    const where: Prisma.EvaluationCycleWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.year) where.year = Number(query.year);
    const rows = await this.prisma.evaluationCycle.findMany({
      where,
      orderBy: { year: 'desc' },
    });
    return {
      data: rows,
      meta: { page: 1, pageSize: rows.length, total: rows.length },
    };
  }

  async get(id: string) {
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id } });
    if (!cycle) throw new NotFoundException({ code: 'NOT_FOUND', message: '주기를 찾을 수 없어요.' });
    return cycle;
  }

  /**
   * 주기 생성. ruleSetId 미지정 시 기본 RuleSet(2026 글로벌 default)을 복제해 자동 연결(A 요구).
   * → 활성 주기에 RuleSet 미연결로 placeholder 만 뜨던 결함 해소.
   */
  async create(dto: CreateCycleDto) {
    let ruleSetId = dto.ruleSetId ?? null;
    if (!ruleSetId) {
      const base = await this.prisma.ruleSet.findFirst({
        where: { cycleId: null },
        orderBy: { createdAt: 'desc' },
      });
      if (base) {
        const cloned = await this.prisma.ruleSet.create({
          data: {
            cycleId: null, // 1:1 관계는 cycle.ruleSetId 로 연결됨
            gradeScale: base.gradeScale as Prisma.InputJsonValue,
            gradingScales: base.gradingScales as Prisma.InputJsonValue,
            poolRatios: base.poolRatios as Prisma.InputJsonValue,
            raiseRates: base.raiseRates as Prisma.InputJsonValue,
            weightPolicy: base.weightPolicy as Prisma.InputJsonValue,
          },
        });
        ruleSetId = cloned.id;
      }
    }
    return this.prisma.evaluationCycle.create({
      data: {
        name: dto.name,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ruleSetId,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateCycleStatusDto) {
    const cycle = await this.get(id);
    assertTransition(CYCLE_TRANSITIONS, cycle.status, dto.status);
    return this.prisma.evaluationCycle.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
