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

  /** APP_BASE_URL 미설정 경고를 한 번만 남기기 위한 플래그(수신자마다 반복하면 로그가 묻힌다). */
  private warnedMissingBaseUrl = false;

  constructor(private readonly notifications: NotificationsService) {}

  async dispatch(intents: NotifyIntent[]): Promise<void> {
    const baseUrl = process.env.APP_BASE_URL;
    // 미설정이면 상대경로(`/eval/midterm`)로 떨어지는데, 메일 클라이언트에서는 클릭되지 않는다.
    // 동작(폴백)은 그대로 두고 — 알림이 아예 안 나가는 것보다는 낫다 — 운영자가 알아챌 수 있게
    // 첫 발송 때 한 번만 경고한다.
    if (!baseUrl && !this.warnedMissingBaseUrl) {
      this.warnedMissingBaseUrl = true;
      this.logger.warn(
        'APP_BASE_URL 이 설정되지 않아 중간점검 알림 링크가 상대경로로 나갑니다(메일에서 클릭 불가). 환경변수를 설정해 주세요.',
      );
    }
    const link = `${baseUrl ?? ''}/eval/midterm`;
    for (const intent of intents) {
      const summary = String(intent.payload.message ?? '중간점검 알림이 있어요.');
      try {
        await this.notifications.notifyUser(intent.userId, intent.type, {
          ...intent.payload,
          message: `${summary}\n\n내용 확인 → ${link}`,
        });
      } catch (err) {
        // 알림 실패가 업무 처리를 막지 않는다(기존 베스트 에포트 정책).
        // 다중 수신자 발송에서 일부만 실패했을 때 "누가 못 받았는지"를 알 수 있게 userId 를 남긴다.
        this.logger.warn(
          `midterm notify failed (${intent.type}, userId=${intent.userId}): ${(err as Error).message}`,
        );
      }
    }
  }
}
