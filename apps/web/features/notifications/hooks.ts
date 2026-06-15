'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from './api';

/** 알림 목록 로드 + 읽음 처리 커맨드. 생성 클라이언트(@growthx/contracts) 기반. */
export function useNotificationsData(enabled: boolean) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchNotifications());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    loading,
    error,
    reload,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  };
}
