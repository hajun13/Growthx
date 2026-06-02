'use client';

import { apiGetList, apiPost } from '@/lib/api';
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

export const notificationCommands = {
  generate: (body: {
    cycleId: string;
    kind: NotificationKind;
    message: string;
  }) => apiPost<{ count: number; type: string }>('/notifications/generate', body),
  read: (id: string) =>
    apiPost<Notification>(`/notifications/${id}/read`),
};
