import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PositionDef, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { Position } from '../../common/access/position.util';
import {
  CreatePositionDto,
  ListPositionsQuery,
  UpdatePositionDto,
} from './dto/position.dto';

/** 시스템 직급 코드(삭제·코드변경 불가). position.util 의 값 상수와 일치. */
const SYSTEM_CODES = new Set<string>(Object.values(Position));

/** PositionDef → 응답 DTO(camelCase). */
function toPositionDto(d: PositionDef) {
  return {
    id: d.id,
    code: d.code,
    label: d.label,
    sortOrder: d.sortOrder,
    isManagement: d.isManagement,
    defaultRole: d.defaultRole,
    defaultScope: d.defaultScope,
    defaultJobLevel: d.defaultJobLevel,
    isSystem: d.isSystem,
    isActive: d.isActive,
  };
}

/**
 * 직급 레지스트리(PositionDef) CRUD (계약 B-8).
 * GET=인증 전체, POST/PATCH/DELETE=hr_admin(컨트롤러 가드). 시스템 직급 보호.
 */
@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 목록(기본 활성만, includeInactive=true 면 전체). sortOrder asc. */
  async list(query: ListPositionsQuery) {
    const where: Prisma.PositionDefWhereInput = {};
    if (query.includeInactive !== 'true') where.isActive = true;
    const rows = await this.prisma.positionDef.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    return { data: rows.map(toPositionDto), meta: { total: rows.length } };
  }

  /** 커스텀 직급 추가. code 자동생성/검증·충돌(409)·label 중복(409). */
  async create(current: AuthUser, dto: CreatePositionDto) {
    const label = dto.label.trim();
    if (!label) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '라벨은 필수예요.' });
    }

    // label 중복 차단.
    const labelDup = await this.prisma.positionDef.findFirst({ where: { label } });
    if (labelDup) {
      throw new ConflictException({
        code: 'ALREADY_EXISTS',
        message: '같은 이름의 직급이 이미 있어요.',
      });
    }

    const code = dto.code ? dto.code : await this.generateCode(label);
    // 시스템 코드 충돌 금지 + 기존 코드 충돌 409.
    if (SYSTEM_CODES.has(code)) {
      throw new ConflictException({
        code: 'ALREADY_EXISTS',
        message: `기본 직급 코드(${code})와 충돌해요. 다른 코드를 사용하세요.`,
      });
    }
    const codeDup = await this.prisma.positionDef.findUnique({ where: { code } });
    if (codeDup) {
      throw new ConflictException({
        code: 'ALREADY_EXISTS',
        message: `코드 '${code}' 가 이미 사용 중이에요.`,
      });
    }

    // sortOrder 미지정 시 맨 뒤(+10).
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const last = await this.prisma.positionDef.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? 0) + 10;
    }

    const created = await this.prisma.positionDef.create({
      data: {
        code,
        label,
        sortOrder,
        isManagement: dto.isManagement ?? false,
        defaultRole: dto.defaultRole,
        defaultScope: dto.defaultScope,
        defaultJobLevel: dto.defaultJobLevel ?? null,
        isSystem: false,
        isActive: true,
      },
    });

    await this.audit.record({
      entity: 'PositionDef',
      entityId: created.id,
      action: 'position.create',
      actorId: current.id,
      after: toPositionDto(created),
    });
    return { data: toPositionDto(created) };
  }

  /** 직급 수정(라벨/정렬/경영진/기본값/활성). code·isSystem 불변. */
  async update(current: AuthUser, id: string, dto: UpdatePositionDto) {
    const before = await this.prisma.positionDef.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '직급을 찾을 수 없어요.' });
    }

    // label 변경 시 중복 차단(자기 자신 제외).
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '라벨은 비울 수 없어요.' });
      }
      const dup = await this.prisma.positionDef.findFirst({
        where: { label, id: { not: id } },
      });
      if (dup) {
        throw new ConflictException({
          code: 'ALREADY_EXISTS',
          message: '같은 이름의 직급이 이미 있어요.',
        });
      }
    }

    const updated = await this.prisma.positionDef.update({
      where: { id },
      data: {
        label: dto.label !== undefined ? dto.label.trim() : undefined,
        sortOrder: dto.sortOrder ?? undefined,
        isManagement: dto.isManagement ?? undefined,
        defaultRole: dto.defaultRole ?? undefined,
        defaultScope: dto.defaultScope ?? undefined,
        // null=미지정 해제 허용, undefined=변경없음.
        defaultJobLevel:
          dto.defaultJobLevel === undefined ? undefined : dto.defaultJobLevel,
        isActive: dto.isActive ?? undefined,
      },
    });

    await this.audit.record({
      entity: 'PositionDef',
      entityId: id,
      action: 'position.update',
      actorId: current.id,
      before: toPositionDto(before),
      after: toPositionDto(updated),
    });
    return { data: toPositionDto(updated) };
  }

  /** 직급 삭제. 사용중(409 IN_USE)만 차단 — 기본 직급도 미사용이면 삭제 가능. */
  async remove(current: AuthUser, id: string) {
    const def = await this.prisma.positionDef.findUnique({ where: { id } });
    if (!def) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '직급을 찾을 수 없어요.' });
    }
    const inUse = await this.prisma.user.count({ where: { position: def.code } });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'IN_USE',
        message: '이 직급을 쓰는 사용자가 있어 삭제할 수 없어요. 먼저 직급을 변경하세요.',
      });
    }

    // PositionDef + 동일 code 의 KpiCategoryPolicy 함께 삭제.
    await this.prisma.$transaction([
      this.prisma.kpiCategoryPolicy.deleteMany({ where: { position: def.code } }),
      this.prisma.positionDef.delete({ where: { id } }),
    ]);

    await this.audit.record({
      entity: 'PositionDef',
      entityId: id,
      action: 'position.delete',
      actorId: current.id,
      before: toPositionDto(def),
    });
    return { data: { id, deleted: true } };
  }

  /** label 슬러그화 → 코드 후보. 충돌 시 custom_<n>. 시스템/기존 코드 회피. */
  private async generateCode(label: string): Promise<string> {
    const base = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    let candidate = base && /^[a-z]/.test(base) ? base : '';

    const taken = async (c: string) =>
      SYSTEM_CODES.has(c) ||
      (await this.prisma.positionDef.findUnique({ where: { code: c } })) !== null;

    if (candidate && !(await taken(candidate))) return candidate;
    // 슬러그가 비었거나 충돌 → custom_<n>.
    for (let n = 1; n < 1000; n++) {
      candidate = `custom_${n}`;
      if (!(await taken(candidate))) return candidate;
    }
    // 극단적 폴백.
    return `custom_${Date.now()}`;
  }
}
