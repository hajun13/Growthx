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

type FilterKey = 'all' | 'unread' | 'deadline' | 'kpi' | 'result' | 'appeal';

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

      <Tabs
        items={[
          { key: 'all',      label: '전체' },
          { key: 'unread',   label: '안읽음', badge: unreadCount || undefined },
          { key: 'deadline', label: '일정' },
          { key: 'kpi',      label: 'KPI' },
          { key: 'result',   label: '결과' },
          { key: 'appeal',   label: '이의제기' },
        ]}
        activeKey={filter}
        onChange={(k) => setFilter(k as FilterKey)}
      />

      <section className="gx-panel grid gap-0 overflow-hidden md:grid-cols-3">
        {[
          { label: '전체 알림', value: `${items.length}건`, sub: '현재 필터 기준 전' },
          { label: '안읽음', value: `${unreadCount}건`, sub: unreadCount > 0 ? '먼저 확인하세요' : '모두 확인 완료', accent: unreadCount > 0 ? 'text-primary' : 'text-success-700' },
          { label: '일정 알림', value: `${deadlineCount}건`, sub: '마감·일정 관련', accent: 'text-warning-700' },
        ].map((item, index) => (
          <div key={item.label} className="flex min-h-[84px] items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[12px] font-semibold text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-[20px] font-extrabold tabular-nums ${item.accent ?? 'text-foreground'}`}>{item.value}</p>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">{item.sub}</p>
            </div>
            {index < 2 && <div className="hidden h-10 w-px bg-border md:block" />}
          </div>
        ))}
      </section>

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
            <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-purple-50">
                <Bell size={14} aria-hidden className="text-primary" />
                <span className="text-[12px] font-bold text-primary">안읽음</span>
                <span className="ml-0.5 rounded-lg bg-primary px-1.5 py-0.5 text-[10.5px] font-bold text-primary-foreground">
                  {unreadFiltered.length}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {unreadFiltered.map((n) => (
                  <div key={n.id} className="bg-purple-50/30">
                    <NotificationItem data={n} onClick={() => void handleRead(n)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 읽음 섹션 — 날짜별 그룹 */}
          {readFiltered.length > 0 && (
            <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
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
