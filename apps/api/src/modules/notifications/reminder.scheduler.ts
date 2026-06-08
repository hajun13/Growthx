import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

/**
 * 일정 자동화: 매일 09:00(서버 시간) 단계별 D-N 리마인더를 자동 발송한다.
 * 실제 발송 로직·멱등 보장은 NotificationsService.runDueReminders 가 담당하고,
 * 이 스케줄러는 "언제 돌릴지"만 책임진다(HR 수동 트리거와 동일 로직 공유).
 */
@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'daily-deadline-reminders' })
  async handleDailyReminders(): Promise<void> {
    try {
      const { data } = await this.notifications.runDueReminders();
      if (data.batches > 0) {
        this.logger.log(
          `마감 리마인더 자동 발송 — ${data.batches}건 단계 / ${data.recipients}명`,
        );
      }
    } catch (err) {
      // 자동 작업 실패가 앱을 죽이지 않도록 삼키고 로깅만.
      this.logger.error('마감 리마인더 자동 발송 실패', err as Error);
    }
  }
}
