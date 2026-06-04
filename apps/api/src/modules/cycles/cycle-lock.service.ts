import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** HTTP 423 Locked (HttpStatus enum 미수록 버전 대비 상수). */
const HTTP_LOCKED = 423;

/**
 * 평가 기간 잠금 (M3 Item 5).
 * 현재 날짜 기준 활성(startDate <= now <= dueDate) CycleSchedule 의 isLocked 를 확인해,
 * 잠금 시 423(PERIOD_LOCKED) 을 던진다.
 *
 * phase 문자열 매칭(하드코딩 후보 목록)은 비목록 phase 에서 잠금 우회가 가능해 제거했다.
 * 대신 날짜 윈도우로 '지금 활성인 단계' 를 직접 판정한다.
 *  - startDate 가 null(스키마 미보유) 이면 dueDate 만 기준(now <= dueDate).
 *  - 활성 schedule 이 하나도 없으면 개방(false).
 */
@Injectable()
export class CycleLockService {
  constructor(private readonly prisma: PrismaService) {}

  /** cycle 의 현재 활성 단계가 잠겨 있으면 423(PERIOD_LOCKED). */
  async assertKpiWritable(cycleId: string): Promise<void> {
    const schedules = await this.prisma.cycleSchedule.findMany({
      where: { cycleId },
      select: { startDate: true, dueDate: true, isLocked: true },
    });
    if (schedules.length === 0) return; // 일정 미설정 → 개방

    const now = new Date();
    // 현재 날짜가 [startDate, dueDate] 윈도우에 드는 활성 단계만 평가.
    const active = schedules.filter((s) => {
      const afterStart = s.startDate == null || s.startDate <= now;
      return afterStart && now <= s.dueDate;
    });
    // 활성 단계가 하나라도 잠겨 있으면 차단. 활성 단계 없으면 개방.
    const locked = active.some((s) => s.isLocked);

    if (locked) {
      // 필터가 { error: { code, message } } 봉투로 감싼다(상태 423).
      throw new HttpException(
        { code: 'PERIOD_LOCKED', message: '현재 KPI 작성 기간이 아닙니다' },
        HTTP_LOCKED, // 423
      );
    }
  }
}
