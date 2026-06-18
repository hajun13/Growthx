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
    <div className="flex min-h-screen">
      {/* ─── 좌측 히어로 (데스크탑 전용) ─── */}
      <div className="relative hidden flex-[3] md:flex">
        <Image
          src="/login-hero.jpg"
          alt="에너지엑스 사옥"
          fill
          quality={95}
          sizes="60vw"
          className="object-cover"
          priority
        />
        {/* 솔리드 잉크 틴트 오버레이 */}
        <div className="absolute inset-0" style={{ background: 'rgba(14,14,20,0.42)' }} />
        {/* 히어로 콘텐츠 */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12 lg:px-24">
          <div className="mb-14">
            <Image
              src="/energyx-logo.png"
              alt="에너지엑스"
              width={184}
              height={31}
              quality={100}
              className="mb-3"
              style={{ filter: 'brightness(0) invert(1)', height: 'auto' }}
              priority
            />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white">
              인사 평가 시스템
            </p>
          </div>

          <h1
            className="mb-7 break-keep font-extrabold text-white xl:text-[44px]"
            style={{ fontSize: 38, letterSpacing: '-0.025em', lineHeight: 1.34 }}
          >
            성과를 데이터로 연결하고
            <br />
            더 공정하게 평가합니다
          </h1>

          <p
            className="max-w-lg break-keep text-white"
            style={{ fontSize: 16, letterSpacing: '-0.01em', lineHeight: 1.85 }}
          >
            KPI 수립부터 중간점검, 본인평가, 상사평가,
            <br />
            등급 산정과 보상 연계까지 하나의 흐름으로 관리하는
            <br />
            에너지엑스 맞춤형 성과관리 솔루션입니다.
          </p>
        </div>
      </div>

      {/* ─── 우측 로그인 섹션 ─── */}
      <div className="flex flex-[2] items-center justify-center px-4 py-12 bg-background">
        {/* 로그인 카드 */}
        <div className="w-full max-w-md rounded-lg bg-card border border-border shadow-elev-4 p-10">
          {/* 브랜드 로고 */}
          <div className="mb-9 flex flex-col items-center gap-2.5">
            <Image
              src="/energyx-logo.png"
              alt="에너지엑스"
              width={168}
              height={28}
              quality={100}
              style={{ height: 'auto', objectFit: 'contain' }}
              priority
            />
            <p className="uppercase text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
              KPI Performance System
            </p>
          </div>

          <h2 className="mb-1.5 text-center text-[22px] font-bold text-foreground tracking-tight">
            로그인
          </h2>
          <p className="mb-7 text-center text-[13px] text-muted-foreground leading-relaxed tracking-tight">
            아이디와 비밀번호를 입력해 주세요.
          </p>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 아이디(이메일) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={emailId}
                className="text-[11px] font-semibold text-muted-foreground"
              >
                아이디
                <span className="text-danger-600 ml-0.5">*</span>
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
                    if (e.key === 'Enter') {
                      document.getElementById(passwordId)?.focus();
                    }
                  }}
                />
              </div>
              {emailError && (
                <p className="text-[11px] text-danger-600 mt-0.5">{emailError}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={passwordId}
                className="text-[11px] font-semibold text-muted-foreground"
              >
                비밀번호
                <span className="text-danger-600 ml-0.5">*</span>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-danger-600 mt-0.5">{passwordError}</p>
              )}
            </div>

            {/* 옵션 행: 아이디 저장 */}
            <div className="flex items-center">
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
            </div>

            {/* 로그인 버튼 */}
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

          {/* 구분선 */}
          <div className="my-6 border-t border-border" />

          {/* 보안 안내 */}
          <div className="flex gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden
            />
            <div>
              <p className="mb-1 text-[11.5px] font-bold text-primary tracking-tight">
                보안 안내
              </p>
              <p className="text-[11.5px] text-muted-foreground tracking-tight leading-relaxed">
                안전한 시스템 사용을 위해 비밀번호를 주기적으로 변경해 주세요.
                <br />
                타인과 비밀번호를 공유하지 마세요.
              </p>
            </div>
          </div>

          {/* 브랜드 푸터 */}
          <p className="mt-5 text-center text-[10.5px] text-muted-foreground/70">
            © 2026 에너지엑스 · 인사 평가 시스템
          </p>
        </div>
      </div>
    </div>
  );
}
