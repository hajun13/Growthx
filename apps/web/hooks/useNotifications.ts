'use client';

import { apiGet, apiGetList, apiPatch, apiPost } from '@/lib/api';
import type { Notification, NotificationKind } from '@/lib/types';
import { useAsync } from './useAsync';

export function useNotifications(
  params: { unreadOnly?: boolean } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<Notification>('/notifications', {
        unreadOnly: params.unreadOnly ? 'true' : undefined,
      }),
    [params.unreadOnly],
    options,
  );
}

// 미읽음 카운트 — { data: { count } }.
export function useUnreadCount(options: { enabled?: boolean } = {}) {
  return useAsync(
    () => apiGet<{ count: number }>('/notifications/unread-count'),
    [],
    options,
  );
}

export const notificationCommands = {
  generate: (body: {
    cycleId: string;
    kind: NotificationKind;
    message: string;
  }) =>
    apiPost<{ count: number; type: string; emailMode: 'smtp' | 'console' }>(
      '/notifications/generate',
      body,
    ),
  // M2-C2: 인앱 읽음 처리는 PATCH.
  read: (id: string) =>
    apiPatch<Notification>(`/notifications/${id}/read`),
  readAll: () =>
    apiPatch<{ updated: number }>('/notifications/read-all'),
};
