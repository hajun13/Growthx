import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotifyIntent } from './midterm-review-flow.service';

/**
 * 중간점검 알림·메일 트리거.
 * 반드시 **상태 전이 트랜잭션이 커밋된 뒤** 호출한다(롤백돼도 메일이 나가는 것을 막기 위함).
 * 본문은 '요약 + 링크'만 — 평가 코멘트 전문은 메일에 싣지 않는다.
 */
@Injectable()
export class MidtermNotifyService {
  private readonly logger = new Logger(MidtermNotifyService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async dispatch(intents: NotifyIntent[]): Promise<void> {
    const link = `${process.env.APP_BASE_URL ?? ''}/eval/midterm`;
    for (const intent of intents) {
      const summary = String(intent.payload.message ?? '중간점검 알림이 있어요.');
      try {
        await this.notifications.notifyUser(intent.userId, intent.type, {
          ...intent.payload,
          message: `${summary}\n\n내용 확인 → ${link}`,
        });
      } catch (err) {
        // 알림 실패가 업무 처리를 막지 않는다(기존 베스트 에포트 정책).
        this.logger.warn(`midterm notify failed (${intent.type}): ${(err as Error).message}`);
      }
    }
  }
}
