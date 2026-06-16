'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, LogOut } from 'lucide-react';
import {
  PasswordPolicyChecklist,
  type PasswordRule,
} from './PasswordPolicyChecklist';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────────
const K = {
  primary:          '#7a37d8',
  primaryContainer: '#6a2dc0',
  secondary:        '#7A37D8',
  secondaryDim:     '#2563eb',
  surface:          '#f7f7f9',
  white:            '#ffffff',
} as const;

const T = {
  grey900: '#18181c',
  grey700: '#2a2a30',
  grey600: '#565660',
  grey500: '#74747f',
  grey400: '#a0a0ac',
  grey300: '#ccccd4',
  grey200: '#e3e3e8',
  grey100: '#efeff2',
  red500:  '#E5484D',
  green500: '#16a34a',
} as const;

export interface PasswordChangeGateProps {
  onSubmit: (current: string, next: string) => Promise<void>;
  onLogout: () => void;
  minLength?: number;       // 기본 8
  bannedValues?: string[];  // 기본 ['1234','password']
  submitting?: boolean;
  serverError?: string | null;
}

// 포커스 기반 입력 스타일
function inputStyle(focused: boolean, hasError: boolean): React.CSSProperties {
  return {
    border: `1px solid ${hasError ? T.red500 : focused ? K.secondary : T.grey200}`,
    boxShadow: hasError
      ? '0 0 0 3px rgba(240,68,82,0.10)'
      : focused
        ? '0 0 0 3px rgba(122,55,216,0.10)'
        : 'none',
    padding: '11px 40px 11px 36px',
    fontSize: 14,
    color: T.grey900,
    background: K.white,
    width: '100%',
    outline: 'none',
    borderRadius: 8,
    transition: 'border-color .12s, box-shadow .12s',
  };
}

// 비밀번호 필드 단위 컴포넌트
function PwField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
        {label}
        <span style={{ color: T.red500, marginLeft: 3 }}>*</span>
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: focused ? K.secondary : T.grey400 }}
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? '비밀번호를 입력하세요'}
          autoComplete="off"
          style={inputStyle(focused, !!error)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: show ? K.secondary : T.grey400 }}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
          tabIndex={0}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <p style={{ fontSize: 11, color: T.red500, marginTop: 2 }}>{error}</p>
      )}
    </div>
  );
}

// 첫 로그인 강제 변경 — 셸 없는 풀스크린 게이트.
export function PasswordChangeGate({
  onSubmit,
  onLogout,
  minLength = 8,
  bannedValues = ['1234', 'password'],
  submitting,
  serverError,
}: PasswordChangeGateProps) {
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');

  const rules: PasswordRule[] = useMemo(() => {
    const banned = bannedValues.some(
      (b) => next.toLowerCase() === b.toLowerCase(),
    );
    return [
      { key: 'len',    label: `${minLength}자 이상이에요`,          passed: next.length >= minLength },
      { key: 'banned', label: '"1234" 같은 쉬운 값이 아니에요',     passed: next.length > 0 && !banned },
      { key: 'diff',   label: '현재 비밀번호와 달라요',              passed: next.length > 0 && next !== current },
      { key: 'match',  label: '두 번 입력한 값이 같아요',            passed: confirm.length > 0 && next === confirm },
    ];
  }, [current, next, confirm, minLength, bannedValues]);

  const allPassed = rules.every((r) => r.passed);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allPassed || submitting) return;
    void onSubmit(current, next);
  }

  const submitBtnDisabled = !allPassed || !!submitting;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ backgroundColor: K.surface }}
    >
      <div className="w-full max-w-[440px]">
        {/* 브랜드 헤더 */}
        <div className="mb-7 flex flex-col items-center gap-2">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 52,
              height: 52,
              background: K.primary,
              boxShadow: '0 4px 14px rgba(122,55,216,0.28)',
              marginBottom: 4,
            }}
          >
            <ShieldCheck size={26} color={K.white} strokeWidth={2} />
          </div>
          <p
            className="font-extrabold tracking-tight"
            style={{ fontSize: 17, color: K.primary, letterSpacing: '-0.3px' }}
          >
            에너지엑스 인사 평가
          </p>
        </div>

        {/* 메인 카드 */}
        <div
          className="rounded-2xl bg-white"
          style={{
            padding: '36px 32px 32px',
            boxShadow: '0 8px 32px rgba(86,69,153,0.12)',
            border: '1px solid rgba(204,204,212,0.5)',
          }}
        >
          {/* 카드 헤더 */}
          <div className="mb-6">
            <h1
              className="font-bold"
              style={{ fontSize: 20, color: T.grey900, letterSpacing: '-0.3px', marginBottom: 6 }}
            >
              비밀번호를 새로 설정해 주세요
            </h1>
            <p style={{ fontSize: 13, color: T.grey600, lineHeight: 1.6 }}>
              처음 로그인하셨네요.{' '}
              <strong style={{ color: T.grey900 }}>안전을 위해 초기 비밀번호(1234)를 꼭 바꿔 주세요.</strong>
            </p>
          </div>

          {/* 서버 에러 (폼 전체 레벨) */}
          {serverError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg p-3"
              style={{
                background: 'rgba(240,68,82,0.06)',
                border: '1px solid rgba(240,68,82,0.20)',
              }}
            >
              <p style={{ fontSize: 12.5, color: T.red500, lineHeight: 1.5 }}>{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PwField
              id="pw-current"
              label="현재 비밀번호"
              value={current}
              onChange={setCurrent}
              placeholder="현재 비밀번호를 입력하세요"
              error={
                serverError && !current
                  ? '현재 비밀번호를 확인해 주세요.'
                  : undefined
              }
            />
            <PwField
              id="pw-next"
              label="새 비밀번호"
              value={next}
              onChange={setNext}
              placeholder="새 비밀번호를 입력하세요"
            />
            <PwField
              id="pw-confirm"
              label="새 비밀번호 확인"
              value={confirm}
              onChange={setConfirm}
              placeholder="새 비밀번호를 다시 입력하세요"
              error={
                confirm.length > 0 && next !== confirm
                  ? '비밀번호가 일치하지 않아요.'
                  : undefined
              }
            />

            {/* 정책 체크리스트 — Kinetic Enterprise 래퍼 */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(122,55,216,0.04)',
                border: '1px solid rgba(204,204,212,0.5)',
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: K.primaryContainer,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                비밀번호 정책
              </p>
              {/* 공용 PasswordPolicyChecklist — 수정하지 않고 그대로 사용 */}
              <PasswordPolicyChecklist rules={rules} />
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={submitBtnDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-lg font-bold text-white transition-opacity"
              style={{
                marginTop: 4,
                padding: '13px 0',
                fontSize: 14,
                background: submitBtnDisabled ? T.grey400 : K.secondary,
                boxShadow: submitBtnDisabled
                  ? 'none'
                  : '0 4px 14px rgba(122,55,216,0.25)',
                cursor: submitBtnDisabled ? 'not-allowed' : 'pointer',
                border: 'none',
                borderRadius: 8,
                opacity: submitBtnDisabled ? 0.65 : 1,
              }}
              onMouseEnter={(e) => {
                if (!submitBtnDisabled)
                  (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
              }}
              onMouseLeave={(e) => {
                if (!submitBtnDisabled)
                  (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }}
            >
              {submitting ? (
                <>
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
                  변경 중...
                </>
              ) : (
                '비밀번호 변경하고 시작하기'
              )}
            </button>
          </form>

          {/* 구분선 */}
          <div className="my-5" style={{ borderTop: `1px solid ${T.grey200}` }} />

          {/* 로그아웃 버튼 */}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg transition-colors"
            style={{
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 600,
              color: T.grey600,
              background: 'transparent',
              border: `1px solid ${T.grey200}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = T.grey100;
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.grey300;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.grey200;
            }}
          >
            <LogOut size={15} />
            로그아웃
          </button>
        </div>

        {/* 푸터 */}
        <p className="mt-5 text-center" style={{ fontSize: 10.5, color: T.grey400 }}>
          © 2026 에너지엑스 · 인사 평가 시스템
        </p>
      </div>
    </div>
  );
}
