import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CycleStatus,
  Evaluation,
  EvaluationStatus,
  EvaluationType,
  Grade,
  MeasureType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CountGradeBand } from '../../common/rules/rule-set.types';
import { VisibilityScope } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user';
import {
  canViewUser,
  visibleDeptIds,
  isDepartmentUnder,
  groupRootOf,
  resolveDownwardEvaluators,
} from '../../common/access/access.util';
import {
  assertTransition,
  EVALUATION_TRANSITIONS,
} from '../../common/state/transitions';
import { assertFinalStage } from '../../common/state/cycle-stage';
import {
  AddCommentDto,
  CreateEvaluationDto,
  GradeDistributionQuery,
  ListEvaluationsQuery,
  PatchEvaluationDto,
  RejectEvaluationDto,
  RequestRevisionEvaluationDto,
} from './dto/evaluation.dto';

/** 증빙 첨부 파일당 최대 크기(10MB). 컨트롤러 multer 한도와 일치시킨다. */
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** 증빙 첨부 허용 MIME — 문서·이미지·압축. 실행 파일 등은 차단. */
const ALLOWED_EVIDENCE_MIME = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'application/hwp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);

/** 업로드 파일 최소 타입(@types/multer 글로벌 네임스페이스 의존 회피). */
interface UploadedEvidence {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(current: AuthUser, query: ListEvaluationsQuery) {
    const where: Prisma.EvaluationWhereInput = {};
    if (query.cycleId) where.cycleId = query.cycleId;
    if (query.evaluatorId) where.evaluatorId = query.evaluatorId;
    if (query.evaluateeId) where.evaluateeId = query.evaluateeId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    // 평가 제외(evaluationExempt) 피평가자는 부서장 평가 목록에서 빠진다.
    // 자동배정(assignDownward) 이후 제외 토글한 경우에도 이미 생성된 downward
    // 레코드가 '평가 대기'로 남지 않도록 하는 비파괴적 필터(레코드는 보존, 재포함 시 즉시 복귀).
    if (query.type === EvaluationType.downward) {
      where.evaluatee = { evaluationExempt: false };
      // 부서장 본인은 자기 자신을 평가 대상으로 보지 않는다 — evaluatorId 로 조회할 때
      // 평가자==피평가자인 행을 제외(자동배정에서도 self는 건너뛰지만 수동배정·과거 데이터 방어).
      if (query.evaluatorId && !query.evaluateeId) {
        where.evaluateeId = { not: query.evaluatorId };
      }
    }

    // 행 수준 스코프:
    //  - employee: 본인이 평가자/피평가자인 것만.
    //  - hr_admin / company scope: 전체.
    //  - 그 외(division_head/team_lead): 가시 부서에 속한 피평가자 OR 본인이 평가자인 평가만.
    if (current.role === Role.employee) {
      where.OR = [{ evaluatorId: current.id }, { evaluateeId: current.id }];
    } else if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const deptIds = await visibleDeptIds(this.prisma, current);
      if (deptIds !== null) {
        // 본인이 평가자이거나, 피평가자가 가시 부서에 속한 평가.
        const scopeOr: Prisma.EvaluationWhereInput[] = [{ evaluatorId: current.id }];
        if (deptIds.length) scopeOr.push({ evaluatee: { departmentId: { in: deptIds } } });
        where.OR = scopeOr;
      }
    }
    const rows = await this.prisma.evaluation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        evaluatee: { include: { department: true } },
        evaluator: { select: { name: true } },
      },
    });
    // B-3c: userName(피평가자)·departmentName 비정규화 동봉.
    const data = rows.map((r) => {
      const dto = this.toDto(r);
      // 미확정 하향평가는 피평가자 본인에게 점수·등급 비공개(상세는 getDetail 에서 403).
      // 목록엔 kpiScores/comments 가 없어 노출은 totalScore/등급뿐 — 그마저 가린다.
      if (
        r.type === EvaluationType.downward &&
        r.status !== EvaluationStatus.finalized &&
        r.evaluateeId === current.id &&
        r.evaluatorId !== current.id &&
        current.role !== Role.hr_admin
      ) {
        return { ...dto, totalScore: null, finalGrade: null, overallGrade: null, overallReason: null };
      }
      return dto;
    });
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  async getDetail(current: AuthUser, id: string) {
    const ev = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        kpiScores: true,
        comments: true,
        evaluatee: { include: { department: true } },
        evaluator: { select: { name: true } },
      },
    });
    if (!ev) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가를 찾을 수 없어요.' });
    const allowed =
      ev.evaluatorId === current.id ||
      (await canViewUser(this.prisma, current, ev.evaluateeId));
    if (!allowed) throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    // 하향평가(부서장 평가)는 최종 확정 전까지 피평가자 본인에게 비공개.
    // (검토자 비공개 노트·단계 등급·코멘트 유출 방지 — finalGrade 만 가리던 게이팅과 정합.)
    // 평가자 본인·상위 평가자·HR 은 계속 열람 가능(evaluateeId≠current 이거나 hr_admin).
    if (
      ev.type === EvaluationType.downward &&
      ev.status !== EvaluationStatus.finalized &&
      ev.evaluateeId === current.id &&
      ev.evaluatorId !== current.id &&
      current.role !== Role.hr_admin
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '부서장 평가는 최종 확정 후에 열람할 수 있어요.',
      });
    }
    // 예상 등급(파생, 저장 안 함): totalScore → 해당 주기 gradeScale 환산. finalize 의 scoreToGrade 와 동일.
    let estimatedGrade: Grade | null = null;
    if (ev.totalScore != null) {
      const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);
      estimatedGrade = this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale);
    }
    return { ...this.toDto(ev), estimatedGrade };
  }

  /** Evaluation 행 + 관계를 camelCase DTO 로(B-3c userName·departmentName 포함). */
  private toDto(
    ev: Evaluation & {
      evaluatee?: { name: string; department?: { name: string } | null } | null;
      evaluator?: { name: string } | null;
      kpiScores?: unknown[];
      comments?: unknown[];
    },
  ) {
    return {
      id: ev.id,
      cycleId: ev.cycleId,
      evaluatorId: ev.evaluatorId,
      evaluateeId: ev.evaluateeId,
      type: ev.type,
      round: ev.round,
      status: ev.status,
      totalScore: ev.totalScore,
      finalGrade: ev.finalGrade,
      overallGrade: ev.overallGrade,
      overallReason: ev.overallReason,
      userName: ev.evaluatee?.name ?? null,
      departmentName: ev.evaluatee?.department?.name ?? null,
      evaluatorName: ev.evaluator?.name ?? null,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
      ...(ev.kpiScores ? { kpiScores: ev.kpiScores } : {}),
      ...(ev.comments ? { comments: ev.comments } : {}),
    };
  }

  async create(current: AuthUser, dto: CreateEvaluationDto) {
    await this.assertCycleWritable(dto.cycleId);
    await this.assertEvalWindowOpen(dto.cycleId, dto.type, current.role);
    // downward 는 round(1 팀장·2 본부장) 필수, self 는 round 없음.
    const round = dto.type === 'downward' ? (dto.round ?? null) : null;
    if (dto.type === 'downward' && round == null) {
      throw new ConflictException({
        code: 'VALIDATION_ERROR',
        message: '부서장 평가(downward)는 round(1·2차 상급 부서장·3 최종 그룹장)가 필요해요.',
      });
    }

    // 권한: 임의 평가 생성 차단.
    //  - self: 본인의 자가평가만 생성 가능(evaluateeId 는 본인이어야 함).
    //  - downward: 그 대상·단계에 실제로 배정된 평가자(또는 HR)만 생성 가능.
    // 이 검증이 없으면 일반 직원이 자신을 평가자로 한 downward 평가를 만들어 patch·submit
    // 으로 등급 분포·풀 모수를 오염시킬 수 있다.
    if (dto.type === EvaluationType.self) {
      if (dto.evaluateeId !== current.id) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '본인의 자가평가만 생성할 수 있어요.',
        });
      }
    } else if (current.role !== Role.hr_admin) {
      const evaluators = await resolveDownwardEvaluators(this.prisma, dto.evaluateeId);
      const assigned =
        round === 1
          ? evaluators.round1
          : round === 2
            ? evaluators.round2
            : evaluators.round3;
      if (!assigned || assigned !== current.id) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '이 대상의 배정된 평가자만 부서장 평가를 생성할 수 있어요.',
        });
      }
    }

    // self 평가: 입사일 기준 평가 제외(cycle.hireCutoffDate) 체크
    if (dto.type === EvaluationType.self) {
      const evalCycle = await this.prisma.evaluationCycle.findUnique({
        where: { id: dto.cycleId },
        select: { hireCutoffDate: true },
      });
      if (evalCycle?.hireCutoffDate) {
        const evaluatee = await this.prisma.user.findUnique({
          where: { id: current.id }, // self-eval: evaluatee = evaluator = current user
          select: { hireDate: true },
        });
        if (!evaluatee?.hireDate || evaluatee.hireDate > evalCycle.hireCutoffDate) {
          throw new ForbiddenException({
            code: 'EVALUATION_EXEMPT',
            message: '입사일 기준 평가 대상이 아니에요. (평가 제외 기준일 이후 입사)',
          });
        }
      }
    }

    const existing = await this.prisma.evaluation.findFirst({
      where: {
        cycleId: dto.cycleId,
        evaluatorId: current.id,
        evaluateeId: dto.evaluateeId,
        type: dto.type,
        round,
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'ALREADY_EXISTS', message: '이미 생성된 평가예요.' });
    }
    return this.prisma.evaluation.create({
      data: {
        cycleId: dto.cycleId,
        evaluatorId: current.id,
        evaluateeId: dto.evaluateeId,
        type: dto.type,
        round,
        status: EvaluationStatus.not_started,
      },
    });
  }

  /**
   * 부서장(downward) 평가 자동 배정 — 다단계 캐스케이드.
   * 활성 사용자 전원을 순회하며 resolveDownwardEvaluators 로 단계별 평가자를 정하고,
   * 각 단계별 Evaluation(type=downward, round=1/2/3, status=not_started)을 생성한다.
   * round1·2 = 피평가자에서 가까운 상급 장 순서(직원=팀장·본부장 / 팀장=본부장·부그룹장 /
   * 본부장=부그룹장), round3 = 항상 그룹장(최종). 부그룹장(deputyHeadUserId) 미지정
   * 그룹은 기존 3단계 그대로. 상위 계층이 하위 전원을 평가한다.
   * 멱등: 같은 (cycleId, evaluateeId, round) 평가가 이미 있으면 skip.
   * reset=true: 내용 없는 not_started 배정만 삭제 후 재생성(삭제+재생성 단일 트랜잭션).
   * 시작된 평가가 있는 신규 제외자는 배정 전체 보존 — 본문 "리셋 안전 규칙" 주석 참조.
   * @returns 생성·skip 건수 요약.
   */
  async autoAssignDownward(cycleId: string, reset = false): Promise<{
    created: number;
    skipped: number;
    evaluatees: number;
    deleted: number;
  }> {
    // 주기 존재 확인.
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '주기를 찾을 수 없어요.' });
    }

    // hireCutoffDate: 이 날짜 이후 입사자(또는 입사일 미등록)는 평가 제외.
    const hireCutoffDate = cycle.hireCutoffDate ?? null;

    const users = await this.prisma.user.findMany({
      // 평가 제외(evaluationExempt) 대상은 부서장 평가 자동배정에서 빠진다.
      // hireCutoffDate 가 설정되면 hireDate 미등록자도 함께 제외된다(의도된 동작).
      where: {
        isActive: true,
        evaluationExempt: false,
        ...(hireCutoffDate != null
          ? { hireDate: { not: null, lte: hireCutoffDate } }
          : {}),
      },
      select: { id: true },
    });
    const targetIds = new Set(users.map((u) => u.id));

    // 기존 downward 평가를 미리 한 번에 조회 — 멱등 키 + 리셋 판정(상태·작성 내용 보유).
    const existing = await this.prisma.evaluation.findMany({
      where: { cycleId, type: EvaluationType.downward },
      select: {
        id: true,
        evaluateeId: true,
        round: true,
        status: true,
        _count: { select: { comments: true, kpiScores: true, evidence: true } },
      },
    });

    // 스마트 재배정: 아직 시작 안 한(not_started) downward 평가만 초기화 대상.
    // 진행중(in_progress)·제출(submitted)·확정(finalized)·반려중은 보존 — 권한 변경을
    // 반영하되 이미 작성 중인 평가는 건드리지 않는다.
    //
    // 리셋 안전 규칙(2026-07-23):
    //  (1) not_started 라도 코멘트·점수·증빙이 달린 행은 삭제하지 않는다(작성 내용 파괴 방지).
    //      in_progress 보존과 같은 취지 — 그 라운드는 기존 평가자가 유지된다.
    //  (2) 새 기준(컷오프 강화·비활성·평가 제외)으로 대상에서 빠지는 피평가자라도 이미
    //      시작된(not_started 아님) 평가가 있으면 남은 not_started 배정도 함께 보존한다.
    //      일부 라운드만 지우면 결합 가중치 재정규화로 '반쪽 라운드' 최종등급이 산출되는
    //      반평가 상태가 되기 때문(예: 컷오프 강화로 제외된 사람의 1차만 남아 1차 100%).
    //      대상에서 빠졌고 아무 라운드도 시작 안 한 피평가자의 배정만 깨끗이 제거된다.
    //      대상에 남는 피평가자의 not_started 는 종전대로 삭제 후 새 평가자로 재생성(B-1 재배정).
    // '시작됨' 판정 = 상태가 not_started 아님 **또는** not_started 라도 내용(코멘트·점수·증빙)이
    // 달린 행. 코멘트만 있는 not_started 라운드(addComment 는 상태 전이 없음)를 가진 제외 피평가자가
    // 나머지 깨끗한 라운드만 삭제돼 반쪽 평가로 남던 구멍을 막는다(규칙 (2)와 동일 취지).
    const startedEvaluatees = new Set(
      existing
        .filter(
          (e) =>
            e.status !== EvaluationStatus.not_started ||
            e._count.comments > 0 ||
            e._count.kpiScores > 0 ||
            e._count.evidence > 0,
        )
        .map((e) => e.evaluateeId),
    );
    const staleIds = reset
      ? existing
          .filter(
            (e) =>
              e.status === EvaluationStatus.not_started &&
              e._count.comments === 0 &&
              e._count.kpiScores === 0 &&
              e._count.evidence === 0 &&
              (targetIds.has(e.evaluateeId) || !startedEvaluatees.has(e.evaluateeId)),
          )
          .map((e) => e.id)
      : [];
    const staleIdSet = new Set(staleIds);

    // 삭제 후에도 남을 키만 멱등 skip 대상(같은 evaluatee:round 가 남으면 재생성 안 함).
    const remainingKeys = new Set(
      existing
        .filter((e) => !staleIdSet.has(e.id))
        .map((e) => `${e.evaluateeId}:${e.round ?? ''}`),
    );

    type Pending = { evaluateeId: string; evaluatorId: string; round: number };
    const pending: Pending[] = [];

    for (const u of users) {
      // 다단계 부서장 평가자 — 1차(팀장)·2차(본부장)·최종(그룹대표) 각각 배정.
      const e = await resolveDownwardEvaluators(this.prisma, u.id);
      const stages: [number, string | undefined][] = [
        [1, e.round1],
        [2, e.round2],
        [3, e.round3],
      ];
      for (const [round, evaluatorId] of stages) {
        if (!evaluatorId) continue;
        if (evaluatorId === u.id) continue; // 자기 자신 평가자 방지(이중 방어).
        if (remainingKeys.has(`${u.id}:${round}`)) continue; // 멱등 skip.
        pending.push({ evaluateeId: u.id, evaluatorId, round });
      }
    }

    // 원자성(2026-07-23): 초기화 삭제 + 재생성을 **한 트랜잭션**으로 묶는다.
    // 종전엔 삭제·재생성이 별도 트랜잭션이라 그 사이 실패 시 not_started 배정이
    // 전부 사라진 상태로 남았다. 이제 중간 실패 시 기존 배정이 그대로 보존된다.
    let deleted = 0;
    if (staleIds.length > 0 || pending.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        if (staleIds.length > 0) {
          // 스냅샷 조회와 삭제 사이에 작성이 시작된 행 방어: 여전히 not_started 인 행만 삭제.
          const stillStale = await tx.evaluation.findMany({
            where: { id: { in: staleIds }, status: EvaluationStatus.not_started },
            select: { id: true },
          });
          const ids = stillStale.map((s) => s.id);
          if (ids.length > 0) {
            // 자식은 onDelete:Cascade 지만 명시 삭제 유지(방어) — 위 필터로 내용 없는 행만이다.
            await tx.kpiScore.deleteMany({ where: { evaluationId: { in: ids } } });
            await tx.comment.deleteMany({ where: { evaluationId: { in: ids } } });
            await tx.evaluation.deleteMany({ where: { id: { in: ids } } });
          }
          deleted = ids.length;
        }
        if (pending.length > 0) {
          await tx.evaluation.createMany({
            data: pending.map((p) => ({
              cycleId,
              evaluatorId: p.evaluatorId,
              evaluateeId: p.evaluateeId,
              type: EvaluationType.downward,
              round: p.round,
              status: EvaluationStatus.not_started,
            })),
          });
        }
      });
    }

    return {
      created: pending.length,
      skipped: remainingKeys.size,
      evaluatees: users.length,
      deleted,
    };
  }

  /**
   * KpiScore 입력 + 측정방식별 등급/점수·totalScore 백엔드 재계산.
   * not_started → in_progress.
   * 평가는 KpiScore(과제별 성과)로만 구성된다(역량 항목 없음).
   */
  async patch(current: AuthUser, id: string, dto: PatchEvaluationDto) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    await this.assertCycleWritable(ev.cycleId);
    await this.assertEvalWindowOpen(ev.cycleId, ev.type, current.role);
    if (ev.status === EvaluationStatus.submitted || ev.status === EvaluationStatus.finalized) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '제출 이후에는 수정할 수 없어요.',
      });
    }

    // B-3a: 종합등급 오버라이드는 사유(overallReason) 필수. 해제(clearOverallGrade)는 사유 불필요.
    if (dto.overallGrade !== undefined && !dto.clearOverallGrade && !dto.overallReason?.trim()) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: '종합등급을 직접 부여하려면 사유 코멘트가 필요해요.',
      });
    }

    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);

    await this.prisma.$transaction(async (tx) => {
      // 빈 배열([])은 no-op — truthy 라서 과거엔 deleteMany 후 0건 재삽입으로 기존 점수가
      // 통째로 삭제됐다(프론트에만 있던 가드를 백엔드로 이관). 실제 항목이 있을 때만 재작성.
      if (dto.kpiScores && dto.kpiScores.length > 0) {
        // 전송된 KPI 만 삭제·재작성한다(전량 deleteMany 금지). 프론트가 빈 입력을 payload 에서
        // 제외해도 미포함 KPI 의 기존 저장 점수가 사라지지 않게 한다(부분 임시저장 데이터 손실 방지).
        const sentKpiIds = dto.kpiScores.map((k) => k.kpiId);
        await tx.kpiScore.deleteMany({
          where: { evaluationId: id, kpiId: { in: sentKpiIds } },
        });
        for (const ks of dto.kpiScores) {
          const kpi = await tx.kpi.findUnique({ where: { id: ks.kpiId } });
          if (!kpi) {
            throw new NotFoundException({
              code: 'NOT_FOUND',
              message: 'KPI를 찾을 수 없어요.',
            });
          }
          // 정성(qualitative) KPI 에서 사용자가 등급을 명시 선택하지 않았으면(근거 메모만 저장)
          // 임의로 D 를 산정·저장하지 않는다 — 미평가(grade null, score 0)로 두고 메모만 보존한다.
          // (과거엔 measureToGrade 가 D 를 반환해 저장→재방문 시 사용자가 고른 등급처럼 복원·완료
          //  처리되던 버그. 제출 게이트는 프론트 isComplete 로 등급 선택을 강제한다.)
          const isUnratedQualitative =
            kpi.measureType === MeasureType.qualitative && !ks.directGrade;
          let grade: Grade | null;
          let score: number;
          if (isUnratedQualitative) {
            grade = null;
            score = 0;
          } else {
            // 측정방식별 raw 등급 → 점수 (백엔드 단일 책임)
            // 갭#2: amount + useAbsoluteAmount=true 면 실제 매출 절대금액(actualAmount) → revenueGradeScale.
            grade = this.scoring.measureToGrade(
              kpi.measureType as MeasureType,
              ks.achievementRate ?? null,
              rules.gradingScales,
              (kpi.grading as unknown as CountGradeBand[] | null) ?? null,
              ks.directGrade ?? null,
              {
                useAbsoluteAmount: kpi.useAbsoluteAmount,
                actualAmount: ks.actualAmount ?? null,
                revenueGradeScale: rules.weightPolicy.revenueGradeScale ?? null,
              },
            );
            score = this.scoring.gradeToScore(grade, rules.gradeScale);
          }
          await tx.kpiScore.create({
            data: {
              evaluationId: id,
              kpiId: ks.kpiId,
              achievementRate: ks.achievementRate ?? null,
              actualAmount: ks.actualAmount ?? null,
              grade,
              score,
              // 가중치는 KPI 정의(권위 소스, 제출 시 합100 강제)에서 가져온다.
              // 클라이언트가 보낸 ks.weight 를 그대로 쓰면 임의 값(합≠100)으로
              // totalScore = Σ(score×weight/100) 를 왜곡·조작할 수 있다.
              weight: kpi.weight,
              selfNote: ks.selfNote ?? null,
              reviewerNote: ks.reviewerNote ?? null,
            },
          });
        }
      }

      // totalScore = Σ(score × weight/100) — KPI 과제 집계
      const kpiScores = await tx.kpiScore.findMany({ where: { evaluationId: id } });
      const totalScore = this.scoring.computeTotalScore(
        kpiScores.map((k) => ({ score: k.score, weight: k.weight })),
      );

      // 종합등급 오버라이드 설정/해제. clearOverallGrade=true 면 비운다(자동 산정 복귀).
      const overrideData: Prisma.EvaluationUpdateInput = dto.clearOverallGrade
        ? { overallGrade: null, overallReason: null }
        : dto.overallGrade !== undefined
          ? { overallGrade: dto.overallGrade, overallReason: dto.overallReason ?? null }
          : {};

      await tx.evaluation.update({
        where: { id },
        data: {
          // not_started → in_progress (최초 작성).
          // revision_requested/rejected → in_progress (검토 반려 후 재작성) —
          // 이 전이가 없으면 재작성해도 상태가 그대로라 submit 의 assertTransition
          // (in_progress→submitted)에서 영구 409 로 막혀 재제출이 불가능해진다.
          status:
            ev.status === EvaluationStatus.not_started ||
            ev.status === EvaluationStatus.revision_requested ||
            ev.status === EvaluationStatus.rejected
              ? EvaluationStatus.in_progress
              : ev.status,
          totalScore,
          ...overrideData,
        },
      });
    });

    // B-3a: 종합등급 오버라이드 설정·해제는 감사 로그(민감 변경).
    if (dto.overallGrade !== undefined || dto.clearOverallGrade) {
      await this.audit.record({
        entity: 'Evaluation',
        entityId: id,
        action: dto.clearOverallGrade
          ? 'evaluation.overall_grade.clear'
          : 'evaluation.overall_grade.override',
        actorId: current.id,
        before: { overallGrade: ev.overallGrade, overallReason: ev.overallReason },
        after: dto.clearOverallGrade
          ? { overallGrade: null, overallReason: null }
          : { overallGrade: dto.overallGrade, overallReason: dto.overallReason },
      });
    }

    return this.getDetail(current, id);
  }

  /** 평가 코멘트 추가 (본부장/팀장 필수). */
  async addComment(current: AuthUser, id: string, dto: AddCommentDto) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    await this.assertCycleWritable(ev.cycleId);
    return this.prisma.comment.create({
      data: {
        evaluationId: id,
        authorId: current.id,
        quarter: dto.quarter,
        content: dto.content,
      },
    });
  }

  /**
   * in_progress → submitted.
   * - 본부장/팀장 평가자(downward)는 코멘트 필수(없으면 422 COMMENT_REQUIRED).
   * - 전사 등급 풀 상한 검증(초과 시 422 POOL_EXCEEDED, 제출 차단).
   */
  async submit(current: AuthUser, id: string) {
    const ev = await this.findOrThrow(id);
    this.assertEvaluator(current, ev);
    await this.assertCycleWritable(ev.cycleId);
    await this.assertEvalWindowOpen(ev.cycleId, ev.type, current.role);
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.submitted);

    // 코멘트 필수 (downward: 본부장/팀장) — 종합 코멘트는 선택이지만,
    // 종합 코멘트 또는 문항별 코멘트(reviewerNote) 중 하나는 있어야 제출 가능(피드백 보장).
    if (
      ev.type === 'downward' &&
      (current.role === Role.division_head || current.role === Role.team_lead)
    ) {
      const commentCount = await this.prisma.comment.count({ where: { evaluationId: id } });
      const itemCommentCount =
        commentCount > 0
          ? 0 // 종합 코멘트가 있으면 항목별 조회 불필요(단락 평가).
          : await this.prisma.kpiScore.count({
              where: { evaluationId: id, NOT: { reviewerNote: null } },
            });
      if (commentCount === 0 && itemCommentCount === 0) {
        throw new UnprocessableEntityException({
          code: 'COMMENT_REQUIRED',
          message: '종합 또는 문항별 평가 코멘트를 하나 이상 작성해야 제출할 수 있어요.',
        });
      }
    }

    // 전사 등급 풀 상한 검증 (전체 평가 대상 기준)
    await this.assertPoolNotExceeded(ev);

    // 부서장(downward) 제출 = 검토 승인 → 승인 이력 적재. 상태 update 와 동일 트랜잭션(원자성).
    // self 제출은 검토 액션이 아니므로 이력 남기지 않음.
    const isDownwardApproval = ev.type === EvaluationType.downward;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.evaluation.update({
        where: { id },
        data: { status: EvaluationStatus.submitted },
      });
      if (isDownwardApproval) {
        await tx.evaluationReviewHistory.create({
          data: {
            evaluationId: id,
            kind: 'approved',
            reason: null,
            actorId: current.id,
          },
        });
      }
      return u;
    });
    await this.audit.record({
      entity: 'Evaluation',
      entityId: id,
      action: 'evaluation.submit',
      actorId: current.id,
      before: { status: ev.status },
      after: { status: EvaluationStatus.submitted, totalScore: ev.totalScore },
    });
    return updated;
  }

  /** submitted → finalized (HR, 캘리브레이션 후). 최종 등급 산출. */
  async finalize(id: string, actor?: AuthUser) {
    const ev = await this.findOrThrow(id);
    // 단계 게이트: calibration/closed 에서만 확정 가능. mid_review(비구속 체크포인트)
    // 등에서 finalGrade 를 확정하면 등급/보상이 미확정 단계에서 굳어버린다.
    // (results.aggregate·compensations 와 동일한 게이트를 evaluation.finalize 에도 적용.)
    await assertFinalStage(
      this.prisma,
      ev.cycleId,
      '최종 확정은 캘리브레이션(조정) 단계 이후에만 할 수 있어요.',
    );
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.finalized);
    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);
    // 평가자 종합등급 오버라이드(B-3a)가 있으면 그것을 우선, 없으면 자동 산정.
    const finalGrade =
      ev.overallGrade ??
      (ev.totalScore != null
        ? this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale)
        : null);
    const updated = await this.prisma.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.finalized, finalGrade },
    });
    await this.audit.record({
      entity: 'Evaluation',
      entityId: id,
      action: 'evaluation.finalize',
      actorId: actor?.id,
      before: { status: ev.status, finalGrade: ev.finalGrade },
      after: { status: EvaluationStatus.finalized, finalGrade },
    });
    // 결과 확정 알림(피평가자).
    await this.notifications.notifyUser(ev.evaluateeId, 'result_finalized', {
      cycleId: ev.cycleId,
      evaluationId: id,
      message: '평가 결과가 확정되었어요.',
    });
    return updated;
  }

  /**
   * submitted → revision_requested (검토자 수정요청, 사유 필수).
   * 같은 레코드 상태 되돌림(KPI reject 선례). 이후 피평가자/하위가 in_progress 로 재작성.
   */
  async requestRevision(current: AuthUser, id: string, dto: RequestRevisionEvaluationDto) {
    const ev = await this.findOrThrow(id);
    await this.assertReviewer(current, ev);
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.revision_requested);

    // 원자성: 상태 update + 이력 create 를 한 트랜잭션으로(부분 실패 시 불일치 방지).
    // audit/notify 는 외부효과라 트랜잭션 밖(KPI reject 선례).
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.evaluation.update({
        where: { id },
        data: { status: EvaluationStatus.revision_requested },
      });
      await tx.evaluationReviewHistory.create({
        data: {
          evaluationId: id,
          kind: 'revision_requested',
          reason: dto.reason,
          actorId: current.id,
        },
      });
      return u;
    });
    await this.audit.record({
      entity: 'Evaluation',
      entityId: id,
      action: 'evaluation.request_revision',
      actorId: current.id,
      before: { status: ev.status },
      after: { status: EvaluationStatus.revision_requested, reason: dto.reason },
    });
    await this.notifications.notifyUser(ev.evaluateeId, 'evaluation_revision_requested', {
      cycleId: ev.cycleId,
      evaluationId: id,
      reason: dto.reason,
      message: `평가에 수정요청이 등록되었어요: ${dto.reason}`,
    });
    return updated;
  }

  /**
   * submitted → rejected (검토자 반려, 사유 필수).
   * 같은 레코드 상태 되돌림. 이후 피평가자/하위가 in_progress 로 재작성.
   */
  async reject(current: AuthUser, id: string, dto: RejectEvaluationDto) {
    const ev = await this.findOrThrow(id);
    await this.assertReviewer(current, ev);
    assertTransition(EVALUATION_TRANSITIONS, ev.status, EvaluationStatus.rejected);

    // 원자성: 상태 update + 이력 create 를 한 트랜잭션으로(부분 실패 시 불일치 방지).
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.evaluation.update({
        where: { id },
        data: { status: EvaluationStatus.rejected },
      });
      await tx.evaluationReviewHistory.create({
        data: {
          evaluationId: id,
          kind: 'rejected',
          reason: dto.reason,
          actorId: current.id,
        },
      });
      return u;
    });
    await this.audit.record({
      entity: 'Evaluation',
      entityId: id,
      action: 'evaluation.reject',
      actorId: current.id,
      before: { status: ev.status },
      after: { status: EvaluationStatus.rejected, reason: dto.reason },
    });
    await this.notifications.notifyUser(ev.evaluateeId, 'evaluation_rejected', {
      cycleId: ev.cycleId,
      evaluationId: id,
      reason: dto.reason,
      message: `평가가 반려되었어요: ${dto.reason}`,
    });
    return updated;
  }

  /** 평가 검토 이력(수정요청·반려·승인) 목록. 당사자(평가자/피평가자)·상위 검토자·HR 조회 가능. */
  async getHistory(current: AuthUser, id: string) {
    const ev = await this.findOrThrow(id);
    await this.assertCanViewEvaluation(current, ev);
    const rows = await this.prisma.evaluationReviewHistory.findMany({
      where: { evaluationId: id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const data = rows.map((r) => ({
      id: r.id,
      evaluationId: r.evaluationId,
      kind: r.kind,
      reason: r.reason,
      actorId: r.actorId,
      actorName: r.actor?.name ?? null,
      createdAt: r.createdAt,
    }));
    return { data, meta: { page: 1, pageSize: data.length, total: data.length } };
  }

  /**
   * 그룹 내 부서(division/team)별 등급 분포.
   * finalGrade 또는 scoreToGrade(totalScore) 기준. submitted/finalized 평가만 집계.
   */
  async gradeDistribution(current: AuthUser, query: GradeDistributionQuery) {
    // 결과 공개 게이트: 이 분포는 살아있는 submitted 평가에서 즉석 등급을 파생하므로 mid_review 등
    // 미확정 단계에서도 값이 나온다. results.distribution·dashboard 와 동일하게, 비HR 은 결과 열람
    // 단계(calibration·closed)에서만 조회 가능(캘리브레이션 전 잠정 등급 분포 노출 차단). hr_admin 면제.
    // cycleId 미지정(전 사이클 집계)은 비HR 에게 잠정 분포가 새므로 아예 빈 결과를 반환한다.
    if (current.role !== Role.hr_admin) {
      if (!query.cycleId) {
        return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
      }
      const cycle = await this.prisma.evaluationCycle.findUnique({
        where: { id: query.cycleId },
        select: { status: true },
      });
      const visible =
        cycle?.status === CycleStatus.calibration || cycle?.status === CycleStatus.closed;
      if (!visible) {
        return { data: [], meta: { page: 1, pageSize: 0, total: 0 } };
      }
    }
    // 소속 검증: 비 hr_admin(또는 company scope 아님)은 본인 가시 그룹의 분포만 조회 가능.
    //  - groupId 지정 시: 본인 부서가 그 그룹 하위인지 확인.
    //  - groupId 미지정 시: 본인 그룹으로 강제 한정(전사 분포 노출 방지).
    let effectiveGroupId = query.groupId;
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const ownGroupId = current.departmentId
        ? await groupRootOf(this.prisma, current.departmentId)
        : null;
      if (query.groupId) {
        const within =
          query.groupId === ownGroupId ||
          (current.departmentId
            ? await isDepartmentUnder(this.prisma, current.departmentId, query.groupId)
            : false);
        if (!within) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: '해당 그룹의 등급 분포 조회 권한이 없어요.',
          });
        }
      } else {
        if (!ownGroupId) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: '소속 그룹이 없어 등급 분포를 조회할 수 없어요.',
          });
        }
        effectiveGroupId = ownGroupId;
      }
    }

    // 1. groupId 있으면 해당 그룹 하위 부서 수집
    let deptIds: string[] | undefined;
    if (effectiveGroupId) {
      deptIds = await this.collectGroupDeptIds(effectiveGroupId);
    }

    // 1-b. 스코프 교집합 — 비 hr_admin·비 company 는 가시 부서로 추가 제한.
    // effectiveGroupId 는 '본인 그룹 전체'라, 본부장(scope=division)이 그룹 기준으로 넓어져
    // 형제 본부의 부서별 등급 분포까지 보던 누수를 막는다(results.distribution 과 동일 규칙).
    // 본부장→자기 본부 하위, 팀장→자기 팀, 그룹대표→그룹 전체(가시 부서=그룹 전체라 그대로).
    if (current.role !== Role.hr_admin && current.scope !== VisibilityScope.company) {
      const scopeIds = await visibleDeptIds(this.prisma, current);
      if (scopeIds !== null) {
        const scopeSet = new Set(scopeIds);
        deptIds = (deptIds ?? []).filter((id) => scopeSet.has(id));
      }
    }

    // 2. 대상 평가 조회 — 확정 결과 등급은 부서장(downward) 평가 기준.
    //    self 평가는 분포(확정 결과)에 포함하지 않는다.
    //    revision_requested/rejected 는 의도적으로 제외(in_progress 와 동급 — 확정 전 상태).
    const evals = await this.prisma.evaluation.findMany({
      where: {
        ...(query.cycleId && { cycleId: query.cycleId }),
        type: EvaluationType.downward,
        status: {
          in: [EvaluationStatus.submitted, EvaluationStatus.finalized],
        },
      },
      include: {
        evaluatee: {
          include: {
            department: {
              select: { id: true, name: true, type: true, parentId: true },
            },
          },
        },
      },
    });

    // 3. 피평가자별 권위 등급 1건 선정.
    //    우선순위: ①finalGrade 보유한 finalized > ②높은 round(2차 본부장 > 1차 팀장).
    //    한 사람이 self+downward1+downward2로 중복 집계되던 BUG 방지.
    type DistEval = (typeof evals)[number];
    const authoritative = new Map<string, DistEval>();
    const rank = (e: DistEval) => {
      const finalized =
        e.status === EvaluationStatus.finalized && e.finalGrade != null ? 1 : 0;
      const round = e.round ?? 0;
      // finalized 여부를 최상위 가중, 그 다음 round.
      return finalized * 100 + round;
    };
    for (const ev of evals) {
      const prev = authoritative.get(ev.evaluateeId);
      if (!prev || rank(ev) > rank(prev)) {
        authoritative.set(ev.evaluateeId, ev);
      }
    }

    // 4. 부서별 집계 — cycle별 ruleSet 캐시(여러 cycle 혼재 시 각자 등급 척도 사용).
    const ruleCache = new Map<string, Awaited<
      ReturnType<typeof this.scoring.loadRuleSetForCycle>
    > | null>();
    const getRules = async (cycleId: string) => {
      if (!ruleCache.has(cycleId)) {
        ruleCache.set(cycleId, await this.scoring.loadRuleSetForCycle(cycleId));
      }
      return ruleCache.get(cycleId) ?? null;
    };

    const deptMap = new Map<
      string,
      { deptName: string; grades: Record<string, number>; total: number }
    >();

    for (const ev of authoritative.values()) {
      const dept = ev.evaluatee?.department;
      if (!dept) continue;
      if (deptIds && !deptIds.includes(dept.id)) continue;

      let grade = ev.finalGrade ?? null;
      if (!grade && ev.totalScore != null) {
        // finalGrade 미보유 시에만 ruleSet 로드(해당 cycle의 척도).
        const rules = await getRules(ev.cycleId);
        if (rules) {
          grade = this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale);
        }
      }
      if (!grade) continue;

      if (!deptMap.has(dept.id)) {
        deptMap.set(dept.id, {
          deptName: dept.name,
          grades: { S: 0, A: 0, B: 0, C: 0, D: 0 },
          total: 0,
        });
      }
      const entry = deptMap.get(dept.id)!;
      entry.grades[grade] = (entry.grades[grade] ?? 0) + 1;
      entry.total++;
    }

    const data = Array.from(deptMap.entries()).map(([deptId, v]) => ({
      deptId,
      deptName: v.deptName,
      S: v.grades.S ?? 0,
      A: v.grades.A ?? 0,
      B: v.grades.B ?? 0,
      C: v.grades.C ?? 0,
      D: v.grades.D ?? 0,
      total: v.total,
    }));

    return {
      data,
      meta: { page: 1, pageSize: data.length, total: data.length },
    };
  }

  /** group 하위 모든 부서 id 수집(group 자신 포함). */
  private async collectGroupDeptIds(groupId: string): Promise<string[]> {
    const ids = [groupId];
    let frontier = [groupId];
    for (let i = 0; i < 5 && frontier.length; i++) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      ids.push(...childIds);
      frontier = childIds;
    }
    return ids;
  }

  // ── 전사 풀 상한 검증 ──
  private async assertPoolNotExceeded(ev: Evaluation): Promise<void> {
    const evaluatee = await this.prisma.user.findUnique({
      where: { id: ev.evaluateeId },
      include: { department: true },
    });
    if (!evaluatee?.departmentId) return;

    const pools = await this.prisma.gradePool.findMany({
      where: { cycleId: ev.cycleId },
    });
    if (pools.length === 0) return; // 풀 미산정 시 통과

    const rules = await this.scoring.loadRuleSetForCycle(ev.cycleId);
    const caps = await this.companyPoolCaps(pools);

    // 전사 기준: 같은 평가 단계의 제출·확정 평가를 전체 모수로 집계한다.
    // revision_requested/rejected 는 제외(확정 전 상태 — 풀 모수에 안 들어감).
    const submitted = await this.prisma.evaluation.findMany({
      where: {
        cycleId: ev.cycleId,
        type: ev.type,
        round: ev.round,
        status: { in: [EvaluationStatus.submitted, EvaluationStatus.finalized] },
      },
    });

    const grades: Grade[] = submitted
      .filter((e) => e.totalScore != null)
      .map((e) => this.scoring.scoreToGrade(e.totalScore as number, rules.gradeScale));
    // 이번 제출 건 등급 추가
    if (ev.totalScore != null) {
      grades.push(this.scoring.scoreToGrade(ev.totalScore, rules.gradeScale));
    }

    const violations = (Object.keys(caps) as Grade[])
      .map((grade) => ({
        grade,
        count: grades.filter((g) => g === grade).length,
        cap: caps[grade],
      }))
      .filter((v) => v.count > v.cap);
    if (violations.length > 0) {
      throw new UnprocessableEntityException({
        code: 'POOL_EXCEEDED',
        message: '전사 등급 풀 상한을 초과해 제출할 수 없어요. 캘리브레이션이 필요해요.',
        details: violations,
      });
    }
  }

  private async companyPoolCaps(
    pools: {
      groupId: string;
      sRatio: number;
      aRatio: number;
      bRatio: number;
      cRatio: number;
      dRatio: number;
    }[],
  ): Promise<Record<Grade, number>> {
    const rawCaps: Record<Grade, number> = {
      [Grade.S]: 0,
      [Grade.A]: 0,
      [Grade.B]: 0,
      [Grade.C]: 0,
      [Grade.D]: 0,
    };
    let headcount = 0;
    for (const pool of pools) {
      const groupHeadcount = (await this.collectGroupMemberIds(pool.groupId)).length;
      headcount += groupHeadcount;
      rawCaps.S += (pool.sRatio / 100) * groupHeadcount;
      rawCaps.A += (pool.aRatio / 100) * groupHeadcount;
      rawCaps.B += (pool.bRatio / 100) * groupHeadcount;
      rawCaps.C += (pool.cRatio / 100) * groupHeadcount;
      rawCaps.D += (pool.dRatio / 100) * groupHeadcount;
    }
    const caps = {
      [Grade.S]: Math.floor(rawCaps.S),
      [Grade.A]: Math.floor(rawCaps.A),
      [Grade.B]: Math.floor(rawCaps.B),
      [Grade.C]: Math.floor(rawCaps.C),
      [Grade.D]: Math.floor(rawCaps.D),
    };
    const remainders = (Object.values(Grade) as Grade[])
      .map((grade) => ({
        grade,
        remainder: rawCaps[grade] - Math.floor(rawCaps[grade]),
      }))
      .sort((a, b) => b.remainder - a.remainder);
    let remaining =
      headcount - (Object.values(caps) as number[]).reduce((sum, count) => sum + count, 0);
    for (const row of remainders) {
      if (remaining <= 0) break;
      caps[row.grade] += 1;
      remaining -= 1;
    }
    return caps;
  }

  /** group 하위 트리(division·team)에 속한 모든 사용자 id. */
  private async collectGroupMemberIds(groupId: string): Promise<string[]> {
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
    const users = await this.prisma.user.findMany({
      // 풀 상한 검증 대상에서도 평가 제외자는 빼 비율 왜곡을 막는다.
      where: { departmentId: { in: deptIds }, isActive: true, evaluationExempt: false },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // ── 문항별 증빙 첨부 (본인평가) ──
  /**
   * 평가 문항(KPI)별 증빙 파일 업로드. 평가자(본인) + 작성 가능 상태에서만.
   * (evaluationId, kpiId) 에 묶는다 — KpiScore 는 저장 시 재생성되므로 kpiId 직접 참조.
   */
  async uploadEvidence(
    current: AuthUser,
    evaluationId: string,
    kpiId: string,
    file: UploadedEvidence | undefined,
  ) {
    const ev = await this.findOrThrow(evaluationId);
    this.assertEvaluator(current, ev);
    await this.assertCycleWritable(ev.cycleId);
    this.assertEvidenceEditable(ev);
    if (!file) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: '첨부 파일은 10MB 이하만 업로드할 수 있어요.',
      });
    }
    if (!ALLOWED_EVIDENCE_MIME.has(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: '지원하지 않는 파일 형식이에요. (문서·이미지·압축 파일만 가능)',
      });
    }
    // kpiId 가 이 평가의 피평가자·주기 소속 KPI 인지 확인(엉뚱한 문항에 첨부 방지).
    const kpi = await this.prisma.kpi.findUnique({ where: { id: kpiId } });
    if (!kpi || kpi.userId !== ev.evaluateeId || kpi.cycleId !== ev.cycleId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '해당 평가의 KPI 문항을 찾을 수 없어요.' });
    }
    // 파일명 정규화(원본명 누락 시 기본값).
    const filename = (file.originalname?.trim() || 'attachment').slice(0, 255);
    const created = await this.prisma.evaluationEvidence.create({
      data: {
        evaluationId,
        kpiId,
        filename,
        mimeType: file.mimetype,
        size: file.size,
        data: file.buffer,
        uploadedById: current.id,
      },
    });
    return this.evidenceMeta(created);
  }

  /** 평가의 증빙 첨부 메타데이터 목록(바이트 제외). 조회 권한 보유자만(피평가자·평가자·상위 검토자). */
  async listEvidence(current: AuthUser, evaluationId: string, kpiId?: string) {
    const ev = await this.findOrThrow(evaluationId);
    await this.assertCanViewEvaluation(current, ev);
    const rows = await this.prisma.evaluationEvidence.findMany({
      where: { evaluationId, ...(kpiId ? { kpiId } : {}) },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        evaluationId: true,
        kpiId: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedById: true,
        createdAt: true,
      },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 증빙 파일 바이트 조회(다운로드용). 조회 권한 보유자만. */
  async getEvidenceFile(current: AuthUser, evaluationId: string, evidenceId: string) {
    const ev = await this.findOrThrow(evaluationId);
    await this.assertCanViewEvaluation(current, ev);
    const file = await this.prisma.evaluationEvidence.findUnique({ where: { id: evidenceId } });
    if (!file || file.evaluationId !== evaluationId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '첨부 파일을 찾을 수 없어요.' });
    }
    return file;
  }

  /** 증빙 첨부 삭제. 평가자(본인) + 작성 가능 상태에서만. */
  async deleteEvidence(current: AuthUser, evaluationId: string, evidenceId: string) {
    const ev = await this.findOrThrow(evaluationId);
    this.assertEvaluator(current, ev);
    await this.assertCycleWritable(ev.cycleId);
    this.assertEvidenceEditable(ev);
    const file = await this.prisma.evaluationEvidence.findUnique({ where: { id: evidenceId } });
    if (!file || file.evaluationId !== evaluationId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '첨부 파일을 찾을 수 없어요.' });
    }
    await this.prisma.evaluationEvidence.delete({ where: { id: evidenceId } });
    return { id: evidenceId, deleted: true };
  }

  /** 제출/확정 이후엔 첨부 변경 불가(평가 본문 잠금과 동일 규칙). */
  private assertEvidenceEditable(ev: Evaluation): void {
    if (ev.status === EvaluationStatus.submitted || ev.status === EvaluationStatus.finalized) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '제출 이후에는 증빙 첨부를 변경할 수 없어요.',
      });
    }
  }

  /** 평가 조회 권한(상세 조회와 동일): 평가자 본인 또는 피평가자 가시 대상. */
  private async assertCanViewEvaluation(current: AuthUser, ev: Evaluation): Promise<void> {
    const allowed =
      ev.evaluatorId === current.id ||
      (await canViewUser(this.prisma, current, ev.evaluateeId));
    if (!allowed) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
    }
    // 미확정 하향평가는 피평가자 본인에게 비공개(검토 노트·단계 등급·이력·증빙 유출 방지).
    // getDetail 의 게이트와 동일 규칙 — history/evidence 우회 경로를 함께 닫는다.
    if (
      ev.type === EvaluationType.downward &&
      ev.status !== EvaluationStatus.finalized &&
      ev.evaluateeId === current.id &&
      ev.evaluatorId !== current.id &&
      current.role !== Role.hr_admin
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '부서장 평가는 최종 확정 후에 열람할 수 있어요.',
      });
    }
  }

  /** 쓰기 게이트: 완료(closed)된 주기에서는 평가 생성·수정·제출·코멘트를 막는다(종결 연도 불변성). */
  private async assertCycleWritable(cycleId: string): Promise<void> {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { status: true },
    });
    if (cycle?.status === CycleStatus.closed) {
      throw new ForbiddenException({
        code: 'CYCLE_CLOSED',
        message: '완료된 평가 주기에서는 평가를 수정할 수 없어요.',
      });
    }
  }

  /** 평가 유형 → 게이트할 운영 일정 단계(우선순위). 전용 단계 없으면 최종평가(final_review) 창을 적용. */
  private evalWindowPhases(type: EvaluationType): string[] {
    return type === EvaluationType.self
      ? ['self', 'final_review']
      : ['downward', 'final_review'];
  }

  /**
   * 평가 기간(운영 일정 창) 게이트 — 본인/부서장 평가는 해당 단계 기간 안에서만 작성·제출 가능.
   * - 창 밖(시작 전·마감 후)이면 403 EVAL_WINDOW_CLOSED.
   * - hr_admin 면제(대리 입력·보정은 상시 가능).
   * - 해당 단계 일정이 설정돼 있지 않으면 개방(스케줄 없는 단계를 막지 않음).
   *   `closed` 주기 전체 차단은 assertCycleWritable 이 별도로 담당.
   */
  private async assertEvalWindowOpen(
    cycleId: string,
    type: EvaluationType,
    role: Role,
  ): Promise<void> {
    if (role === Role.hr_admin) return; // HR 면제
    const phases = this.evalWindowPhases(type);
    const found = await this.prisma.cycleSchedule.findMany({
      where: { cycleId, phase: { in: phases } },
      select: { phase: true, startDate: true, dueDate: true },
    });
    if (found.length === 0) return; // 창 미설정 → 게이트 없음
    // 우선순위대로 첫 일치 단계 선택(전용 self/downward > final_review).
    const sched =
      phases.map((p) => found.find((s) => s.phase === p)).find((s) => s != null) ?? null;
    if (!sched) return;

    const now = new Date();
    const afterStart = sched.startDate == null || sched.startDate <= now;
    const beforeDue = sched.dueDate == null || now <= sched.dueDate;
    if (afterStart && beforeDue) return; // 창 안 → 허용

    const label = type === EvaluationType.self ? '본인평가' : '부서장 평가';
    const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
    throw new ForbiddenException({
      code: 'EVAL_WINDOW_CLOSED',
      message: `${label} 기간이 아니에요. 평가 기간은 ${fmt(sched.startDate)} ~ ${fmt(sched.dueDate)} 이에요.`,
    });
  }

  private evidenceMeta(e: {
    id: string;
    evaluationId: string;
    kpiId: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadedById: string;
    createdAt: Date;
  }) {
    return {
      id: e.id,
      evaluationId: e.evaluationId,
      kpiId: e.kpiId,
      filename: e.filename,
      mimeType: e.mimeType,
      size: e.size,
      uploadedById: e.uploadedById,
      createdAt: e.createdAt,
    };
  }

  // ── helpers ──
  private async findOrThrow(id: string): Promise<Evaluation> {
    const ev = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException({ code: 'NOT_FOUND', message: '평가를 찾을 수 없어요.' });
    return ev;
  }

  private assertEvaluator(current: AuthUser, ev: Evaluation): void {
    if (ev.evaluatorId !== current.id && current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '배정된 평가자만 작성할 수 있어요.',
      });
    }
  }

  /**
   * 검토자 권한(수정요청/반려): HR 전체, 그 외에는 피평가자가 가시 범위(상위 조직장)인 경우만.
   * 컨트롤러 @Roles(division_head/team_lead/hr_admin)로 역할 게이트 + 여기서 행 수준 권한 검증.
   */
  private async assertReviewer(current: AuthUser, ev: Evaluation): Promise<void> {
    if (current.role === Role.hr_admin) return;
    const allowed = await canViewUser(this.prisma, current, ev.evaluateeId);
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '이 평가를 검토할 권한이 없어요.',
      });
    }
  }
}
