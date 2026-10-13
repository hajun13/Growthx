'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, BellOff, CheckCheck, Clock, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationItem } from '@/components/NotificationItem';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { notificationCategory, notificationHref } from '@/lib/ui';
import { useNotificationsData } from '../hooks';
import type { Notification } from '../api';

type FilterKey = 'all' | 'unread' | 'deadline' | 'kpi' | 'midterm' | 'result' | 'appeal';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'unread', label: '안읽음' },
  { key: 'deadline', label: '일정' },
  { key: 'kpi', label: 'KPI' },
  { key: 'midterm', label: '중간점검' },
  { key: 'result', label: '결과' },
  { key: 'appeal', label: '이의제기' },
];

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
      toast.error(err instanceof ApiError ? err.message : '읽음 처리에 실패했어요.', {
        duration: 8000,
      });
    }
  }

  async function handleReadAll() {
    try {
      await markAllRead();
      toast.success('모두 읽음 처리했어요.');
      void reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '처리에 실패했어요.', {
        duration: 8000,
      });
    }
  }

  if (loading && items.length === 0)
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Card>
          <CardContent className="p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 border-b border-border">
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </CardContent>
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
            <Button variant="outline" onClick={() => void handleReadAll()}>
              <CheckCheck aria-hidden />
              모두 읽음
            </Button>
          ) : (
            <Button variant="outline" disabled>
              모두 읽음
            </Button>
          )
        }
      />

      <Card>
        <div className="border-b border-border">
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
            <CardTitle className="text-15 leading-5.5 font-bold text-foreground">
              알림 처리 흐름
            </CardTitle>
          </CardHeader>
        </div>
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <NotificationMetric label="읽지 않음" value={`${unreadCount}건`} emphasis={unreadCount > 0} />
            <NotificationMetric label="마감 관련" value={`${deadlineCount}건`} />
            <NotificationMetric label="처리 필요" value={`${actionCount}건`} emphasis={actionCount > 0} />
          </div>
          <p className="mt-3 text-12 leading-5 text-muted-foreground">
            안읽음 목록에서 마감·KPI·이의제기 알림을 먼저 열면 해당 업무 화면으로 바로 이동합니다.
            읽음 처리된 알림은 날짜별로 보관되어 처리 이력을 다시 확인할 수 있어요.
          </p>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={(k) => setFilter(k as FilterKey)} className="w-full">
        <TabsList>
          {FILTER_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              <span className="inline-flex items-center gap-2">
                {tab.label}
                {tab.key === 'unread' && unreadCount > 0 && (
                  <Badge variant="secondary">{unreadCount}</Badge>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive" className="flex flex-col items-start gap-3">
          <AlertTriangle className="size-4" aria-hidden />
          <div>
            <AlertTitle>문제가 발생했어요</AlertTitle>
            <AlertDescription>잠시 문제가 생겼어요. 다시 시도해 주세요.</AlertDescription>
          </div>
          <Button variant="outline" size="sm" onClick={reload}>
            다시 시도
          </Button>
        </Alert>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="rounded-lg border border-dashed border-border bg-muted/20">
              <Empty className="min-h-32">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileSearch aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>
                    {filter === 'unread' ? '읽지 않은 알림이 없어요.' : '새 알림이 없어요.'}
                  </EmptyTitle>
                  <EmptyDescription>
                    {filter === 'unread'
                      ? '모든 알림을 확인했어요.'
                      : '새로운 알림이 오면 여기에 표시돼요.'}
                  </EmptyDescription>
                </EmptyHeader>
                {filter !== 'all' && (
                  <EmptyContent>
                    <Button variant="outline" onClick={() => setFilter('all')}>
                      전체 알림 보기
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 안읽음 섹션 */}
          {unreadFiltered.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted">
                <Bell size={14} aria-hidden className="text-primary" />
                <span className="text-12 font-bold text-primary">안읽음</span>
                <Badge variant="solid-primary" shape="pill" size="xs" className="ml-0.5">
                  {unreadFiltered.length}
                </Badge>
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
                  <span className="text-12 font-bold text-muted-foreground">읽음</span>
                </div>
              )}
              <div className="flex flex-col bg-card">
                {readGroups.map((group, gi) => (
                  <div key={group.label}>
                    <div
                      className={cn(
                        'px-4 py-2 flex items-center gap-2 bg-muted',
                        gi > 0 && 'border-t border-border',
                      )}
                    >
                      <Clock size={11} aria-hidden className="text-muted-foreground" />
                      <span className="text-10h font-semibold text-muted-foreground uppercase tracking-wide">
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
            <p className="text-center text-12 text-muted-foreground pt-1">
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
      <div className="text-11 font-semibold text-muted-foreground">{label}</div>
      <div className={cn('mt-1 tabular-nums text-18 font-bold', emphasis ? 'text-primary' : 'text-foreground')}>
        {value}
      </div>
    </div>
  );
}
