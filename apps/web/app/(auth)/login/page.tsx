'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { landingPath } from '@/lib/nav';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────────
const K = {
  primary:          '#3f2c80',
  primaryContainer: '#564599',
  secondary:        '#0054ca',
  secondaryDim:     '#336fe5',
  tertiary:         '#0e9aa0',
  surface:          '#f8f9fd',
  white:            '#ffffff',
} as const;

// T 회색 계열 (lib/toss 와 동일값)
const T = {
  grey900: '#191f28',
  grey700: '#333d4b',
  grey600: '#6b7684',
  grey500: '#8b95a1',
  grey400: '#b0b8c1',
  grey300: '#d1d6db',
  grey200: '#e5e8eb',
  grey100: '#f2f4f6',
  red500:  '#f04452',
  green500: '#03b26c',
} as const;

export default function LoginPage() {
  const router = useRouter();
  const toast  = useToast();
  const { user, login, loading: authLoading } = useAuth();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveId,       setSaveId]       = useState(false);
  const [submitting,   setSubmitting]   = useState(false);

  // 인라인 필드 에러 (필드 단위)
  const [emailError,    setEmailError]    = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 입력 포커스 상태 (글로우 효과용)
  const [emailFocused,    setEmailFocused]    = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailId    = useId();
  const passwordId = useId();
  const saveIdId   = useId();

  // 이미 로그인 → 역할별 랜딩
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(
        user.mustChangePassword ? '/onboarding/password' : landingPath(user.role),
      );
    }
  }, [authLoading, user, router]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  // 입력 변경 시 인라인 에러 초기화
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

    // 기본 필드 유효성
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
      // 라우팅은 useEffect(user 갱신)가 처리
    } catch (err) {
      const isUnauth = err instanceof ApiError && err.isUnauthorized;
      const msg = isUnauth
        ? '아이디 또는 비밀번호를 확인해 주세요.'
        : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
      // 인라인 에러: 인증 실패는 비밀번호 필드에 표시
      if (isUnauth) {
        setPasswordError(msg);
      } else {
        setPasswordError(msg);
      }
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  // 입력 스타일 계산
  function inputStyle(focused: boolean, hasError: boolean): React.CSSProperties {
    return {
      border: `1px solid ${hasError ? T.red500 : focused ? K.secondary : T.grey200}`,
      boxShadow: hasError
        ? '0 0 0 3px rgba(240,68,82,0.10)'
        : focused
          ? '0 0 0 3px rgba(0,84,202,0.10)'
          : 'none',
      padding: '11px 11px 11px 36px',
      fontSize: 14,
      color: T.grey900,
      background: K.white,
      width: '100%',
      outline: 'none',
      borderRadius: 8,
      transition: 'border-color .12s, box-shadow .12s',
    };
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
          style={{ filter: 'saturate(1.05) contrast(1.02)' }}
          priority
        />
        {/* 블루 그라디언트 오버레이 (가독성 + 옅은 블루 틴트) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(20,40,110,0.30) 0%, rgba(0,84,202,0.18) 55%, rgba(0,84,202,0.10) 100%)',
          }}
        />
        {/* 히어로 콘텐츠 */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12 lg:px-24">
          {/* 로고 이미지 + 시스템 라벨 */}
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
            <p
              className="text-xs font-semibold uppercase"
              style={{ color: 'rgba(255,255,255,0.78)', letterSpacing: '0.22em' }}
            >
              인사 평가 시스템
            </p>
          </div>

          {/* 헤드라인 */}
          <h1
            className="mb-7 break-keep font-extrabold text-white xl:text-[44px]"
            style={{ fontSize: 38, letterSpacing: '-0.025em', lineHeight: 1.34 }}
          >
            성과를 데이터로 연결하고
            <br />
            더 공정하게 평가합니다
          </h1>

          {/* 설명 */}
          <p
            className="max-w-lg break-keep"
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.88)',
              letterSpacing: '-0.01em',
              lineHeight: 1.85,
            }}
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
      <div
        className="flex flex-[2] items-center justify-center px-4 py-12"
        style={{ backgroundColor: K.surface }}
      >
        {/* 로그인 카드 */}
        <div
          className="w-full max-w-md rounded-2xl bg-white"
          style={{
            padding: '44px 40px 40px',
            boxShadow: '0 8px 32px rgba(86,69,153,0.12)',
            border: '1px solid rgba(202,196,210,0.5)',
          }}
        >
          {/* 카드 상단 — 브랜드 로고 이미지 */}
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
            <p
              style={{
                fontSize: 11,
                color: T.grey500,
                fontWeight: 500,
                letterSpacing: '0.14em',
              }}
              className="uppercase"
            >
              KPI Performance System
            </p>
          </div>

          {/* 타이틀 */}
          <h2
            className="mb-1.5 text-center font-bold"
            style={{ fontSize: 22, color: T.grey900, letterSpacing: '-0.02em' }}
          >
            로그인
          </h2>
          <p
            className="mb-7 text-center"
            style={{ fontSize: 13, color: T.grey600, letterSpacing: '-0.01em', lineHeight: 1.6 }}
          >
            아이디와 비밀번호를 입력해 주세요.
          </p>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 아이디(이메일) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={emailId}
                style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}
              >
                아이디
                <span style={{ color: T.red500, marginLeft: 3 }}>*</span>
              </label>
              <div className="relative">
                <User
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: emailFocused ? K.secondary : T.grey400 }}
                />
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="이메일 주소를 입력하세요"
                  required
                  autoComplete="username"
                  style={{
                    ...inputStyle(emailFocused, !!emailError),
                    paddingLeft: 36,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      document.getElementById(passwordId)?.focus();
                    }
                  }}
                />
              </div>
              {emailError && (
                <p style={{ fontSize: 11, color: T.red500, marginTop: 2 }}>{emailError}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={passwordId}
                style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}
              >
                비밀번호
                <span style={{ color: T.red500, marginLeft: 3 }}>*</span>
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: passwordFocused ? K.secondary : T.grey400 }}
                />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  autoComplete="current-password"
                  style={{
                    ...inputStyle(passwordFocused, !!passwordError),
                    paddingLeft: 36,
                    paddingRight: 40,
                  }}
                />
                {/* 비밀번호 표시 토글 */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: showPassword ? K.secondary : T.grey400 }}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p style={{ fontSize: 11, color: T.red500, marginTop: 2 }}>{passwordError}</p>
              )}
            </div>

            {/* 옵션 행: 아이디 저장 */}
            <div className="flex items-center">
              <label
                htmlFor={saveIdId}
                className="flex cursor-pointer items-center gap-2"
                style={{ fontSize: 13, color: T.grey600 }}
              >
                <input
                  id={saveIdId}
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: K.primaryContainer }}
                />
                아이디 저장
              </label>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg font-bold text-white transition-opacity"
              style={{
                padding: '13px 0',
                fontSize: 14,
                background:
                  !canSubmit || submitting
                    ? T.grey400
                    : `linear-gradient(135deg, ${K.primary} 0%, ${K.primaryContainer} 100%)`,
                boxShadow:
                  canSubmit && !submitting
                    ? '0 4px 14px rgba(63,44,128,0.28)'
                    : 'none',
                cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                border: 'none',
                borderRadius: 8,
                opacity: !canSubmit || submitting ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (canSubmit && !submitting) {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
                }
              }}
              onMouseLeave={(e) => {
                if (canSubmit && !submitting) {
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                }
              }}
            >
              {submitting ? (
                <>
                  {/* 로딩 스피너 인라인 */}
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* 구분선 */}
          <div
            className="my-6"
            style={{ borderTop: `1px solid ${T.grey200}` }}
          />

          {/* 보안 안내 */}
          <div
            className="flex gap-3 rounded-xl p-4"
            style={{
              background: 'rgba(63,44,128,0.05)',
              border: '1px solid rgba(63,44,128,0.12)',
            }}
          >
            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0"
              style={{ color: K.primaryContainer }}
            />
            <div>
              <p
                className="mb-1 font-bold"
                style={{ fontSize: 11.5, color: K.primary, letterSpacing: '-0.01em' }}
              >
                보안 안내
              </p>
              <p
                style={{ fontSize: 11.5, color: T.grey600, letterSpacing: '-0.01em', lineHeight: 1.7 }}
              >
                안전한 시스템 사용을 위해 비밀번호를 주기적으로 변경해 주세요.
                타인과 비밀번호를 공유하지 마세요.
              </p>
            </div>
          </div>

          {/* 브랜드 푸터 */}
          <p
            className="mt-5 text-center"
            style={{ fontSize: 10.5, color: T.grey400, letterSpacing: '0.01em' }}
          >
            © 2026 에너지엑스 · 인사 평가 시스템
          </p>
        </div>
      </div>
    </div>
  );
}
