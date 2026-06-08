import { BadRequestException } from '@nestjs/common';
import { CycleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Model B(1주기·체크포인트) 단계 게이팅 헬퍼.
 *
 * 6월 중간평가(mid_review)는 **비구속 체크포인트** — 등급/보상/역량평가 산정은
 * calibration(조정) 또는 closed(완료) 단계에서만 허용한다. draft/active/mid_review 에서는 차단.
 *
 * cycleType(MIDTERM/FINAL) 이 아니라 cycle.status 기준으로 판정한다(Model B 정합화).
 */

/** 최종평가(조정/완료) 단계인지. calibration | closed 만 true. */
export function isFinalStage(status: CycleStatus): boolean {
  return status === CycleStatus.calibration || status === CycleStatus.closed;
}

/**
 * cycleId 의 현재 단계가 최종(calibration/closed)이 아니면 400(VALIDATION_ERROR)으로 차단.
 * 등급·보상·역량평가 산정 진입부에서 호출.
 * @param message 차단 시 노출 메시지(기능별 문구).
 */
export async function assertFinalStage(
  prisma: PrismaService,
  cycleId: string,
  message: string,
): Promise<void> {
  const cycle = await prisma.evaluationCycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  });
  // 주기를 못 찾으면 단계 판정 불가 → 차단(보수적).
  if (!cycle || !isFinalStage(cycle.status)) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
  }
}

/**
 * ④ KPI 목표 재조정(re-baseline) 윈도우 게이팅.
 *
 * 6월 중간평가에서 KPI 목표·가중치를 **사유와 함께 변경**하는 별도 액션은
 * `mid_review` 단계에서만 허용한다. draft/active/calibration/closed 에서는 차단(400).
 *  - active 단계의 일반 KPI 작성/수정(KpiStatus draft)과는 별개 경로다.
 *  - calibration/closed(최종 산정 진행/완료) 이후에는 목표를 흔들 수 없다.
 * 주기를 못 찾으면 보수적으로 차단.
 * @param message 차단 시 노출 메시지.
 */
export async function assertMidReviewStage(
  prisma: PrismaService,
  cycleId: string,
  message: string,
): Promise<void> {
  const cycle = await prisma.evaluationCycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  });
  if (!cycle || cycle.status !== CycleStatus.mid_review) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message });
  }
}
