'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications, notificationCommands } from '@/hooks/useNotifications';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/Button';
import { NotificationItem } from '@/components/NotificationItem';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { notificationCategory, notificationHref } from '@/lib/ui';
import type { Notification } from '@/lib/types';

type FilterKey = 'all' | 'unread' | 'deadline' | 'kpi' | 'result' | 'appeal';

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useNotifications(
    {},
    { enabled: !!user },
  );
  const [filter, setFilter] = useState<FilterKey>('all');
  const items: Notification[] = data?.data ?? [];

  const unreadCount = useMemo(
    () => items.filter((n) => n.readAt === null).length,
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => n.readAt === null);
    return items.filter((n) => notificationCategory(n.type) === filter);
  }, [items, filter]);

  async function handleRead(n: Notification) {
    try {
      if (n.readAt === null) await notificationCommands.read(n.id);
      reload();
      const href = notificationHref(n.type);
      if (href) router.push(href);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : '읽음 처리에 실패했어요.',
      });
    }
  }

  async function handleReadAll() {
    try {
      await notificationCommands.readAll();
      toast.show({ variant: 'success', message: '모두 읽음 처리했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="알림"
        subtitle="마감·반려·결과 확정 알림을 한곳에서 확인하세요."
        right={
          <Button
            variant="secondary"
            disabled={unreadCount === 0}
            onClick={() => void handleReadAll()}
          >
            모두 읽음
          </Button>
        }
      />

      <Tabs
        items={[
          { key: 'all', label: '전체' },
          { key: 'unread', label: '안읽음', badge: unreadCount || undefined },
          { key: 'deadline', label: '일정' },
          { key: 'kpi', label: 'KPI' },
          { key: 'result', label: '결과' },
          { key: 'appeal', label: '이의제기' },
        ]}
        activeKey={filter}
        onChange={(k) => setFilter(k as FilterKey)}
      />

      <Card>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState title="새 알림이 없어요." />
        ) : (
          <div className="flex flex-col">
            {filtered.map((n) => (
              <NotificationItem
                key={n.id}
                data={n}
                onClick={() => void handleRead(n)}
              />
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
