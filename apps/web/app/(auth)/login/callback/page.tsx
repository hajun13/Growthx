'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeSsoLogin } from '@/lib/oidc';
import { setSession } from '@/lib/auth';
import { apiPost, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

interface SsoSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export default function SsoCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode 는 effect 를 2회 실행한다. 인가 코드는 1회용이라
  // 두 번째 교환이 반드시 실패하므로 가드한다.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const kcAccessToken = await completeSsoLogin();
        const session = await apiPost<SsoSession>(
          '/auth/sso',
          { kcAccessToken },
          { skipAuth: true },
        );
        setSession(
          { accessToken: session.accessToken, refreshToken: session.refreshToken },
          session.user,
        );
        router.replace('/dashboard');
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          setError('연결된 사용자 계정이 없어요. 관리자에게 문의해 주세요.');
        } else if (e instanceof ApiError && e.status === 409) {
          setError('이미 다른 SSO 계정에 연결된 사용자예요. 관리자에게 문의해 주세요.');
        } else {
          setError('로그인에 실패했어요. 다시 시도해 주세요.');
        }
      }
    })();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => router.replace('/login')}
          className="text-sm underline"
        >
          로그인으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-500">로그인 중이에요…</p>
    </div>
  );
}
