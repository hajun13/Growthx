import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MidtermReviewStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import {
  groupWaitingByReviewer,
  isNotOpenedRow,
  resolveNotOpened,
  resolveWaitingOn,
  type MidtermNotOpenedRow,
  type MidtermSummaryRow,
  type MidtermWaitingGroup,
  type MidtermWaitingRow,
} from './midterm-summary.util';

/** 단계별 인원수(설계 §7.5). 레거시(자가점검) 행은 따로 세어 신규 흐름 수치를 오염시키지 않는다. */
export interface MidtermStageCounts {
  pending: number;
  commented: number;
  revised: number;
  returned: number;
  closed: number;
  legacy: number;
  /**
   * 개시되지 않은 채 남아 있는 행(평가자 스냅샷 없는 pending) — 레거시 총평-단독 저장이나
   * 개시 대상에서 빠진 사람. pending 에 섞으면 "1차 코멘트 대기"로 잘못 읽힌다.
   */
  notOpened: number;
  /** 마감·레거시·미개시를 뺀 진행 중 건수(= 미착수자 목록의 총합). */
  unfinished: number;
  total: number;
}

/** 신규 2단계 흐름에 속하는 상태(레거시 자가점검 상태와 구분). */
const FLOW_STATUSES: MidtermReviewStatus[] = [
  MidtermReviewStatus.pending,
  MidtermReviewStatus.commented,
  MidtermReviewStatus.revised,
  MidtermReviewStatus.returned,
  MidtermReviewStatus.closed,
];

/**
 * 중간점검 진행 현황(HR 전용, 읽기 전용 집계) — 설계 §7.5
 * "평가 운영 화면에 개시 버튼과 진행 현황(단계별 인원수, 미착수자)을 둔다".
 *
 * 쿼리는 두 개뿐이다: ①주기 확인(빈 결과와 잘못된 주기를 구분하기 위해) ②주기의 리뷰 전건을
 * 필요한 join(대상자·부서·1차·2차 이름)과 함께 한 번에. 대상이 ~120명이라 행 수는 작지만,
 * 사람마다 평가자를 다시 해석하는 루프(open() 이 하는 resolveMidtermReviewers 방식)를 쓰면
 * 즉시 N+1 이 된다 — 평가자는 개시 시점에 리뷰 행에 스냅샷돼 있으므로 join 으로 충분하다.
 */
@Injectable()
export class MidtermSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(current: AuthUser, cycleId: string) {
    // 컨트롤러의 @Roles(hr_admin) 와 별개로 여기서도 막는다(open·reassign 과 동일한 방어 심층화) —
    // 이 집계는 주기 전원의 이름·부서·정체 상태를 한 화면에 모으므로 체인 밖으로 새면 안 된다.
    if (current.role !== Role.hr_admin) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '중간점검 진행 현황은 인사 담당자만 볼 수 있어요.',
      });
    }

    const cycle = await this.prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true, status: true },
    });
    if (!cycle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '평가 주기를 찾을 수 없어요.',
      });
    }

    const rows = await this.prisma.midtermReview.findMany({
      where: { cycleId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        firstCommentedAt: true,
        memberSubmittedAt: true,
        decidedAt: true,
        evaluatee: {
          select: { id: true, name: true, department: { select: { name: true } } },
        },
        firstReviewer: { select: { id: true, name: true } },
        finalReviewer: { select: { id: true, name: true } },
      },
    });

    const flat: MidtermSummaryRow[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      firstCommentedAt: r.firstCommentedAt,
      memberSubmittedAt: r.memberSubmittedAt,
      decidedAt: r.decidedAt,
      evaluateeId: r.evaluatee.id,
      evaluateeName: r.evaluatee.name,
      departmentName: r.evaluatee.department?.name ?? null,
      firstReviewerId: r.firstReviewer?.id ?? null,
      firstReviewerName: r.firstReviewer?.name ?? null,
      finalReviewerId: r.finalReviewer?.id ?? null,
      finalReviewerName: r.finalReviewer?.name ?? null,
    }));

    // 같은 시각을 모든 행에 적용한다 — 행마다 new Date() 를 부르면 경과일이 미세하게 어긋난다.
    const now = new Date();
    const waiting = flat
      .map((row) => resolveWaitingOn(row, now))
      .filter((w): w is MidtermWaitingRow => !!w);
    // 개시되지 않은 행(평가자 스냅샷 없는 pending)은 대기 목록에 섞지 않는다 —
    // 재촉해도 재배정해도 풀리지 않고, 필요한 조치는 "개시"뿐이라 목록을 나눈다.
    const notOpened = flat
      .map((row) => resolveNotOpened(row, now))
      .filter((r): r is MidtermNotOpenedRow => !!r)
      .sort((a, b) => b.waitingDays - a.waitingDays);

    return {
      data: {
        cycleId: cycle.id,
        cycleName: cycle.name,
        cycleStatus: cycle.status,
        counts: this.countByStage(flat),
        // 평가자 기다림 = 재촉 대상별로 묶어서(HR 은 "누구에게 몇 명 분"을 묻는다).
        waitingOnReviewer: groupWaitingByReviewer(waiting),
        // 본인(피평가자) 기다림 = 1인 1건이라 묶지 않고 오래 묵은 순으로.
        waitingOnMember: waiting
          .filter((w) => w.party === 'member')
          .sort((a, b) => b.waitingDays - a.waitingDays),
        // 개시된 건인데 한쪽 평가자만 비어 있는 경우 — 재촉이 아니라 재배정이 필요한 이상 상황.
        unassigned: waiting
          .filter((w) => w.party !== 'member' && !w.waitingUserId)
          .sort((a, b) => b.waitingDays - a.waitingDays),
        // 아직 개시되지 않은 건 — 조치는 재배정이 아니라 개시(또는 개시 대상 조건 확인)다.
        notOpened,
      },
    };
  }

  /** 단계별 인원수. 레거시 자가점검 상태는 한 덩어리(legacy)로 모은다. */
  private countByStage(rows: MidtermSummaryRow[]): MidtermStageCounts {
    const counts: MidtermStageCounts = {
      pending: 0,
      commented: 0,
      revised: 0,
      returned: 0,
      closed: 0,
      legacy: 0,
      notOpened: 0,
      unfinished: 0,
      total: rows.length,
    };
    for (const row of rows) {
      // 평가자 스냅샷이 없는 pending 은 신규 흐름 행이 아니다 — pending 에 섞으면
      // "1차 코멘트 대기"로 잘못 세어 기다릴 사람이 없는 건까지 병목으로 보인다.
      if (isNotOpenedRow(row)) {
        counts.notOpened += 1;
        continue;
      }
      if (!FLOW_STATUSES.includes(row.status)) {
        counts.legacy += 1;
        continue;
      }
      counts[row.status as 'pending' | 'commented' | 'revised' | 'returned' | 'closed'] += 1;
    }
    counts.unfinished =
      counts.pending + counts.commented + counts.revised + counts.returned;
    return counts;
  }
}

export type { MidtermNotOpenedRow, MidtermWaitingGroup, MidtermWaitingRow };
