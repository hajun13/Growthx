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
const CACHE_TTL_MS = 30_000; // 30초 — 매 요청 DB 조회 회피.

export interface ResolvedConfig {
  matrix: PermMatrix;
  navVisibility: NavVisibility;
}

/**
 * 권한 설정(싱글톤) 읽기/쓰기 + 인메모리 캐시.
 * - resolve(): 캐시된 matrix/navVisibility. row 없으면 기본값(자동 폴백).
 * - hasFeature(): FeatureGuard 판정용. matrix[level][key] (누락 시 DEFAULT_MATRIX).
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

  /** 캐시 우선 — 만료/미존재 시 DB 로드(실패해도 기본값 폴백, 크래시 금지). */
  async resolve(): Promise<ResolvedConfig> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < CACHE_TTL_MS) return this.cache;

    let matrix: PermMatrix = DEFAULT_MATRIX;
    let navVisibility: NavVisibility = DEFAULT_NAV_VISIBILITY;
    try {
      const row = await this.prisma.permissionConfig.findUnique({
        where: { id: SINGLETON_ID },
      });
      // row 없거나 키 누락이면 기본값으로 머지(부분 저장 안전, fail-to-default).
      matrix = mergeMatrix(row?.matrix);
      navVisibility = mergeNav(row?.navVisibility);
    } catch (err) {
      // DB 조회 실패 시에도 기본값으로 동작(권한 강제는 실패해도 막지 않음 — restrict-only).
      this.logger.warn(
        `permission config load failed, using defaults: ${(err as Error).message}`,
      );
      matrix = mergeMatrix(undefined);
      navVisibility = mergeNav(undefined);
    }
    this.cache = { matrix, navVisibility };
    this.cacheAt = now;
    return this.cache;
  }

  /** GET /permissions/config 응답 본문. */
  async getConfig(): Promise<ResolvedConfig> {
    return this.resolve();
  }

  /**
   * FeatureGuard 판정: 해당 레벨이 기능을 가지는가.
   * matrix[level][key] 가 명시적으로 false 일 때만 차단. 누락/오류 시 DEFAULT_MATRIX → 그래도 없으면 허용.
   */
  async hasFeature(level: PermLevel, key: FeatureKey): Promise<boolean> {
    const { matrix } = await this.resolve();
    const levelMap = matrix[level] ?? DEFAULT_MATRIX[level];
    const allowed = levelMap?.[key];
    if (allowed === undefined) {
      // 키 누락 — 기본 매트릭스로 폴백(그래도 없으면 허용).
      return DEFAULT_MATRIX[level]?.[key] ?? true;
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
