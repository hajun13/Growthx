'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/Button';
import { NotificationItem } from '@/components/NotificationItem';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { notificationCategory, notificationHref } from '@/lib/ui';
import { useNotificationsData } from '../hooks';
import type { Notification } from '../api';

// ── Kinetic Enterprise 팔레트 ───────────────────────────────────
const K = {
  primary: '#7a37d8',
  secondary: '#7A37D8',
  tertiary: '#2563eb',
  surface: '#f7f7f9',
  surfaceLow: '#efeff2',
  white: '#ffffff',
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#ccccd4',
} as const;

const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

type FilterKey = 'all' | 'unread' | 'deadline' | 'kpi' | 'result' | 'appeal';

// 날짜 그룹 레이블
function dateSectionLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '이전';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// 알림을 날짜별로 그룹화
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

  // 안읽음 / 읽음 분리
  const unreadFiltered = filtered.filter((n) => n.readAt === null);
  const readFiltered = filtered.filter((n) => n.readAt !== null);

  // 읽음 그룹 (날짜별)
  const readGroups = useMemo(() => groupByDate(readFiltered), [readFiltered]);

  async function handleRead(n: Notification) {
    try {
      if (n.readAt === null) await markRead(n.id);
      void reload();
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

  // 스켈레톤 (첫 로딩에만)
  if (loading && items.length === 0)
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-[#efeff2]">
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        title="알림"
        subtitle="마감·반려·결과 확정 알림을 한곳에서 확인하세요."
        right={
          unreadCount > 0 ? (
            <button
              onClick={() => void handleReadAll()}
              className="flex items-center gap-1.5 px-3.5 py-2 transition-colors"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: K.secondary,
                border: `1px solid ${K.secondary}`,
                borderRadius: 8,
                background: K.white,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(122,55,216,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = K.white;
              }}
            >
              <CheckCheck size={14} />
              모두 읽음
            </button>
          ) : (
            <Button variant="secondary" disabled>
              모두 읽음
            </Button>
          )
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

      {error ? (
        <ErrorState onRetry={reload} />
      ) : filtered.length === 0 ? (
        <div
          className="bg-white rounded-xl"
          style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
        >
          <EmptyState
            title={filter === 'unread' ? '읽지 않은 알림이 없어요.' : '새 알림이 없어요.'}
            description={
              filter === 'unread'
                ? '모든 알림을 확인했어요.'
                : '새로운 알림이 오면 여기에 표시돼요.'
            }
            action={
              filter !== 'all' ? (
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: K.secondary,
                    border: `1px solid ${K.secondary}`,
                    borderRadius: 8,
                    background: K.white,
                    cursor: 'pointer',
                  }}
                >
                  전체 알림 보기
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 안읽음 섹션 */}
          {unreadFiltered.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3 border-b"
                style={{ background: 'rgba(122,55,216,0.04)', borderColor: '#e3e3e8' }}
              >
                <Bell size={14} color={K.secondary} />
                <span style={{ fontSize: 12, fontWeight: 700, color: K.secondary }}>
                  안읽음
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#fff',
                    background: K.secondary,
                    padding: '1px 7px',
                    borderRadius: 999,
                    marginLeft: 2,
                  }}
                >
                  {unreadFiltered.length}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-[#efeff2]">
                {unreadFiltered.map((n) => (
                  <div key={n.id} style={{ background: 'rgba(122,55,216,0.025)' }}>
                    <NotificationItem data={n} onClick={() => void handleRead(n)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 읽음 섹션 — 날짜별 그룹 */}
          {readFiltered.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
            >
              {unreadFiltered.length > 0 && (
                <div
                  className="flex items-center gap-2 px-4 py-3 border-b"
                  style={{ background: K.surfaceLow, borderColor: '#e3e3e8' }}
                >
                  <BellOff size={14} color={K.onSurfaceVariant} />
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: K.onSurfaceVariant }}
                  >
                    읽음
                  </span>
                </div>
              )}
              <div className="flex flex-col bg-white">
                {readGroups.map((group, gi) => (
                  <div key={group.label}>
                    <div
                      className="px-4 py-2 flex items-center gap-2"
                      style={{
                        background: K.surfaceLow,
                        borderTop: gi > 0 ? '1px solid #e3e3e8' : undefined,
                      }}
                    >
                      <Clock size={11} color={K.onSurfaceVariant} />
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: K.onSurfaceVariant,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {group.label}
                      </span>
                    </div>
                    <div className="flex flex-col divide-y divide-[#efeff2]">
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
            <p
              className="text-center"
              style={{ fontSize: 12, color: K.onSurfaceVariant, paddingTop: 4 }}
            >
              이전에 읽은 알림이 없어요.
            </p>
          )}
        </div>
      )}
    </PageContainer>
  );
}
