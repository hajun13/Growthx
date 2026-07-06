'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { landingPath } from '@/lib/nav';
import { LoginFormFields } from './LoginFormFields';
import { LoginHeroPanel } from './LoginHeroPanel';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, login, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveId, setSaveId] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const emailId = useId();
  const passwordId = useId();
  const saveIdId = useId();

  // 이미 로그인 → 역할별 랜딩
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(
        user.mustChangePassword ? '/onboarding/password' : landingPath(user.role),
      );
    }
  }, [authLoading, user, router]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  function handleEmailChange(v: string) {
    setEmail(v);
    if (emailError) setEmailError(null);
    if (passwordError) setPasswordError(null);
  }
  function handlePasswordChange(v: string) {
    setPassword(v);
    if (passwordError) setPasswordError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    if (!email.trim()) {
      setEmailError('아이디를 입력해 주세요.');
      return;
    }
    if (!password) {
      setPasswordError('비밀번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setEmailError(null);
    setPasswordError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const isUnauth = err instanceof ApiError && err.isUnauthorized;
      const msg = isUnauth
        ? '아이디 또는 비밀번호를 확인해 주세요.'
        : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
      setPasswordError(msg);
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* 좌측 브랜드 히어로 */}
      <LoginHeroPanel />

      {/* 우측 로그인 영역 */}
      <div className="flex w-full flex-col lg:w-1/2 xl:w-[45%]">
        {/* 로그인 카드 */}
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="w-full max-w-[420px] rounded-lg border border-border bg-white px-9 py-10 shadow-elev-1">
            {/* 브랜드 로고 */}
            <div className="mb-7 flex flex-col items-center gap-1.5">
              <Image
                src="/energyx-logo.png"
                alt="ENERGYX"
                width={150}
                height={26}
                quality={100}
                style={{ height: 'auto', objectFit: 'contain' }}
                priority
              />
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
                KPI PERFORMANCE SYSTEM
              </p>
            </div>

            <h2 className="mb-1 text-center text-[22px] font-bold tracking-tight text-foreground">
              로그인
            </h2>
            <p className="mb-7 text-center text-[13px] text-muted-foreground">
              아이디와 비밀번호를 입력하여 로그인해 주세요.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <LoginFormFields
                emailId={emailId}
                passwordId={passwordId}
                email={email}
                password={password}
                showPassword={showPassword}
                emailError={emailError}
                passwordError={passwordError}
                onEmailChange={handleEmailChange}
                onPasswordChange={handlePasswordChange}
                onTogglePassword={() => setShowPassword((v) => !v)}
              />

              {/* 옵션 행: 아이디 저장 */}
              <label
                htmlFor={saveIdId}
                className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground"
              >
                <input
                  id={saveIdId}
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                아이디 저장
              </label>

              {/* 로그인 버튼 */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!canSubmit || submitting}
                loading={submitting}
                className="mt-1 h-11 rounded-md bg-primary text-[14px] font-semibold hover:bg-info-600"
              >
                로그인
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
