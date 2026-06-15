/**
 * notifications feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  notificationsControllerList,
  notificationsControllerMarkAllRead,
  notificationsControllerMarkRead,
  notificationsControllerUnreadCount,
  type NotificationDto,
} from '@growthx/contracts';

export type Notification = NotificationDto;

export async function fetchNotifications(
  unreadOnly?: boolean,
): Promise<Notification[]> {
  const res = await notificationsControllerList(
    unreadOnly ? { unreadOnly: 'true' } : undefined,
  );
  return res.data.data ?? [];
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await notificationsControllerUnreadCount();
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await notificationsControllerMarkRead(id);
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await notificationsControllerMarkAllRead();
  return res.data.data.updated;
}
