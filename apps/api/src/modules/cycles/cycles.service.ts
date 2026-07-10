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
    return this.prisma.$transaction(async (tx) => {
      let ruleSetId = dto.ruleSetId ?? null;
      let clonedRuleSetId: string | null = null;
      if (!ruleSetId) {
        const base = await tx.ruleSet.findFirst({
          where: { cycleId: null },
          orderBy: { createdAt: 'desc' },
        });
        if (base) {
          const cloned = await tx.ruleSet.create({
            data: {
              cycleId: null, // 생성 직후 아래에서 신규 cycle.id 로 연결
              gradeScale: base.gradeScale as Prisma.InputJsonValue,
              gradingScales: base.gradingScales as Prisma.InputJsonValue,
              poolRatios: base.poolRatios as Prisma.InputJsonValue,
              raiseRates: base.raiseRates as Prisma.InputJsonValue,
              weightPolicy: base.weightPolicy as Prisma.InputJsonValue,
            },
          });
          ruleSetId = cloned.id;
          clonedRuleSetId = cloned.id;
        }
      }
      const cycle = await tx.evaluationCycle.create({
        data: {
          name: dto.name,
          year: dto.year,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          ruleSetId,
          cycleType: dto.cycleType ?? CycleType.FINAL,
          hireCutoffDate: dto.hireCutoffDate ? new Date(dto.hireCutoffDate) : null,
        },
      });
      // 주기 전용 사본은 cycleId 를 연결해 저장 — cycleId:null 로 남기면 scoring 의
      // 글로벌 폴백(cycleId:null 최신 1건)이 "다른 사이클의 사본"을 집어가는 오염 발생.
      if (clonedRuleSetId) {
        await tx.ruleSet.update({
          where: { id: clonedRuleSetId },
          data: { cycleId: cycle.id },
        });
      }
      return cycle;
    });
  }

  async update(id: string, dto: UpdateCycleDto) {
    const cycle = await this.get(id);
    // 완료(closed) 주기의 핵심 메타(year·startDate·endDate)는 변경 불가 —
    // 연도 변경은 보상 체이닝(전년도 연봉 파생)·YoY 비교를 오염시킨다.
    // 프론트가 PATCH 에 전 필드를 항상 담아 보내므로, "값이 실제로 바뀌는 경우"만 차단해
    // 표시용 필드(name 등) 수정은 계속 허용한다.
    if (cycle.status === CycleStatus.closed) {
      const yearChanged = dto.year !== undefined && dto.year !== cycle.year;
      const startChanged =
        dto.startDate !== undefined &&
        new Date(dto.startDate).getTime() !== cycle.startDate.getTime();
      const endChanged =
        dto.endDate !== undefined &&
        new Date(dto.endDate).getTime() !== cycle.endDate.getTime();
      if (yearChanged || startChanged || endChanged) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            '완료된 평가 주기의 연도·시작일·종료일은 변경할 수 없어요. 연도별 비교(YoY)와 보상 산정의 기준이 되기 때문이에요.',
        });
      }
    }
    // 입사일 기준 평가 제외일(hireCutoffDate)이 "실제로" 바뀌는지 판정.
    // 프론트가 PATCH 에 전 필드를 항상 담아 보내므로 값 비교로 변경을 가려낸다.
    const prevCutoff = cycle.hireCutoffDate ? cycle.hireCutoffDate.getTime() : null;
    const nextCutoff =
      dto.hireCutoffDate === undefined
        ? prevCutoff
        : dto.hireCutoffDate
          ? new Date(dto.hireCutoffDate).getTime()
          : null;
    const cutoffChanged =
      dto.hireCutoffDate !== undefined && nextCutoff !== prevCutoff;

    const updated = await this.prisma.evaluationCycle.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.hireCutoffDate !== undefined && {
          hireCutoffDate: dto.hireCutoffDate ? new Date(dto.hireCutoffDate) : null,
        }),
      },
    });

    // 기준일이 바뀌면 부서장(downward) 평가 배정을 즉시 재정렬한다 —
    // reset=true 로 아직 시작 안 한(not_started) 배정만 초기화·재생성하고
    // 진행중/제출/확정 배정은 보존한다(진행중 평가 파괴 방지). 컷오프 이후 입사자·
    // 입사일 미등록자는 여기서 피평가자에서 빠지며, 역량평가 대상(downward 배정에서 파생)도
    // 함께 정리된다. 본인평가(self)는 생성 시점에 실시간으로 걸러지므로 별도 조치 불필요.
    // draft(아직 배정 전 — active 전이 때 자동 배정)·closed(동결)에는 적용하지 않는다.
    if (
      cutoffChanged &&
      cycle.status !== CycleStatus.draft &&
      cycle.status !== CycleStatus.closed
    ) {
      await this.evaluations.autoAssignDownward(id, true);
    }

    return updated;
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
