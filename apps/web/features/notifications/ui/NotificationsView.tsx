'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NotificationItem } from '@/components/NotificationItem';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { notificationCategory, notificationHref } from '@/lib/ui';
import { useNotificationsData } from '../hooks';
import type { Notification } from '../api';

type FilterKey = 'all' | 'unread' | 'deadline' | 'kpi' | 'midterm' | 'result' | 'appeal';

// 날짜 그룹 레이블
function dateSectionLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '이전';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function groupByDate(
  items: Notification[],
): Array<{ label: string; items: Notification[] }> {
  const groups = new Map<string, Notification[]>();
  for (const n of items) {
    const label = dateSectionLabel(n.createdAt);
    const arr = groups.get(label) ?? [];
    arr.push(n);
    groups.set(label, arr);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function NotificationsView() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { items, loading, error, reload, markRead, markAllRead } =
    useNotificationsData(!!user);
  const [filter, setFilter] = useState<FilterKey>('all');

  const unreadCount = useMemo(
    () => items.filter((n) => n.readAt === null).length,
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter((n) => n.readAt === null);
    return items.filter((n) => notificationCategory(n.type) === filter);
  }, [items, filter]);

  const unreadFiltered = filtered.filter((n) => n.readAt === null);
  const readFiltered = filtered.filter((n) => n.readAt !== null);
  const readGroups = useMemo(() => groupByDate(readFiltered), [readFiltered]);
  const deadlineCount = useMemo(
    () => items.filter((n) => notificationCategory(n.type) === 'deadline').length,
    [items],
  );
  const actionCount = useMemo(
    () =>
      items.filter((n) => {
        const category = notificationCategory(n.type);
        return n.readAt === null && (category === 'deadline' || category === 'kpi' || category === 'appeal');
      }).length,
    [items],
  );

  async function handleRead(n: Notification) {
    try {
      if (n.readAt === null) await markRead(n.id);
      void reload();
      const href = notificationHref(n.type);
      if (href) router.push(href);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '읽음 처리에 실패했어요.',
      });
    }
  }

  async function handleReadAll() {
    try {
      await markAllRead();
      toast.show({ variant: 'success', message: '모두 읽음 처리했어요.' });
      void reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    }
  }

  if (loading && items.length === 0)
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Card padding="sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-border">
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </Card>
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        title="알림"
        subtitle="마감·반려·결과 확정 알림을 한곳에서 확인하세요."
        right={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void handleReadAll()}
              leftIcon={<CheckCheck size={14} aria-hidden />}
            >
              모두 읽음
            </Button>
          ) : (
            <Button variant="secondary" disabled>
              모두 읽음
            </Button>
          )
        }
      />

      <Card title="알림 처리 흐름">
        <div className="grid gap-3 sm:grid-cols-3">
          <NotificationMetric label="읽지 않음" value={`${unreadCount}건`} emphasis={unreadCount > 0} />
          <NotificationMetric label="마감 관련" value={`${deadlineCount}건`} />
          <NotificationMetric label="처리 필요" value={`${actionCount}건`} emphasis={actionCount > 0} />
        </div>
        <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
          안읽음 목록에서 마감·KPI·이의제기 알림을 먼저 열면 해당 업무 화면으로 바로 이동합니다.
          읽음 처리된 알림은 날짜별로 보관되어 처리 이력을 다시 확인할 수 있어요.
        </p>
      </Card>

      <Tabs
        items={[
          { key: 'all',      label: '전체' },
          { key: 'unread',   label: '안읽음', badge: unreadCount || undefined },
          { key: 'deadline', label: '일정' },
          { key: 'kpi',      label: 'KPI' },
          { key: 'midterm',  label: '중간점검' },
          { key: 'result',   label: '결과' },
          { key: 'appeal',   label: '이의제기' },
        ]}
        activeKey={filter}
        onChange={(k) => setFilter(k as FilterKey)}
      />

      {error ? (
        <ErrorState onRetry={reload} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={filter === 'unread' ? '읽지 않은 알림이 없어요.' : '새 알림이 없어요.'}
            description={
              filter === 'unread'
                ? '모든 알림을 확인했어요.'
                : '새로운 알림이 오면 여기에 표시돼요.'
            }
            action={
              filter !== 'all' ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  전체 알림 보기
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 안읽음 섹션 */}
          {unreadFiltered.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted">
                <Bell size={14} aria-hidden className="text-primary" />
                <span className="text-[12px] font-bold text-primary">안읽음</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-bold bg-primary text-primary-foreground ml-0.5">
                  {unreadFiltered.length}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {unreadFiltered.map((n) => (
                  <div key={n.id} className="bg-muted/30">
                    <NotificationItem data={n} onClick={() => void handleRead(n)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 읽음 섹션 — 날짜별 그룹 */}
          {readFiltered.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {unreadFiltered.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted">
                  <BellOff size={14} aria-hidden className="text-muted-foreground" />
                  <span className="text-[12px] font-bold text-muted-foreground">읽음</span>
                </div>
              )}
              <div className="flex flex-col bg-card">
                {readGroups.map((group, gi) => (
                  <div key={group.label}>
                    <div
                      className={`px-4 py-2 flex items-center gap-2 bg-muted ${gi > 0 ? 'border-t border-border' : ''}`}
                    >
                      <Clock size={11} aria-hidden className="text-muted-foreground" />
                      <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.04em]">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex flex-col divide-y divide-border">
                      {group.items.map((n) => (
                        <NotificationItem
                          key={n.id}
                          data={n}
                          onClick={() => void handleRead(n)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {readFiltered.length === 0 && unreadFiltered.length > 0 && (
            <p className="text-center text-[12px] text-muted-foreground pt-1">
              이전에 읽은 알림이 없어요.
            </p>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function NotificationMetric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums text-[18px] font-bold ${emphasis ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}
