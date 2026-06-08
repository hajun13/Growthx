import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CycleStatus, CycleType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { assertTransition, CYCLE_TRANSITIONS } from '../../common/state/transitions';
import { EvaluationsService } from '../evaluations/evaluations.service';
import {
  CreateCycleDto,
  ListCyclesQuery,
  UpdateCycleDto,
  UpdateCycleStatusDto,
} from './dto/cycle.dto';

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluations: EvaluationsService,
    private readonly audit: AuditService,
  ) {}

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
        cycleType: dto.cycleType ?? CycleType.FINAL,
      },
    });
  }

  async update(id: string, dto: UpdateCycleDto) {
    await this.get(id);
    return this.prisma.evaluationCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.year !== undefined && { year: dto.year }),
      },
    });
  }

  async updateStatus(id: string, dto: UpdateCycleStatusDto) {
    const cycle = await this.get(id);
    assertTransition(CYCLE_TRANSITIONS, cycle.status, dto.status);
    const updated = await this.prisma.evaluationCycle.update({
      where: { id },
      data: { status: dto.status },
    });

    // 평가가 시작되는 상태(draft → active)로 전이되면 부서장(downward) 평가를 자동 배정.
    // 멱등하므로 재전이/재배정에도 안전(이미 있는 round 는 skip).
    if (dto.status === CycleStatus.active) {
      await this.evaluations.autoAssignDownward(id);
    }

    return updated;
  }

  /**
   * 주기 삭제. 완료(closed) 주기는 보존 정책상 삭제 불가.
   * cascade 미설정 자식(평가·KPI·결과·보상 등)은 트랜잭션에서 FK 역순으로 직접 삭제하고,
   * onDelete:Cascade 자식(일정·스냅샷·월실적·역량)은 주기 삭제 시 DB가 자동 정리한다.
   * RuleSet 은 주기 전용 사본이므로 함께 삭제한다.
   */
  async remove(id: string, actor?: AuthUser) {
    const cycle = await this.get(id);
    if (cycle.status === CycleStatus.closed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '완료된 평가 주기는 삭제할 수 없어요.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // 1) 결과 트리(이의제기 → 결과)
      await tx.appeal.deleteMany({ where: { result: { cycleId: id } } });
      await tx.evaluationResult.deleteMany({ where: { cycleId: id } });
      // 2) 보상
      await tx.compensation.deleteMany({ where: { cycleId: id } });
      // 3) 평가(→ KpiScore·Comment 는 cascade)
      await tx.evaluation.deleteMany({ where: { cycleId: id } });
      // 4) KPI(→ Achievement·Review 는 cascade)
      await tx.kpi.deleteMany({ where: { cycleId: id } });
      // 5) 양식(→ KpiTemplateItem 은 cascade)
      await tx.kpiTemplate.deleteMany({ where: { cycleId: id } });
      // 6) 등급 풀·그룹 실적
      await tx.gradePool.deleteMany({ where: { cycleId: id } });
      await tx.groupPerformance.deleteMany({ where: { cycleId: id } });
      // 7) 주기 삭제 — CycleSchedule·KpiSnapshot·MonthlyPerformance·
      //    CompetencyQuestion·CompetencyResponse 는 onDelete:Cascade 로 자동 정리.
      await tx.evaluationCycle.delete({ where: { id } });
      // 8) 주기 전용 RuleSet 사본 정리(없어도 무방).
      if (cycle.ruleSetId) {
        await tx.ruleSet.deleteMany({ where: { id: cycle.ruleSetId } });
      }
    });

    await this.audit.record({
      entity: 'EvaluationCycle',
      entityId: id,
      action: 'cycle.delete',
      actorId: actor?.id,
      before: { name: cycle.name, year: cycle.year, status: cycle.status },
    });

    return { data: { id, deleted: true } };
  }
}
