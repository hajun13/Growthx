'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { landingPath } from '@/lib/nav';

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
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)]">
        <section className="hidden bg-[#0e0e14] px-10 py-10 text-white lg:flex lg:flex-col">
          <Image
            src="/energyx-logo.png"
            alt="에너지엑스"
            width={172}
            height={29}
            quality={100}
            style={{ filter: 'brightness(0) invert(1)', height: 'auto' }}
            priority
          />
          <div className="mt-auto">
            <p className="text-[13px] font-semibold text-white/70">에너지엑스 인사 평가</p>
            <h1 className="mt-3 max-w-md text-[34px] font-black leading-[1.28] text-white">
              오늘 처리할 평가 업무를 한 화면에서 확인합니다.
            </h1>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {[
                ['업무 컨텍스트', '현재 평가 주기와 단계 확인'],
                ['즉시 할 일', 'KPI 작성, 본인평가, 결과 확인'],
                ['주요 데이터', '진행률과 공개 결과 요약'],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[128px_minmax(0,1fr)] gap-4 py-4 text-[14px]">
                  <span className="font-bold text-white/60">{label}</span>
                  <span className="font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 md:px-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 lg:hidden">
              <Image
                src="/energyx-logo.png"
                alt="에너지엑스"
                width={156}
                height={26}
                quality={100}
                style={{ height: 'auto', objectFit: 'contain' }}
                priority
              />
            </div>

            <div className="mb-7 border-b border-border pb-5">
              <h2 className="text-[24px] font-black text-foreground">로그인</h2>
              <p className="mt-2 text-[13px] font-medium leading-6 text-muted-foreground">
                업무 계정으로 접속해 오늘 처리할 평가 업무를 확인하세요.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={emailId} className="text-[11px] font-semibold text-muted-foreground">
                  아이디<span className="ml-0.5 text-danger-600">*</span>
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id={emailId}
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="이메일 주소를 입력하세요"
                    required
                    autoComplete="username"
                    className={[
                      'pl-9',
                      emailError ? 'border-danger-500 focus-visible:border-danger-500 focus-visible:ring-danger-500/30' : '',
                    ].join(' ')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') document.getElementById(passwordId)?.focus();
                    }}
                  />
                </div>
                {emailError && <p className="mt-0.5 text-[11px] text-danger-600">{emailError}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={passwordId} className="text-[11px] font-semibold text-muted-foreground">
                  비밀번호<span className="ml-0.5 text-danger-600">*</span>
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    required
                    autoComplete="current-password"
                    className={[
                      'pl-9 pr-10',
                      passwordError ? 'border-danger-500 focus-visible:border-danger-500 focus-visible:ring-danger-500/30' : '',
                    ].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                  </button>
                </div>
                {passwordError && <p className="mt-0.5 text-[11px] text-danger-600">{passwordError}</p>}
              </div>

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

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!canSubmit || submitting}
                loading={submitting}
              >
                로그인
              </Button>
            </form>

            <div className="my-6 border-t border-border" />

            <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="mb-1 text-[11.5px] font-bold text-primary">보안 안내</p>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  안전한 시스템 사용을 위해 비밀번호를 주기적으로 변경해 주세요.
                  <br />
                  타인과 비밀번호를 공유하지 마세요.
                </p>
              </div>
            </div>

            <p className="mt-5 text-center text-[10.5px] text-muted-foreground/70">
              © 2026 에너지엑스 · 인사 평가 시스템
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
