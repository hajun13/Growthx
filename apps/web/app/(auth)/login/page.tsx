'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { landingPath } from '@/lib/nav';
import { LoginFormFields } from './LoginFormFields';

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F9FD] px-6 py-10">
      {/* 은은한 배경 장식 — 민트/블루 포인트, 과장 없는 정도로만 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-[#0257CE]/[0.06] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-16 h-[420px] w-[420px] rounded-full bg-[#0ED0D9]/[0.08] blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* 브랜드 로고 */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image
            src="/energyx-logo.png"
            alt="ENERGYX"
            width={140}
            height={24}
            quality={100}
            style={{ height: 'auto', objectFit: 'contain' }}
            priority
          />
          <p className="text-[12px] font-medium text-[#6B6980]">인사 평가 시스템</p>
        </div>

        {/* 로그인 카드 */}
        <div className="rounded-[10px] border border-[#E7E9F3] bg-white px-8 py-9 shadow-[0_1px_3px_rgba(22,19,38,0.06),0_1px_2px_rgba(22,19,38,0.04)]">
          <h2 className="mb-1 text-[19px] font-bold tracking-tight text-[#161326]">
            로그인
          </h2>
          <p className="mb-6 text-[13px] text-[#6B6980]">
            아이디와 비밀번호를 입력해 주세요.
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
              className="flex cursor-pointer items-center gap-2 text-[13px] text-[#6B6980]"
            >
              <input
                id={saveIdId}
                type="checkbox"
                checked={saveId}
                onChange={(e) => setSaveId(e.target.checked)}
                className="h-4 w-4 rounded accent-[#0257CE]"
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
              className="mt-1 h-11 rounded-[8px] bg-[#0257CE] text-[14px] font-semibold hover:bg-[#0246A8]"
            >
              로그인
            </Button>
          </form>

          {/* 보안 안내 — 절제된 형태(접힘 없이 짧게 1줄) */}
          <div className="mt-6 flex items-center gap-2 rounded-[8px] bg-[#F4F5FA] px-3.5 py-2.5">
            <ShieldCheck size={14} className="shrink-0 text-[#6B6980]" aria-hidden />
            <p className="text-[11.5px] leading-relaxed text-[#6B6980]">
              비밀번호는 주기적으로 변경하고 타인과 공유하지 마세요.
            </p>
          </div>
        </div>

        {/* 브랜드 푸터 */}
        <p className="mt-6 text-center text-[11px] text-[#9B98AC]">
          © 2026 에너지엑스 · 인사 평가 시스템
        </p>
      </div>
    </div>
  );
}
