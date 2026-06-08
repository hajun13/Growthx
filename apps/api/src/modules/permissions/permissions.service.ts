import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  DEFAULT_MATRIX,
  DEFAULT_NAV_VISIBILITY,
  FeatureKey,
  PermLevel,
  PermMatrix,
  NavVisibility,
  mergeMatrix,
  mergeNav,
} from './perm-config.constants';

const SINGLETON_ID = 'singleton';
// 10초 — 매 요청 DB 조회 회피. 멀티인스턴스 배포 시 권한 변경 전파 최대 지연 = 이 TTL.
// (완전한 분산 캐시 무효화는 이번 범위 밖 — 인스턴스별 인메모리 캐시의 한계.)
const CACHE_TTL_MS = 10_000;

export interface ResolvedConfig {
  matrix: PermMatrix;
  navVisibility: NavVisibility;
}

/**
 * 권한 설정(싱글톤) 읽기/쓰기 + 인메모리 캐시.
 * - resolve(): 캐시된 matrix/navVisibility. DB 실패 시 마지막 정상 캐시 유지, 없을 때만 기본값.
 * - hasFeature(): FeatureGuard 판정용. 미등록 키는 fail-CLOSED(차단).
 * - update(): hr_admin 이 PUT 으로 갱신 — upsert + 캐시 무효화 + audit.
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);
  private cache: ResolvedConfig | null = null;
  private cacheAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 캐시 우선 — 만료/미존재 시 DB 로드.
   * DB 조회 실패 시: 마지막으로 성공 로드한 캐시가 있으면(만료됐더라도) 그것을 유지·반환
   * (관리자가 기본값보다 강하게 건 제한이 DB 일시장애 중 풀리지 않게 함).
   * 캐시가 아예 없을 때만 DEFAULT_MATRIX 로 폴백.
   */
  async resolve(): Promise<ResolvedConfig> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < CACHE_TTL_MS) return this.cache;

    try {
      const row = await this.prisma.permissionConfig.findUnique({
        where: { id: SINGLETON_ID },
      });
      // row 없거나 키 누락이면 기본값으로 머지(부분 저장 안전, fail-to-default).
      const matrix = mergeMatrix(row?.matrix);
      const navVisibility = mergeNav(row?.navVisibility);
      this.cache = { matrix, navVisibility };
      this.cacheAt = now;
      return this.cache;
    } catch (err) {
      // DB 조회 실패 — "마지막으로 알려진 정상 설정"을 우선. 캐시가 있으면 만료됐어도 그대로 유지.
      if (this.cache) {
        this.logger.warn(
          `permission config load failed, keeping last-known cache: ${(err as Error).message}`,
        );
        this.cacheAt = now; // 짧게 갱신 — 장애 중 매 요청마다 DB 재시도 폭주 방지.
        return this.cache;
      }
      // 캐시가 아예 없을 때만 기본값으로 폴백(restrict-only — 강제 실패해도 크래시 금지).
      this.logger.warn(
        `permission config load failed and no cache, using defaults: ${(err as Error).message}`,
      );
      this.cache = {
        matrix: mergeMatrix(undefined),
        navVisibility: mergeNav(undefined),
      };
      this.cacheAt = now;
      return this.cache;
    }
  }

  /** GET /permissions/config 응답 본문. */
  async getConfig(): Promise<ResolvedConfig> {
    return this.resolve();
  }

  /**
   * FeatureGuard 판정: 해당 레벨이 기능을 가지는가.
   * restrict-only: 명시적 false → 차단, 명시/기본 true → 허용.
   * 단, 미등록 키(DEFAULT_MATRIX 에도 없음)는 fail-CLOSED 로 차단 — @RequireFeature 오타·미등록 키가
   * 가드를 조용히 무효화하지 못하게 함. known 키는 mergeMatrix 가 기본값으로 항상 채우므로 영향 없음.
   */
  async hasFeature(level: PermLevel, key: FeatureKey): Promise<boolean> {
    const { matrix } = await this.resolve();
    const levelMap = matrix[level] ?? DEFAULT_MATRIX[level];
    const allowed = levelMap?.[key];
    if (allowed === undefined) {
      // 현재 매트릭스에 키 없음 — 기본 매트릭스로 폴백.
      const fallback = DEFAULT_MATRIX[level]?.[key];
      if (fallback === undefined) {
        // 미등록 feature key — fail-CLOSED(차단).
        this.logger.warn(
          `미등록 feature key: ${key} (level ${level}) — 차단함`,
        );
        return false;
      }
      return fallback;
    }
    return allowed;
  }

  /** PUT /permissions/config — 싱글톤 upsert + 캐시 무효화 + audit. */
  async update(
    body: { matrix?: unknown; navVisibility?: unknown },
    actorId: string,
  ): Promise<ResolvedConfig> {
    const matrix = mergeMatrix(body.matrix);
    const navVisibility = mergeNav(body.navVisibility);

    const before = await this.prisma.permissionConfig.findUnique({
      where: { id: SINGLETON_ID },
    });

    await this.prisma.permissionConfig.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        matrix: matrix as unknown as Prisma.InputJsonValue,
        navVisibility: navVisibility as unknown as Prisma.InputJsonValue,
        updatedById: actorId,
      },
      update: {
        matrix: matrix as unknown as Prisma.InputJsonValue,
        navVisibility: navVisibility as unknown as Prisma.InputJsonValue,
        updatedById: actorId,
      },
    });

    // 캐시 즉시 무효화(다음 resolve 에서 재로드).
    this.cache = null;
    this.cacheAt = 0;

    await this.audit.record({
      entity: 'PermissionConfig',
      entityId: SINGLETON_ID,
      action: 'update',
      actorId,
      before: before ?? null,
      after: { matrix, navVisibility },
    });

    return { matrix, navVisibility };
  }
}
