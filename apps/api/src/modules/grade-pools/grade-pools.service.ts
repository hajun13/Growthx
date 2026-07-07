import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradePool, Grade, Prisma, Role, VisibilityScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { groupRootOf } from '../../common/access/access.util';
import { GroupPerformanceService } from '../group-performance/group-performance.service';
import {
  ComputeGradePoolDto,
  ListGradePoolsQuery,
  UpdateGradePoolDto,
} from './dto/grade-pool.dto';

/**
 * 그룹 등급 풀 산정/조회.
 * 그룹 실적 tier → RuleSet.poolRatios 의 분포 상한(S/A/B/C/D)을 적용해 GradePool 생성.
 * B-3b: 응답에 headcount(그룹 정원) + 등급별 절대 상한 caps:Record<Grade,number> 동봉.
 */
@Injectable()
export class GradePoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
    private readonly groupPerformance: GroupPerformanceService,
  ) {}

  async list(current: AuthUser, query: ListGradePoolsQuery) {
    const where: Prisma.GradePoolWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.groupId) where.groupId = query.groupId;

    // 소속 검증: 비 hr_admin(또는 company scope 아님)은 본인 소속 그룹의 풀만 조회.
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const ownGroupId = current.departmentId
        ? await groupRootOf(this.prisma, current.departmentId)
        : null;
      // 소속 그룹이 없으면 결과 없음(존재하지 않는 groupId 로 강제).
      where.groupId = ownGroupId ?? '__none__';
    }

    if (query.cycleId) {
      const sourceGroupIds = await this.syncVisibleMonthlySources(
        query.cycleId,
        where.groupId,
      );
      if (sourceGroupIds.length === 0) {
        return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
      }
      where.groupId = { in: sourceGroupIds };
    }

    const rows = await this.prisma.gradePool.findMany({
      where,
      include: { group: true },
    });
    const data = await Promise.all(rows.map((r) => this.toDto(r)));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /** 그룹 실적 tier 기준으로 풀(분포 상한) 산정. 실적 미입력 시 400. */
  async compute(dto: ComputeGradePoolDto, actor?: AuthUser) {
    const perf = await this.groupPerformance.syncFromMonthlyPerformance(
      dto.cycleId,
      dto.groupId,
    );
    if (!perf) {
      // 실패(실적 미입력) 판정 시 기존 풀을 삭제하지 않는다 — "실패" 응답(400)인데
      // HR 수동 조정 풀이 이미 사라지던 데이터 손실 결함 수정. 검증만 하고 400 반환.
      // (실적 없는 그룹의 풀은 list 의 sourceGroupIds 필터로 이미 노출에서 제외된다.)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '월별 실적을 먼저 입력해야 풀을 산정할 수 있어요.',
      });
    }
    const rules = await this.scoring.loadRuleSetForCycle(dto.cycleId);
    const row = rules.poolRatios[perf.tier];
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '해당 tier 의 풀 비율을 찾을 수 없어요.',
      });
    }

    const pool = await this.prisma.gradePool.upsert({
      where: { cycleId_groupId: { cycleId: dto.cycleId, groupId: dto.groupId } },
      create: {
        cycleId: dto.cycleId,
        groupId: dto.groupId,
        tier: perf.tier,
        sRatio: row.S,
        aRatio: row.A,
        bRatio: row.B,
        cRatio: row.C,
        dRatio: row.D,
      },
      update: {
        tier: perf.tier,
        sRatio: row.S,
        aRatio: row.A,
        bRatio: row.B,
        cRatio: row.C,
        dRatio: row.D,
      },
      include: { group: true },
    });

    await this.audit.record({
      entity: 'GradePool',
      entityId: pool.id,
      action: 'grade_pool.compute',
      actorId: actor?.id,
      after: { tier: pool.tier, ratios: row },
    });

    return this.toDto(pool);
  }

  private async syncVisibleMonthlySources(
    cycleId: string,
    groupFilter: Prisma.GradePoolWhereInput['groupId'],
  ): Promise<string[]> {
    let groupIds: string[];
    if (typeof groupFilter === 'string') {
      groupIds = [groupFilter];
    } else if (
      groupFilter &&
      typeof groupFilter === 'object' &&
      'in' in groupFilter &&
      Array.isArray(groupFilter.in)
    ) {
      groupIds = groupFilter.in.filter((id): id is string => typeof id === 'string');
    } else {
      const groups = await this.prisma.department.findMany({
        where: { type: 'group' },
        select: { id: true },
      });
      groupIds = groups.map((group) => group.id);
    }

    const syncedIds: string[] = [];
    for (const groupId of groupIds) {
      const synced = await this.groupPerformance.syncFromMonthlyPerformance(cycleId, groupId);
      if (synced) {
        syncedIds.push(groupId);
      }
      // 실적 없는 그룹은 syncedIds 에서 빠져 결과에서 이미 제외된다 — 조회(GET) 경로에서
      // gradePool.deleteMany 로 삭제하지 않는다(형제 group-performance 와 동일 정책).
      // 고아 풀(실적 원천이 사라진 풀)은 자동 삭제하지 않고 이 필터로 숨긴다 —
      // compute 실패 경로의 deleteMany 도 제거됨(HR 수동 조정 풀 보존).
    }
    return syncedIds;
  }

  /** HR 수동 풀 비율 조정. 지정된 등급 비율만 갱신. */
  async update(current: AuthUser, id: string, dto: UpdateGradePoolDto) {
    const pool = await this.prisma.gradePool.findUnique({ where: { id } });
    if (!pool) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '등급 풀을 찾을 수 없어요.',
      });
    }

    // 부분 PATCH: 제공된 비율만 기존 값에 머지한 뒤, 5개 등급 비율 합 = 100(±0.01) 검증.
    // (DTO 는 각 필드 0~100 만 보장 — 합 제약은 여기서 강제. validateRuleSet 의 poolRatios 합 검증과 동일 shape.)
    const merged = {
      sRatio: dto.sRatio ?? pool.sRatio,
      aRatio: dto.aRatio ?? pool.aRatio,
      bRatio: dto.bRatio ?? pool.bRatio,
      cRatio: dto.cRatio ?? pool.cRatio,
      dRatio: dto.dRatio ?? pool.dRatio,
    };
    const sum =
      merged.sRatio +
      merged.aRatio +
      merged.bRatio +
      merged.cRatio +
      merged.dRatio;
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `등급 풀 비율 합이 100이어야 해요. (현재 ${sum})`,
      });
    }

    const updated = await this.prisma.gradePool.update({
      where: { id },
      data: {
        ...(dto.sRatio !== undefined && { sRatio: dto.sRatio }),
        ...(dto.aRatio !== undefined && { aRatio: dto.aRatio }),
        ...(dto.bRatio !== undefined && { bRatio: dto.bRatio }),
        ...(dto.cRatio !== undefined && { cRatio: dto.cRatio }),
        ...(dto.dRatio !== undefined && { dRatio: dto.dRatio }),
      },
      include: { group: true },
    });

    await this.audit.record({
      entity: 'GradePool',
      entityId: pool.id,
      action: 'grade_pool.update',
      actorId: current?.id,
      before: {
        sRatio: pool.sRatio,
        aRatio: pool.aRatio,
        bRatio: pool.bRatio,
        cRatio: pool.cRatio,
        dRatio: pool.dRatio,
      },
      after: {
        sRatio: updated.sRatio,
        aRatio: updated.aRatio,
        bRatio: updated.bRatio,
        cRatio: updated.cRatio,
        dRatio: updated.dRatio,
      },
    });

    return this.toDto(updated);
  }

  /** GradePool + headcount + 절대 caps 동봉(B-3b). */
  private async toDto(pool: GradePool & { group?: { name: string } | null }) {
    const headcount = await this.countGroupMembers(pool.groupId);
    const caps: Record<Grade, number> = {
      S: Math.ceil((pool.sRatio / 100) * headcount),
      A: Math.ceil((pool.aRatio / 100) * headcount),
      B: Math.ceil((pool.bRatio / 100) * headcount),
      C: Math.ceil((pool.cRatio / 100) * headcount),
      D: Math.ceil((pool.dRatio / 100) * headcount),
    };
    return {
      id: pool.id,
      cycleId: pool.cycleId,
      groupId: pool.groupId,
      groupName: pool.group?.name ?? null,
      tier: pool.tier,
      sRatio: pool.sRatio,
      aRatio: pool.aRatio,
      bRatio: pool.bRatio,
      cRatio: pool.cRatio,
      dRatio: pool.dRatio,
      headcount,
      caps,
    };
  }

  /** group 하위 트리(division·team)에 속한 사용자 수. */
  private async countGroupMembers(groupId: string): Promise<number> {
    const deptIds = [groupId];
    let frontier = [groupId];
    for (let depth = 0; depth < 5 && frontier.length; depth++) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      deptIds.push(...childIds);
      frontier = childIds;
    }
    // 풀 정원(headcount)은 평가 대상자만 — 비활성·평가 제외자는 분모에서 뺀다.
    return this.prisma.user.count({
      where: { departmentId: { in: deptIds }, isActive: true, evaluationExempt: false },
    });
  }
}
