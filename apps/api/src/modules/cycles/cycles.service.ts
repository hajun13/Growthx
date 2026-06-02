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

  async create(dto: CreateCycleDto) {
    return this.prisma.evaluationCycle.create({
      data: {
        name: dto.name,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ruleSetId: dto.ruleSetId ?? null,
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
