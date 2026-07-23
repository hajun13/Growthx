import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Kpi, KpiStatus, MeasureType, Prisma, ReviewKind, Role } from '@prisma/client';
// 측정방식별 등급·KPI 분류는 schema enum(KpiCategory/KpiGroup/MeasureType)으로 검증됨.
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CycleLockService } from '../cycles/cycle-lock.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser, resolveDownwardEvaluators } from '../../common/access/access.util';
import {
  evaluateApprovalGate,
  approvedIdsFromTrail,
  APPROVAL_GATE_MESSAGE,
} from './approval-gate';
import { assertTransition, KPI_TRANSITIONS } from '../../common/state/transitions';
import {
  ApproveKpiDto,
  CreateKpiDto,
  LinkKpiDto,
  ListKpisQuery,
  ListReviewsQuery,
  RejectKpiDto,
  UpdateKpiDto,
} from './dto/kpi.dto';

/** KPI 검토 의견을 별도 단계로 표기하기 위한 분기값(분기 실적 리뷰와 구분). */
const KPI_REVIEW_QUARTER = 0;

@Injectable()
export class KpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly cycleLock: CycleLockService,
    private readonly scoring: ScoringService,
  ) {}

  async list(current: AuthUser, query: ListKpisQuery) {
    const where: Prisma.KpiWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.group) where.group = query.group;
    if (query.category) where.category = query.category;

    // 행 수준: employee 는 본인만 (E-1: hr_admin 외 전 역할은 가시 범위로 축소)
    if (current.role === Role.employee) {
      where.userId = current.id;
    }
    const rows = await this.prisma.kpi.findMany({ where, orderBy: { createdAt: 'asc' } });

    // 행 수준 필터 (E-1): team_lead=자기 팀, division_head=자기 본부. hr_admin 전체.
    // employee 는 위 where 로 이미 본인 한정 → 추가 검사 불필요.
    if (current.role === Role.hr_admin || current.role === Role.employee) {
      return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
    }
    const visible: Kpi[] = [];
    for (const k of rows) {
      if (k.userId === current.id || (await canViewUser(this.prisma, current, k.userId))) {
        visible.push(k);
      }
    }
    return { data: visible, meta: { page: 1, pageSize: visible.length, total: visible.length } };
  }

  /**
   * KPI 검토 의견(Review, quarter=0) 조회. 승인=strength·반려/수정요청=improvement.
   * 가시성: 작성자 본인이거나 검토 가능 대상(canViewUser)만. 최신순.
   */
  async listReviews(current: AuthUser, query: ListReviewsQuery) {
    const where: Prisma.ReviewWhereInput = { quarter: KPI_REVIEW_QUARTER };
    if (query.kpiId) where.kpiId = query.kpiId;
    if (query.userId || query.cycleId) {
      where.kpi = {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      };
    }
    const rows = await this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, position: true } },
        kpi: { select: { userId: true } },
      },
    });
    const visible: Array<{
      id: string;
      kpiId: string;
      kind: ReviewKind;
      content: string;
      authorId: string;
      authorName: string;
      authorPosition: string | null;
      createdAt: Date;
    }> = [];
    for (const r of rows) {
      const ok =
        r.kpi.userId === current.id ||
        (await canViewUser(this.prisma, current, r.kpi.userId));
      if (!ok) continue;
      visible.push({
        id: r.id,
        kpiId: r.kpiId,
        kind: r.kind,
        content: r.content,
        authorId: r.authorId,
        authorName: r.author.name,
        authorPosition: r.author.position,
        createdAt: r.createdAt,
      });
    }
    return { data: visible, meta: { page: 1, pageSize: visible.length, total: visible.length } };
  }

  async get(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    const allowed = await canViewUser(this.prisma, current, kpi.userId);
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    return kpi;
  }

  async create(current: AuthUser, dto: CreateKpiDto) {
    // M3 Item 5: KPI 작성 기간 잠금 시 423.
    await this.cycleLock.assertKpiWritable(dto.cycleId);
    // employee 는 본인 KPI 만 생성. hr_admin 은 dto.userId 로 대리 생성 가능(미지정 시 본인).
    const userId =
      current.role !== Role.hr_admin ? current.id : (dto.userId ?? current.id);
    // hr_admin 이 타인 대상으로 생성할 경우 대상 사용자 존재 확인.
    if (userId !== current.id) {
      const target = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!target) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '대상 사용자를 찾을 수 없어요.',
        });
      }
    }
    // 제품 결정(2026-07-07): 카테고리는 순수 분류 라벨 — 직책·역할 게이트 없이 전 카테고리 작성 가능.
    // (전 KPI 서술형 자기작성 + 상급자 승인/반려가 실질 통제.)
    // KPI 카테고리 최대 4개 제한
    const existingCategories = await this.prisma.kpi.findMany({
      where: { userId, cycleId: dto.cycleId },
      select: { category: true },
      distinct: ['category'],
    });
    if (existingCategories.length >= 4 && !existingCategories.some((k) => k.category === dto.category)) {
      throw new BadRequestException('KPI 카테고리는 최대 4개까지 등록할 수 있습니다');
    }
    return this.prisma.kpi.create({
      data: {
        userId,
        cycleId: dto.cycleId,
        category: dto.category,
        group: dto.group,
        title: dto.title,
        coreStrategy: KpisService.emptyToNull(dto.coreStrategy) ?? null,
        csf: KpisService.emptyToNull(dto.csf) ?? null,
        measureMethod: KpisService.emptyToNull(dto.measureMethod) ?? null,
        measureType: dto.measureType,
        targetValue: dto.targetValue ?? null,
        targetText: KpisService.emptyToNull(dto.targetText) ?? null,
        weight: dto.weight,
        isQualitative: dto.isQualitative,
        useAbsoluteAmount: dto.useAbsoluteAmount ?? false,
        grading: (dto.grading as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        gradingCriteria: KpisService.normalizeGradingCriteria(dto.gradingCriteria) ?? Prisma.JsonNull,
        parentKpiId: dto.parentKpiId ?? null,
        status: KpiStatus.draft,
      },
    });
  }

  async update(current: AuthUser, id: string, dto: UpdateKpiDto) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    // M3 Item 5: KPI 작성 기간 잠금 시 423.
    await this.cycleLock.assertKpiWritable(kpi.cycleId);
    // 카테고리 변경은 자유(순수 분류 라벨 — 2026-07-07 게이트 제거).
    if (kpi.status !== KpiStatus.draft) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '작성중(draft) 상태에서만 수정할 수 있어요.',
      });
    }
    // BUG-A(저장 손실): nullable 서술 필드는 "미전송(undefined)=기존값 유지 /
    // 전송된 null·빈 값=클리어". `?? undefined` 는 null(클리어 의도)을 미전송으로
    // 뭉개 지운 값이 부활하므로, 그대로 통과시킨다(Prisma 는 undefined 만 skip).
    return this.prisma.kpi.update({
      where: { id },
      data: {
        category: dto.category ?? undefined,
        group: dto.group ?? undefined,
        title: dto.title ?? undefined,
        coreStrategy: KpisService.emptyToNull(dto.coreStrategy),
        csf: KpisService.emptyToNull(dto.csf),
        measureMethod: KpisService.emptyToNull(dto.measureMethod),
        measureType: dto.measureType ?? undefined,
        targetValue: dto.targetValue, // undefined=유지, null=클리어
        targetText: KpisService.emptyToNull(dto.targetText),
        weight: dto.weight ?? undefined,
        isQualitative: dto.isQualitative ?? undefined,
        useAbsoluteAmount: dto.useAbsoluteAmount ?? undefined,
        grading: dto.grading ? (dto.grading as Prisma.InputJsonValue) : undefined,
        gradingCriteria: KpisService.normalizeGradingCriteria(dto.gradingCriteria),
        parentKpiId: dto.parentKpiId ?? undefined,
      },
    });
  }

  /**
   * draft → submitted.
   * 제출 시점에 cycle 의 RuleSet(weightPolicy)을 로드해, 같은 (userId, cycleId) 의 전체 KPI
   * 가중치 합=100 을 검증한다. 위반 시 VALIDATION_ERROR(BadRequest) —
   * 총점 Σ(score×weight/100)이 비100 기준으로 왜곡되는 것을 차단.
   *
   * ⚠️ 제품 결정(2026-06-08): KPI 를 전부 서술형(qualitative)으로 전환하며 제출 검증을 완화.
   *    정성 비중 ≤30% 상한·KpiGroup 비율(80/20)·정량 targetValue 필수는 더 이상 차단하지 않는다
   *    (정성 상한·그룹 비율은 weightPolicy 플래그로 옵트인; 기본 비차단 — validateWeights 참조).
   *    가중치 합=100 만 정합성 게이트로 유지한다.
   */
  async submit(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.submitted);

    // 모든 KPI 항목은 수치 기반 목표값 필수(달성률·증감률·건수 등). 정성(qualitative) 항목은 면제.
    if (kpi.measureType !== MeasureType.qualitative && kpi.targetValue == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '모든 정량 KPI는 수치 기반 목표값(달성률·증감률·건수 등)을 설정해야 해요.',
      });
    }

    // 가중치 합=100 · 정성≤상한 · KpiGroup 비율(전사 공통 80/20)을 제출 시점에 집합 검증.
    // 같은 사용자·주기의 전체 KPI 를 모아 RuleSet.weightPolicy 로 검증.
    const ruleSet = await this.scoring.loadRuleSetForCycle(kpi.cycleId);
    const siblings = await this.prisma.kpi.findMany({
      where: { userId: kpi.userId, cycleId: kpi.cycleId },
      select: { weight: true, isQualitative: true, group: true },
    });
    this.scoring.validateWeights(siblings, ruleSet.weightPolicy);

    return this.prisma.kpi.update({
      where: { id },
      // (재)제출 시 결재선 1차부터 — 반려 후 재제출 포함.
      data: { status: KpiStatus.submitted, approvalStage: 0, approvalTrail: Prisma.JsonNull },
    });
  }

  /**
   * 순차 결재 승인(2026-07-07, 2026-07-23 이력 기준 개정). 체인 = resolveDownwardEvaluators
   * (1차 팀장 → 2차 본부장 → 최종 그룹대표, 부그룹장 압축 포함). 현재 차례(결재 이력
   * approvalTrail 기준 — 아직 승인 안 한 가장 앞 체인 구성원)만 승인 가능. hr_admin 대리는
   * 대기 결재자가 없는 경우(빈 체인·계층 공백)만. 체인 전원이 승인하면 confirmed(전 결재
   * 완료), 그 전엔 approved(다음 단계 대기). 검토 의견(comment) 전달 시 Review 로 영속화.
   */
  async approve(current: AuthUser, id: string, dto?: ApproveKpiDto) {
    const kpi = await this.findOrThrow(id);
    if (kpi.status !== KpiStatus.submitted && kpi.status !== KpiStatus.approved) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: '제출(결재 진행) 상태에서만 승인할 수 있어요.',
      });
    }
    if (kpi.userId === current.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '본인 KPI는 스스로 승인할 수 없어요. 상위 결재자가 처리해야 해요.',
      });
    }
    const chain = await this.approvalChain(kpi.userId);
    // 담당 단계 검증(B-1 정합) — 위치 인덱스(chain[approvalStage])가 아닌 **결재 이력
    // (approvalTrail) 기준**(2026-07-23): 체인은 매 호출 시 현 조직(Department.headUserId)에서
    // 재해석되므로, 결재 도중 부서장이 바뀌면 위치 인덱스가 엉뚱한 사람을 가리켜 단계가
    // 조용히 건너뛰어지거나 같은 사람이 두 번 승인됐다. 이제 "아직 승인하지 않은 가장 앞
    // 체인 구성원"만 현재 차례. hr_admin 은 대기 결재자가 없는 경우(빈 체인·계층 공백)만
    // 대리 — 배정 결재자가 있으면 hr_admin 이라도 대리 불가(타 팀 결재선 가로채기 차단).
    const approvedIds = approvedIdsFromTrail(kpi.approvalTrail, kpi.approvalStage, chain);
    const gate = evaluateApprovalGate(current.role, current.id, chain, approvedIds);
    if (!gate.allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: APPROVAL_GATE_MESSAGE[gate.kind] });
    }
    approvedIds.add(current.id);
    // 완료 단계 수·최종 여부도 이력 기준 — 살아있는 체인 전원이 승인 이력에 있을 때만 확정
    // (체인 축소/빈 체인 포함: 남은 대기 결재자가 없으면 확정). newStage 는 현 체인 구성원 중
    // 승인 완료 수라 부서장 교체 시에도 "결재 n/m" 표시·다음 대기자와 자기 정합된다.
    const newStage = chain.filter((uid) => approvedIds.has(uid)).length;
    const isFinal = newStage >= chain.length;
    const nextStatus = isFinal ? KpiStatus.confirmed : KpiStatus.approved;
    assertTransition(KPI_TRANSITIONS, kpi.status, nextStatus);

    const approver = await this.prisma.user.findUnique({
      where: { id: current.id },
      select: { name: true },
    });
    const priorTrail = this.trailOf(kpi);
    const trail = [
      ...priorTrail,
      {
        // 표시용 차수: 정상 흐름에선 newStage 와 이력 순번이 일치. HR 대리(비체인 구성원)처럼
        // newStage 가 늘지 않는 경우엔 이력 순번으로 폴백.
        stage: newStage > priorTrail.length ? newStage : priorTrail.length + 1,
        approverId: current.id,
        approverName: approver?.name ?? '',
        at: new Date().toISOString(),
      },
    ];
    const updated = await this.prisma.kpi.update({
      where: { id },
      data: {
        status: nextStatus,
        approvalStage: newStage,
        approvalTrail: trail as unknown as Prisma.InputJsonValue,
      },
    });
    await this.saveReviewComment(kpi.id, current.id, dto?.comment, ReviewKind.strength);
    await this.audit.record({
      entity: 'Kpi',
      entityId: kpi.id,
      action: 'kpi.approve',
      actorId: current.id,
      before: { status: kpi.status, approvalStage: kpi.approvalStage },
      after: { status: nextStatus, approvalStage: newStage },
    });
    if (isFinal) {
      await this.notifications.notifyUser(kpi.userId, 'kpi_confirmed', {
        kpiId: kpi.id,
        message: `KPI "${kpi.title}"가 전 단계 결재를 마치고 확정되었어요.`,
      });
    } else {
      // 다음 단계 결재자에게 승인 요청 알림 — 이력 기준 "아직 승인 안 한 가장 앞 구성원".
      const next = chain.find((uid) => !approvedIds.has(uid));
      if (next) {
        await this.notifications.notifyUser(next, 'kpi_approval_pending', {
          kpiId: kpi.id,
          evaluateeId: kpi.userId,
          message: `${newStage}차 승인이 완료된 KPI "${kpi.title}"의 ${chain.indexOf(next) + 1}차 결재가 대기 중이에요.`,
        });
      }
    }
    return updated;
  }

  /**
   * 반려 → draft (사유 기록, 결재 이력 리셋). 결재선 구성원은 **하위 단계가 이미 승인한 뒤에도**
   * 반려할 수 있다(팀장 승인 후 본부장 반려, 본부장 승인 후 그룹대표 반려 — 순차 결재선의 핵심).
   * confirmed(전 결재 완료) 되돌림은 hr_admin 전용. 보강 의견(comment)은 Review 로 영속화.
   */
  async reject(current: AuthUser, id: string, dto: RejectKpiDto) {
    const kpi = await this.findOrThrow(id);
    assertTransition(KPI_TRANSITIONS, kpi.status, KpiStatus.draft);
    if (kpi.userId === current.id && current.role !== Role.hr_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '본인 KPI는 스스로 반려할 수 없어요.' });
    }
    if (current.role !== Role.hr_admin) {
      if (kpi.status === KpiStatus.confirmed) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '전 단계 결재가 완료된 KPI는 HR 관리자만 되돌릴 수 있어요.',
        });
      }
      const chain = await this.approvalChain(kpi.userId);
      if (!chain.includes(current.id)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '이 구성원의 결재선(팀장→본부장→그룹대표)에 포함되어 있지 않아요.',
        });
      }
    }
    const updated = await this.prisma.kpi.update({
      where: { id },
      data: {
        status: KpiStatus.draft,
        rejectReason: dto.reason,
        approvalStage: 0,
        approvalTrail: Prisma.JsonNull, // 재제출 시 1차부터 다시 — 이력은 AuditLog·Review 에 보존.
      },
    });
    await this.saveReviewComment(kpi.id, current.id, dto.comment, ReviewKind.improvement);
    await this.audit.record({
      entity: 'Kpi',
      entityId: kpi.id,
      action: 'kpi.reject',
      actorId: current.id,
      before: { status: kpi.status, approvalStage: kpi.approvalStage },
      after: { status: KpiStatus.draft, rejectReason: dto.reason },
    });
    // KPI 반려 알림(작성자).
    await this.notifications.notifyUser(kpi.userId, 'kpi_rejected', {
      kpiId: kpi.id,
      reason: dto.reason,
      message: `KPI "${kpi.title}"가 반려되었어요: ${dto.reason}`,
    });
    return updated;
  }

  /** (호환) 확정 = 현재 단계 승인과 동일 — 순차 결재선에서 별도 확정 단계는 없다. */
  async confirm(current: AuthUser, id: string) {
    return this.approve(current, id);
  }

  /**
   * 결재선 조회 — 피평가자의 순차 결재 단계 [{stage, userId, name, position}].
   * 본인·결재선 구성원·가시범위 내 부서장·hr_admin 열람 가능.
   */
  async getApprovalChain(current: AuthUser, userId: string) {
    const ids = await this.approvalChain(userId);
    const allowed =
      current.role === Role.hr_admin ||
      current.id === userId ||
      ids.includes(current.id) ||
      (await canViewUser(this.prisma, current, userId));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, position: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      data: {
        userId,
        stages: ids.map((uid, i) => ({
          stage: i + 1,
          userId: uid,
          name: byId.get(uid)?.name ?? '',
          position: byId.get(uid)?.position ?? null,
        })),
      },
    };
  }

  /** 상위 KPI 연계(cascade). */
  async link(current: AuthUser, id: string, dto: LinkKpiDto) {
    const kpi = await this.findOrThrow(id);
    const allowed =
      current.role === Role.hr_admin ||
      kpi.userId === current.id ||
      (await canViewUser(this.prisma, current, kpi.userId));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '연계 권한이 없어요.' });
    await this.findOrThrow(dto.parentKpiId); // 상위 존재 확인
    return this.prisma.kpi.update({
      where: { id },
      data: { parentKpiId: dto.parentKpiId },
    });
  }

  /** draft 상태 본인(또는 HR) KPI 삭제. */
  async remove(current: AuthUser, id: string) {
    const kpi = await this.findOrThrow(id);
    this.assertOwner(current, kpi);
    if (kpi.status !== KpiStatus.draft) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: '작성중(draft) 상태에서만 삭제할 수 있어요.',
      });
    }
    await this.prisma.kpi.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── helpers ──
  /** 검토 의견을 Review(quarter=0, KPI 검토 단계)로 저장. 비어 있으면 무시. */
  private async saveReviewComment(
    kpiId: string,
    authorId: string,
    comment: string | undefined,
    kind: ReviewKind,
  ): Promise<void> {
    const content = comment?.trim();
    if (!content) return;
    await this.prisma.review.create({
      data: { kpiId, authorId, quarter: KPI_REVIEW_QUARTER, kind, content },
    });
  }

  private async findOrThrow(id: string): Promise<Kpi> {
    const kpi = await this.prisma.kpi.findUnique({ where: { id } });
    if (!kpi) throw new NotFoundException({ code: 'NOT_FOUND', message: 'KPI를 찾을 수 없어요.' });
    return kpi;
  }

  /**
   * BUG-A(저장 손실): "전송했지만 빈 값" = 클리어 의도.
   * undefined(미전송)=기존값 유지, null·공백뿐인 문자열=null(클리어), 그 외=그대로 반영.
   */
  private static emptyToNull(v: string | null | undefined): string | null | undefined {
    if (v === undefined) return undefined;
    if (v === null || v.trim() === '') return null;
    return v;
  }

  /**
   * BUG-A: 정성 등급기준(S~D) 정규화 — undefined(미전송)=유지,
   * null 또는 전 밴드가 빈 값인 객체=JsonNull(전체 클리어).
   * 일부 밴드만 채운 객체는 그대로 저장(빈 밴드는 null 로 유지) — 기존 부분 클리어 동작 보존.
   */
  private static normalizeGradingCriteria(
    gc: Record<string, string | null> | null | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (gc === undefined) return undefined;
    if (gc === null) return Prisma.JsonNull;
    const hasAny = Object.values(gc).some((v) => typeof v === 'string' && v.trim() !== '');
    return hasAny ? (gc as Prisma.InputJsonValue) : Prisma.JsonNull;
  }

  private assertOwner(current: AuthUser, kpi: Kpi): void {
    if (kpi.userId !== current.id && current.role !== Role.hr_admin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '본인 KPI만 처리할 수 있어요.' });
    }
  }

  /**
   * 피평가자의 순차 결재 체인 [1차, 2차, (최종)] userId 배열.
   * 평가 배정과 동일 원천(resolveDownwardEvaluators — Department.headUserId 명시 지정,
   * 부그룹장 압축, 본인·비활성 제외). 그룹대표 본인 등 체인이 비면 hr_admin 결재로 처리.
   */
  private async approvalChain(evaluateeId: string): Promise<string[]> {
    const heads = await resolveDownwardEvaluators(this.prisma, evaluateeId);
    return [heads.round1, heads.round2, heads.round3].filter((x): x is string => !!x);
  }

  /** approvalTrail Json → 배열 정규화(비배열/null 은 빈 이력). */
  private trailOf(kpi: Kpi): Array<Record<string, unknown>> {
    return Array.isArray(kpi.approvalTrail)
      ? (kpi.approvalTrail as Array<Record<string, unknown>>)
      : [];
  }
}
