import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  Grade,
  LegalEntity,
  Prisma,
  Role,
  VisibilityScope,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  descendantDeptIds,
  visibleDeptIds,
} from '../../common/access/access.util';
import { CompareResultsQuery, DistributionQuery } from './dto/result.dto';

const GRADES: Grade[] = [Grade.S, Grade.A, Grade.B, Grade.C, Grade.D];

/** byType(임포트 round1/2/final 또는 라이브 self/downward) 에서 실적·역량 원형 추출. */
interface RoundShape {
  perf: number | null;
  comp: number | null;
}

/**
 * YoY: 연도 누적 평가 비교.
 *  - compare: 개인 연도별 결과 타임라인(규칙 정규화 + 규칙차이 메타).
 *  - distribution: 사이클별 등급분포(조직 스냅샷 기준).
 * RBAC: 기존 visibilityScope 행수준 권한 준수.
 */
@Injectable()
export class ComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  private parseCycleIds(raw?: string): string[] | null {
    if (!raw) return null;
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length ? ids : null;
  }

  /** byType json 에서 최종 실적/역량 원형을 뽑는다(임포트·라이브 양쪽 대응). */
  private extractPerfComp(byType: unknown): RoundShape {
    if (!byType || typeof byType !== 'object') return { perf: null, comp: null };
    const o = byType as Record<string, unknown>;
    // 임포트: final.{perf,comp}.
    const final = o.final as RoundShape | undefined;
    if (final && (final.perf != null || final.comp != null)) {
      return { perf: final.perf ?? null, comp: final.comp ?? null };
    }
    // 라이브: downward2/downward1/self.score (역량 개념 없음 → comp null).
    const live =
      (o.downward2 as { score?: number } | undefined)?.score ??
      (o.downward1 as { score?: number } | undefined)?.score ??
      (o.self as { score?: number } | undefined)?.score ??
      null;
    return { perf: live ?? null, comp: null };
  }

  /** GET /results/compare — 개인 연도별 타임라인. */
  async compare(current: AuthUser, query: CompareResultsQuery) {
    const targetUserId = query.userId ?? current.id;
    const allowed = await canViewUser(this.prisma, current, targetUserId);
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '비교 조회 권한이 없어요.' });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, employmentStatus: true, legalEntity: true },
    });
    if (!user) {
      throw new ForbiddenException({ code: 'NOT_FOUND', message: '대상 사용자를 찾을 수 없어요.' });
    }

    const cycleIds = this.parseCycleIds(query.cycleIds);
    const where: Prisma.EvaluationResultWhereInput = { userId: targetUserId };
    if (cycleIds) where.cycleId = { in: cycleIds };

    const results = await this.prisma.evaluationResult.findMany({
      where,
      include: { cycle: { include: { ruleSet: true } } },
    });
    // 연도 오름차순.
    results.sort((a, b) => (a.cycle?.year ?? 0) - (b.cycle?.year ?? 0));

    const timeline = results.map((r) => {
      const { perf, comp } = this.extractPerfComp(r.byType);
      const wp = (r.cycle?.ruleSet?.weightPolicy ?? {}) as Record<string, unknown>;
      const source =
        (r.byType as { source?: string } | null)?.source ??
        (wp.sourcePriority === 'import' ? 'import' : 'aggregate');
      return {
        cycleId: r.cycleId,
        cycleName: r.cycle?.name ?? null,
        year: r.cycle?.year ?? null,
        finalGrade: r.finalGrade,
        finalScore: r.finalScore,
        percentile: r.percentile,
        perf,
        comp,
        org: {
          group: r.groupSnapshot,
          division: r.divisionSnapshot,
          team: r.teamSnapshot,
        },
        ruleSummary: {
          competencyIncluded: wp.competencyIncluded === true,
          gradeScaleLabel: this.gradeScaleLabel(r.cycle?.ruleSet?.gradeScale),
          source,
        },
      };
    });

    return {
      data: {
        userId: user.id,
        userName: user.name,
        employmentStatus: user.employmentStatus,
        legalEntity: user.legalEntity,
        timeline,
      },
    };
  }

  /** gradeScale 배열 → 짧은 라벨("S96·A91·B85·C80·D<80"). */
  private gradeScaleLabel(gradeScale: unknown): string {
    if (!Array.isArray(gradeScale)) return '';
    const byGrade = new Map<string, number>();
    for (const b of gradeScale as { grade: string; min: number }[]) {
      if (b && typeof b.min === 'number') byGrade.set(b.grade, b.min);
    }
    const parts: string[] = [];
    for (const g of GRADES) {
      if (g === Grade.D) {
        const cMin = byGrade.get(Grade.C);
        parts.push(cMin != null ? `D<${cMin}` : 'D');
      } else if (byGrade.has(g)) {
        parts.push(`${g}${byGrade.get(g)}`);
      }
    }
    return parts.join('·');
  }

  /** GET /results/distribution — 사이클별 등급분포(조직 스냅샷 기준). */
  async distribution(current: AuthUser, query: DistributionQuery) {
    const scope = query.scope ?? 'group';

    // 결함 #7 완전 해결(id 기반 하이브리드):
    //   EvaluationResult 가 이제 부서 id 스냅샷(group/division/teamIdSnapshot)을 보유한다.
    //   → 가시 범위·필터·집계를 모두 'id 직접 비교'로 수행한다(동명 부서 충돌·가지 누수 무관).
    //   id 스냅샷이 null 인 과거 행(백필 미매칭분)은 기존 '부모경로 합성 키'(buildPathKey)
    //   로직으로 폴백해 누락 없이 처리한다. 버킷 표시명은 id 가 있으면 현재 부서명을
    //   쓰고, 없으면 스냅샷 name 을 쓴다.

    // 부서 트리를 한 번에 적재(현재 부서명 조회 + 경로 키 폴백 산정용).
    const deptTree = await this.prisma.department.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    });
    const deptById = new Map(deptTree.map((d) => [d.id, d]));

    /** 부서 id → scope 레벨까지의 합성 경로 키(상위 group›division›team) — 폴백용. */
    const pathKeyOfDeptId = (deptId: string): string | null => {
      let group: string | null = null;
      let division: string | null = null;
      let team: string | null = null;
      let cursor: string | null = deptId;
      for (let i = 0; i < 10 && cursor; i++) {
        const d = deptById.get(cursor);
        if (!d) break;
        if (d.type === 'team' && team === null) team = d.name;
        else if (d.type === 'division' && division === null) division = d.name;
        else if (d.type === 'group' && group === null) group = d.name;
        cursor = d.parentId;
      }
      return this.buildPathKey(scope, group, division, team);
    };

    /** 부서 id → scope 레벨의 조상 부서 id(스냅샷 컬럼과 직접 비교할 키). */
    const scopeIdOfDeptId = (deptId: string): string | null => {
      let groupId: string | null = null;
      let divisionId: string | null = null;
      let teamId: string | null = null;
      let cursor: string | null = deptId;
      for (let i = 0; i < 10 && cursor; i++) {
        const d = deptById.get(cursor);
        if (!d) break;
        if (d.type === 'team' && teamId === null) teamId = d.id;
        else if (d.type === 'division' && divisionId === null) divisionId = d.id;
        else if (d.type === 'group' && groupId === null) groupId = d.id;
        cursor = d.parentId;
      }
      if (scope === 'group') return groupId;
      if (scope === 'division') return divisionId;
      return teamId;
    };

    // 행수준 권한: hr_admin/company 전체. 그 외 가시 부서로 제한.
    //   id 가시 집합(우선) + 경로키 가시 집합(폴백) 둘 다 산정.
    let visibleIdSet: Set<string> | null = null; // null = 제한 없음.
    let visibleKeySet: Set<string> | null = null; // 폴백용.
    const isFull =
      current.role === Role.hr_admin || current.scope === VisibilityScope.company;
    if (!isFull) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      // deptId 지정 시 가시 범위 안인지 id 로 검증.
      if (query.deptId) {
        const allowedIds = deptIds === null ? null : new Set(await this.expandDeptIds(deptIds));
        if (allowedIds && !allowedIds.has(query.deptId)) {
          throw new ForbiddenException({ code: 'FORBIDDEN', message: '해당 조직 조회 권한이 없어요.' });
        }
      }
      if (deptIds !== null) {
        const ids = await this.expandDeptIds(deptIds);
        visibleIdSet = new Set<string>();
        visibleKeySet = new Set<string>();
        for (const id of ids) {
          const sid = scopeIdOfDeptId(id);
          if (sid) visibleIdSet.add(sid);
          const key = pathKeyOfDeptId(id);
          if (key) visibleKeySet.add(key);
        }
      }
    }

    // deptId 지정 시 그 부서의 scope-레벨 id(우선) + 경로 키(폴백) 산정.
    let deptIdFilter: string | null = null; // id 스냅샷과 직접 비교.
    let deptKeyFilter: string | null = null; // 폴백 경로 키.
    if (query.deptId) {
      deptIdFilter = scopeIdOfDeptId(query.deptId) ?? '__none__';
      deptKeyFilter = pathKeyOfDeptId(query.deptId) ?? '__none__';
    }

    const cycleIds = this.parseCycleIds(query.cycleIds);
    const where: Prisma.EvaluationResultWhereInput = {};
    if (cycleIds) where.cycleId = { in: cycleIds };
    if (query.legalEntity) {
      where.user = { legalEntity: query.legalEntity as LegalEntity };
    }

    const results = await this.prisma.evaluationResult.findMany({
      where,
      include: { cycle: { select: { id: true, name: true, year: true } } },
    });

    // 결과 행의 scope 레벨 id 스냅샷(있으면 id 기반 처리).
    const snapId = (r: {
      groupIdSnapshot: string | null;
      divisionIdSnapshot: string | null;
      teamIdSnapshot: string | null;
    }): string | null => {
      if (scope === 'group') return r.groupIdSnapshot;
      if (scope === 'division') return r.divisionIdSnapshot;
      return r.teamIdSnapshot;
    };

    // 스냅샷 기준 표시명(버킷 라벨). 스코프 레벨의 부서명(폴백·라벨용).
    const snapName = (r: {
      groupSnapshot: string | null;
      divisionSnapshot: string | null;
      teamSnapshot: string | null;
    }): string | null => {
      if (scope === 'group') return r.groupSnapshot;
      if (scope === 'division') return r.divisionSnapshot;
      return r.teamSnapshot;
    };

    // 결과 스냅샷에서 부모 경로 포함 합성 키(폴백 비교·집계용).
    const snapKey = (r: {
      groupSnapshot: string | null;
      divisionSnapshot: string | null;
      teamSnapshot: string | null;
    }): string | null =>
      this.buildPathKey(scope, r.groupSnapshot, r.divisionSnapshot, r.teamSnapshot);

    // 현재 부서명(id 기반 라벨). 조직개편 후에도 최신 이름 표시.
    const currentDeptName = (deptId: string): string | null =>
      deptById.get(deptId)?.name ?? null;

    // cycleId → { key → {deptName, counts} }, overall counts.
    //   key 는 id(우선) 또는 경로키(폴백) — 충돌 방지 위해 접두사로 네임스페이스 분리.
    type Counts = Record<Grade, number>;
    const zero = (): Counts => ({ S: 0, A: 0, B: 0, C: 0, D: 0 });
    const cycleMap = new Map<
      string,
      {
        cycleName: string | null;
        year: number | null;
        buckets: Map<string, { deptName: string; counts: Counts }>;
        overall: Counts;
      }
    >();

    for (const r of results) {
      if (!r.finalGrade) continue;

      const sid = snapId(r);
      let bucketKey: string | null = null;
      let deptName: string | null = null;

      if (sid) {
        // id 기반(정확): 가시·필터를 id 직접 비교.
        if (deptIdFilter && sid !== deptIdFilter) continue;
        if (visibleIdSet && !visibleIdSet.has(sid)) continue;
        bucketKey = `id:${sid}`;
        deptName = currentDeptName(sid) ?? snapName(r);
      } else {
        // 폴백(과거 백필 미매칭분): 경로 키.
        const key = snapKey(r);
        const name = snapName(r);
        if (!key || !name) continue; // 해당 scope 조직 정보 없음.
        if (deptKeyFilter && key !== deptKeyFilter) continue;
        if (visibleKeySet && !visibleKeySet.has(key)) continue;
        bucketKey = `path:${key}`;
        deptName = name;
      }
      if (!bucketKey || !deptName) continue;

      let entry = cycleMap.get(r.cycleId);
      if (!entry) {
        entry = {
          cycleName: r.cycle?.name ?? null,
          year: r.cycle?.year ?? null,
          buckets: new Map(),
          overall: zero(),
        };
        cycleMap.set(r.cycleId, entry);
      }
      const bucket = entry.buckets.get(bucketKey) ?? { deptName, counts: zero() };
      bucket.counts[r.finalGrade] += 1;
      entry.buckets.set(bucketKey, bucket);
      entry.overall[r.finalGrade] += 1;
    }

    const ratiosOf = (c: Counts, total: number) => {
      const out: Record<string, number> = {};
      for (const g of GRADES) {
        out[g] = total > 0 ? Math.round((c[g] / total) * 1000) / 10 : 0;
      }
      return out;
    };

    const cycles = [...cycleMap.entries()]
      .map(([cycleId, e]) => {
        const buckets = [...e.buckets.values()]
          .map(({ deptName, counts }) => {
            const total = GRADES.reduce((s, g) => s + counts[g], 0);
            return { deptName, total, counts, ratios: ratiosOf(counts, total) };
          })
          .sort((a, b) => b.total - a.total);
        const overallTotal = GRADES.reduce((s, g) => s + e.overall[g], 0);
        return {
          cycleId,
          cycleName: e.cycleName,
          year: e.year,
          buckets,
          overall: {
            total: overallTotal,
            counts: e.overall,
            ratios: ratiosOf(e.overall, overallTotal),
          },
        };
      })
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

    return { data: { scope, cycles } };
  }

  /**
   * scope 레벨까지 상위 경로를 포함한 합성 키.
   *  - group    : "group"
   *  - division : "group ▷ division"
   *  - team     : "group ▷ division ▷ team"
   * 동명 부서가 서로 다른 가지에서 합쳐지는 것을 막는 유일 키.
   * scope 레벨의 이름이 비어 있으면 식별 불가 → null.
   */
  private buildPathKey(
    scope: string,
    group: string | null,
    division: string | null,
    team: string | null,
  ): string | null {
    const SEP = ' ▷ ';
    if (scope === 'group') {
      return group ? group : null;
    }
    if (scope === 'division') {
      if (!division) return null;
      return [group ?? '', division].join(SEP);
    }
    // team
    if (!team) return null;
    return [group ?? '', division ?? '', team].join(SEP);
  }

  /** 가시 부서 id 배열을 하위 포함으로 확장(team scope 등 자식까지). */
  private async expandDeptIds(deptIds: string[]): Promise<string[]> {
    const out = new Set<string>();
    for (const id of deptIds) {
      const desc = await descendantDeptIds(this.prisma, id);
      for (const d of desc) out.add(d);
    }
    return [...out];
  }
}
