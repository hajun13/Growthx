'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { Spinner } from '@/components/States';

// /eval/result → 본인 결과로 이동(사이드바 진입점).
export default function ResultIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { current, loading } = useCurrentCycle();

  useEffect(() => {
    if (loading || !user) return;
    const q = current ? `?cycleId=${current.id}` : '';
    router.replace(`/eval/result/${user.id}${q}`);
  }, [loading, user, current, router]);

  return <Spinner />;
}
