import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  CreateNotificationDto,
  GenerateNotificationsDto,
  ListNotificationsQuery,
} from './dto/notification.dto';

// 단계(phase) → 임직원 안내용 한글 라벨(프론트 schedulePhaseText 와 동일 의미).
const PHASE_LABELS: Record<string, string> = {
  kpi_selection: 'KPI 선정',
  execution_h1: '상반기 실행',
  mid_review: '중간 점검',
  execution_h2: '하반기 실행',
  final_review: '최종 평가',
};

// 알림을 자동 발송할 주기 상태(초안·완료 제외 = 진행 중).
const ACTIVE_CYCLE_STATUSES = ['active', 'mid_review', 'calibration'] as const;

// 날짜를 UTC 자정 기준 '일(day)' 정수로. 두 날짜의 일수 차/비교에 사용.
function dayKey(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000,
  );
}

// JSON 컬럼 → number[] (방어적 파싱).
function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
}

// JSON 컬럼 → string[] (방어적 파싱).
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/**
 * 알림 (C-2): 인앱 + 이메일.
 * 트리거: 일정 D-7/D-3/D-1, KPI 반려, 결과 확정, 이의제기 답변.
 * 인앱은 DB Notification 저장(읽음/안읽음). 이메일은 MailService(미설정 시 콘솔 폴백).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** APP_BASE_URL 미설정 경고를 한 번만 남기기 위한 플래그(수신자마다 반복하면 로그가 묻힌다). */
  private warnedMissingBaseUrl = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * 메일 본문에 실을 앱 절대 링크. APP_BASE_URL 미설정 시 상대경로(메일에서 클릭 불가) —
   * 동작은 유지하되 운영자가 알아채도록 첫 호출 때 한 번만 경고한다.
   */
  appLink(path: string): string {
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl && !this.warnedMissingBaseUrl) {
      this.warnedMissingBaseUrl = true;
      this.logger.warn(
        'APP_BASE_URL 이 설정되지 않아 알림 링크가 상대경로로 나갑니다(메일에서 클릭 불가). 환경변수를 설정해 주세요.',
      );
    }
    return `${baseUrl ?? ''}${path}`;
  }

  /**
   * '요약 + 링크' 본문. 반려·수정요청 사유 원문 같은 민감 텍스트는 메일 본문에 싣지 않고
   * (수신자 메일함·백업·검색 인덱스 영구 저장 방지) 앱에서 확인하게 한다 — 중간점검과 동일 원칙.
   */
  linkedMessage(summary: string, path: string): string {
    return `${summary}\n\n내용 확인 → ${this.appLink(path)}`;
  }

  /** HR 테스트 발송 — 지정 주소로 1통. 실제 업무 트리거 없이 SMTP 설정을 검증한다. */
  async sendTest(to: string) {
    const result = await this.mail.send(
      to,
      '[에너지엑스 인사 평가] 메일 발송 테스트',
      '이 메일이 보이면 SMTP 설정이 정상입니다.\n\n인사평가 시스템 알림이 이 주소로 발송됩니다.',
    );
    return { data: { to, ...result, smtpEnabled: this.mail.enabled } };
  }

  /** 본인 알림 목록. */
  async list(current: AuthUser, query: ListNotificationsQuery) {
    const where: Prisma.NotificationWhereInput = { userId: current.id };
    if (query.unreadOnly === 'true') where.readAt = null;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 본인 미읽음 카운트(뱃지). */
  async unreadCount(current: AuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: current.id, readAt: null },
    });
    return { data: { count } };
  }

  /** 단건 생성(HR/시스템) + 이메일 발송. */
  async create(dto: CreateNotificationDto) {
    return this.notifyUser(dto.userId, dto.type, dto.payload ?? null);
  }

  /**
   * 재사용 가능한 알림 발송 헬퍼.
   * 인앱 Notification 저장 + 사용자 이메일로 발송(폴백 안전).
   * 다른 모듈(evaluations·kpis·appeals)에서 트리거로 호출.
   */
  async notifyUser(userId: string, type: string, payload: Record<string, unknown> | null) {
    const notif = await this.prisma.notification.create({
      data: {
        userId,
        type,
        payload: (payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
    // 이메일 채널(베스트 에포트).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (user?.email) {
      const message =
        (payload && typeof payload.message === 'string' && payload.message) ||
        this.subjectForType(type);
      await this.mail.send(user.email, `[에너지엑스 인사 평가] ${this.subjectForType(type)}`, message);
    }
    return notif;
  }

  /** cycle 대상자 일괄 D-7/D-1/D-3 알림 생성. */
  async generate(dto: GenerateNotificationsDto) {
    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: dto.cycleId },
    });
    if (!cycle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '평가 주기를 찾을 수 없어요.' });
    }
    const users = await this.prisma.user.findMany({ select: { id: true, email: true } });
    const type = `deadline_${dto.kind}`;
    for (const u of users) {
      await this.notifyUser(u.id, type, { cycleId: dto.cycleId, message: dto.message });
    }
    return { data: { count: users.length, type, emailMode: this.mail.enabled ? 'smtp' : 'console' } };
  }

  /**
   * 일정 자동화: 진행 중 주기의 단계별 일정에서 `notifyEnabled`·`notifyOffsets` 를
   * 읽어, 마감일 기준 D-N 리마인더를 자동 발송한다(크론 매일 호출 + HR 수동 트리거).
   *
   * - 대상 주기: status ∈ {active, mid_review, calibration} (초안·완료 제외).
   * - 발송 조건: 단계 `notifyEnabled=true`, 오늘 ≤ 마감일, 오늘 ≥ (마감일 − offset일).
   *   (캐치업: 서버가 며칠 멈춰 리마인드 예정일을 지나쳤어도 마감 전이면 즉시 1회 발송.)
   * - 멱등: (cycleId, phase, offset) 당 한 번만 발송 — ReminderDispatch 유니크로 보장.
   * - 대상자: targetUserIds → targetDeptIds → (둘 다 비면) 전 재직 임직원.
   */
  async runDueReminders(asOf: Date = new Date()) {
    const schedules = await this.prisma.cycleSchedule.findMany({
      where: {
        notifyEnabled: true,
        cycle: { status: { in: [...ACTIVE_CYCLE_STATUSES] } },
      },
      include: { cycle: { select: { id: true, name: true } } },
    });

    const todayKey = dayKey(asOf);
    const dispatched: {
      cycleId: string;
      cycleName: string;
      phase: string;
      offset: number;
      recipients: number;
    }[] = [];

    for (const s of schedules) {
      const dueKey = dayKey(s.dueDate);
      if (todayKey > dueKey) continue; // 마감 지난 단계는 발송 안 함.
      const offsets = asNumberArray(s.notifyOffsets).sort((a, b) => b - a);
      for (const offset of offsets) {
        const remindKey = dueKey - offset;
        if (todayKey < remindKey) continue; // 아직 리마인드 시점 전.

        // 멱등 — 이미 발송한 (cycle, phase, offset)은 건너뜀.
        const already = await this.prisma.reminderDispatch.findUnique({
          where: {
            cycleId_phase_offset: { cycleId: s.cycleId, phase: s.phase, offset },
          },
        });
        if (already) continue;

        const targets = await this.resolveReminderTargets(s);
        const type = `deadline_d${offset}`;
        const message = this.reminderMessage(s.cycle.name, s.phase, offset, s.dueDate);
        for (const u of targets) {
          await this.notifyUser(u.id, type, {
            cycleId: s.cycleId,
            phase: s.phase,
            offset,
            dueDate: s.dueDate.toISOString(),
            message,
          });
        }
        // 0명이어도 마커를 남겨 매일 재시도(빈 발송 폭주)를 막는다.
        await this.prisma.reminderDispatch.create({
          data: {
            cycleId: s.cycleId,
            phase: s.phase,
            offset,
            recipients: targets.length,
          },
        });
        dispatched.push({
          cycleId: s.cycleId,
          cycleName: s.cycle.name,
          phase: s.phase,
          offset,
          recipients: targets.length,
        });
      }
    }

    return {
      data: {
        ranAt: asOf.toISOString(),
        dispatched,
        batches: dispatched.length,
        recipients: dispatched.reduce((acc, d) => acc + d.recipients, 0),
        emailMode: this.mail.enabled ? 'smtp' : 'console',
      },
    };
  }

  /** 단계 대상자 해석: targetUserIds → targetDeptIds → 전 재직 임직원. */
  private async resolveReminderTargets(s: {
    targetUserIds: unknown;
    targetDeptIds: unknown;
  }): Promise<{ id: string }[]> {
    const userIds = asStringArray(s.targetUserIds);
    if (userIds.length > 0) {
      return this.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true, employmentStatus: 'active' },
        select: { id: true },
      });
    }
    const deptIds = asStringArray(s.targetDeptIds);
    if (deptIds.length > 0) {
      return this.prisma.user.findMany({
        where: {
          departmentId: { in: deptIds },
          isActive: true,
          employmentStatus: 'active',
        },
        select: { id: true },
      });
    }
    return this.prisma.user.findMany({
      where: { isActive: true, employmentStatus: 'active' },
      select: { id: true },
    });
  }

  /** 리마인더 본문 — 주기·단계·마감일을 담아 친근하게 안내. */
  private reminderMessage(
    cycleName: string,
    phase: string,
    offset: number,
    dueDate: Date,
  ): string {
    const phaseLabel = PHASE_LABELS[phase] ?? phase;
    const dateStr = dueDate.toISOString().slice(0, 10);
    return `[${cycleName}] ${phaseLabel} 마감 D-${offset} 안내 — 마감일은 ${dateStr}이에요. 기한 내에 작성을 완료해 주세요.`;
  }

  /** 읽음 처리(본인). */
  async markRead(current: AuthUser, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== current.id) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '알림을 찾을 수 없어요.' });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /** 모두 읽음 처리(본인). */
  async markAllRead(current: AuthUser) {
    const res = await this.prisma.notification.updateMany({
      where: { userId: current.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { data: { updated: res.count } };
  }

  private subjectForType(type: string): string {
    // 임의 오프셋(deadline_d5 등)도 동적으로 처리.
    const deadline = /^deadline_d(\d+)$/.exec(type);
    if (deadline) return `평가 마감 D-${deadline[1]} 안내`;
    const map: Record<string, string> = {
      kpi_rejected: 'KPI가 반려되었어요',
      kpi_confirmed: 'KPI가 확정되었어요',
      kpi_approval_pending: 'KPI 결재를 기다리고 있어요',
      evaluation_revision_requested: '평가 수정요청이 등록되었어요',
      evaluation_rejected: '평가가 반려되었어요',
      result_finalized: '평가 결과가 확정되었어요',
      appeal_answered: '이의제기 답변이 등록되었어요',
      appeal_decided: '이의제기 최종 결정이 내려졌어요',
      // 중간점검 2단계 흐름(설계 §8). 등록하지 않으면 다섯 종류가 전부 '새로운 알림'이라는
      // 제목으로 나가 메일함에서 무슨 일이 생겼는지 구분되지 않는다.
      midterm_opened: '중간점검이 개시되었습니다',
      midterm_comment_received: '중간점검 코멘트가 등록되었습니다',
      midterm_revision_submitted: '중간점검 수정본이 제출되었습니다',
      midterm_returned: '중간점검이 반려되었습니다',
      midterm_closed: '중간점검이 마무리되었습니다',
    };
    return map[type] ?? '새로운 알림';
  }
}
