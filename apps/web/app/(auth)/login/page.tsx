'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
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
  const [fieldError, setFieldError] = useState<string | null>(null);

  const emailId = useId();
  const passwordId = useId();
  const saveIdId = useId();

  // 이미 로그인 상태면 역할별 랜딩으로(초기 비번 변경 대상은 게이트로).
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(
        user.mustChangePassword ? '/onboarding/password' : landingPath(user.role),
      );
    }
  }, [authLoading, user, router]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setFieldError(null);
    try {
      await login(email.trim(), password);
      // 라우팅은 위 useEffect(user 갱신 감지)가 역할별 랜딩으로 처리
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isUnauthorized
          ? '아이디 또는 비밀번호를 확인해 주세요.'
          : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
      setFieldError(msg);
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ─── 좌측 히어로 (데스크탑 전용) ─── */}
      <div className="relative hidden flex-[3] md:flex">
        {/* 배경 이미지 */}
        <Image
          src="/login-hero.jpg"
          alt="ENERGYX 사옥"
          fill
          className="object-cover"
          style={{ filter: 'saturate(1.1)' }}
          priority
        />
        {/* 딥블루 오버레이 */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(rgba(10,25,70,0.45), rgba(10,25,70,0.35))',
          }}
        />
        {/* 히어로 콘텐츠 */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          {/* 로고 + 시스템 라벨 */}
          <div className="mb-10">
            <Image
              src="/energyx-logo.png"
              alt="ENERGYX"
              width={148}
              height={25}
              className="mb-2"
              style={{ filter: 'brightness(0) invert(1)' }}
              priority
            />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white opacity-80">
              KPI Performance System
            </p>
          </div>

          {/* 헤드라인 */}
          <h1 className="mb-5 break-keep text-4xl font-bold leading-[1.3] tracking-[-0.02em] text-white xl:text-5xl">
            성과를 데이터로 연결하고
            <br />
            더 공정하게 평가합니다
          </h1>

          {/* 설명 */}
          <p className="max-w-lg break-keep text-[17px] leading-[1.8] tracking-[-0.01em] text-white/85">
            KPI 수립부터 중간점검, 본인평가, 상사평가, 등급 산정과 보상 연계까지
            하나의 흐름으로 관리하는 에너지엑스 맞춤형 성과관리 솔루션입니다.
          </p>
        </div>
      </div>

      {/* ─── 우측 로그인 섹션 ─── */}
      <div
        className="flex flex-[2] items-center justify-center px-4 py-12"
        style={{ backgroundColor: '#f8f9fd' }}
      >
        {/* 로그인 카드 */}
        <div
          className="w-full max-w-md rounded-2xl bg-white p-10"
          style={{ boxShadow: '0 4px 32px rgba(86,69,153,0.10)' }}
        >
          {/* 카드 상단 로고 */}
          <div className="mb-7 flex flex-col items-center gap-1.5">
            <Image
              src="/energyx-logo.png"
              alt="ENERGYX"
              width={120}
              height={20}
              priority
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              KPI Performance System
            </p>
          </div>

          {/* 타이틀 */}
          <h2 className="mb-1 text-center text-2xl font-bold text-gray-900">로그인</h2>
          <p className="mb-7 text-center text-sm text-gray-500">
            아이디와 비밀번호를 입력하여 로그인해 주세요.
          </p>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 아이디(이메일) */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={emailId} className="text-sm font-bold text-gray-700">
                아이디
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  required
                  autoComplete="username"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-9 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#564599] focus:ring-2 focus:ring-[#564599]/20"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={passwordId} className="text-sm font-bold text-gray-700">
                비밀번호
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-9 pr-10 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#564599] focus:ring-2 focus:ring-[#564599]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldError && (
                <p className="text-sm text-red-500">{fieldError}</p>
              )}
            </div>

            {/* 옵션 행: 아이디 저장 */}
            <div className="flex items-center">
              <label
                htmlFor={saveIdId}
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-600"
              >
                <input
                  id={saveIdId}
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#564599]"
                />
                아이디 저장
              </label>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="mt-1 w-full rounded-lg py-4 text-sm font-bold text-white transition-colors disabled:opacity-50"
              style={{
                backgroundColor: submitting || !canSubmit ? '#7e6ab3' : '#564599',
              }}
              onMouseEnter={(e) => {
                if (!submitting && canSubmit)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3f2c80';
              }}
              onMouseLeave={(e) => {
                if (!submitting && canSubmit)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#564599';
              }}
            >
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 보안 안내 */}
          <div
            className="mt-6 flex gap-3 rounded-xl p-4"
            style={{ backgroundColor: '#f3f4ff' }}
          >
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#564599]" />
            <div>
              <p className="mb-0.5 text-xs font-bold text-[#564599]">보안 안내</p>
              <p className="text-xs leading-relaxed text-gray-500">
                안전한 시스템 사용을 위해 비밀번호를 주기적으로 변경해 주세요.
                타인과 비밀번호를 공유하지 마세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
