'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  PrimaryActionProvider,
  usePrimaryActionSlot,
} from '@/hooks/usePrimaryAction';
import { useDepartments } from '@/hooks/useDepartments';
import { useNotifications } from '@/hooks/useNotifications';
import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/States';
import { positionLabel } from '@/lib/ui';

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const primaryAction = usePrimaryActionSlot();
  // 부서명은 계약 User 에 없으므로 departments 조회로 해석(표시용).
  const { data: deptList } = useDepartments();
  // 읽지 않은 알림 수(상단 종 배지).
  const { data: notifs } = useNotifications(
    { unreadOnly: true },
    { enabled: !!user },
  );

  // user 는 가드에서 보장됨.
  if (!user) return null;

  const departmentName =
    deptList?.data.find((d) => d.id === user.departmentId)?.name ?? '';

  return (
    <AppShell
      role={user.role}
      pathname={pathname}
      notificationCount={notifs?.data.length ?? 0}
      user={{
        name: user.name,
        positionLabel: positionLabel[user.position],
        departmentName,
      }}
      onLogout={logout}
      primaryAction={primaryAction ?? undefined}
    >
      {children}
    </AppShell>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // 미인증 → 로그인 리다이렉트.
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    // 리다이렉트 진행 중
    return null;
  }

  return (
    <PrimaryActionProvider>
      <Shell>{children}</Shell>
    </PrimaryActionProvider>
  );
}
