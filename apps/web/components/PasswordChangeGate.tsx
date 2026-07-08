'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, LogOut } from 'lucide-react';
import {
  PasswordPolicyChecklist,
  type PasswordRule,
} from './PasswordPolicyChecklist';

export interface PasswordChangeGateProps {
  onSubmit: (current: string, next: string) => Promise<void>;
  onLogout: () => void;
  minLength?: number;       // 기본 8
  bannedValues?: string[];  // 기본 ['1234','password']
  submitting?: boolean;
  serverError?: string | null;
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
      <label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">
        {label}
        <span className="ml-1 text-destructive">*</span>
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          aria-hidden
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
          className={`h-11 w-full rounded-md border bg-background py-2.5 pl-9 pr-10 text-[14px] text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 ${
            error ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : 'border-input'
          } ${focused ? 'text-foreground' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
          tabIndex={0}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <p className="mt-0.5 text-[11px] text-destructive">{error}</p>
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
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-[440px]">
        {/* 브랜드 헤더 */}
        <div className="mb-7 flex flex-col items-center gap-2">
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <ShieldCheck size={24} strokeWidth={2} aria-hidden />
          </div>
          <p className="text-[17px] font-extrabold text-primary">
            에너지엑스 KPI 시스템
          </p>
        </div>

        {/* 메인 카드 */}
        <div className="rounded-lg border border-border bg-card px-8 py-8 shadow-elev-1">
          {/* 카드 헤더 */}
          <div className="mb-6">
            <h1 className="mb-1.5 text-[20px] font-bold text-foreground">
              비밀번호를 새로 설정해 주세요
            </h1>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              처음 로그인하셨네요.{' '}
              <strong className="text-foreground">안전을 위해 초기 비밀번호(1234)를 꼭 바꿔 주세요.</strong>
            </p>
          </div>

          {/* 서버 에러 (폼 전체 레벨) */}
          {serverError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3"
            >
              <p className="text-[12.5px] leading-relaxed text-destructive">{serverError}</p>
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

            {/* 정책 체크리스트 — muted inset 정보 영역 */}
            <div
              className="rounded-md border border-border bg-muted/50 p-4"
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                비밀번호 정책
              </p>
              {/* 공용 PasswordPolicyChecklist — 수정하지 않고 그대로 사용 */}
              <PasswordPolicyChecklist rules={rules} />
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={submitBtnDisabled}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[14px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted-foreground disabled:opacity-60"
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
          <div className="my-5 border-t border-border" />

          {/* 로그아웃 버튼 */}
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut size={15} />
            로그아웃
          </button>
        </div>

        {/* 푸터 */}
        <p className="mt-5 text-center text-[10.5px] text-muted-foreground">
          © 2026 에너지엑스 · KPI 시스템
        </p>
      </div>
    </div>
  );
}
