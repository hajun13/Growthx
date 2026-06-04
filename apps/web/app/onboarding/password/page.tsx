'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PasswordChangeGate } from '@/components/PasswordChangeGate';
import { Spinner } from '@/components/States';
import { landingPath } from '@/lib/nav';

// 초기 비밀번호 강제 변경 게이트 — 셸 없는 풀스크린(라우트 그룹 밖).
export default function OnboardingPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, changePassword, logout } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 미인증 → 로그인. 이미 변경 완료(mustChangePassword=false) → 랜딩으로.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!user.mustChangePassword) {
      router.replace(landingPath(user.role));
    }
  }, [loading, user, router]);

  if (loading || !user || !user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-background">
        <Spinner />
      </div>
    );
  }

  async function handleSubmit(current: string, next: string) {
    setSubmitting(true);
    setServerError(null);
    try {
      await changePassword(current, next);
      toast.show({ variant: 'success', message: '비밀번호를 바꿨어요. 환영해요!' });
      // changePassword 가 user 를 갱신 → 위 useEffect 가 랜딩으로 이동.
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.';
      // 현재 비번 불일치는 현재 비번 필드 error 로 노출.
      setServerError(
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? '현재 비밀번호가 일치하지 않거나 정책에 맞지 않아요.'
          : msg,
      );
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PasswordChangeGate
      onSubmit={handleSubmit}
      onLogout={logout}
      submitting={submitting}
      serverError={serverError}
    />
  );
}
