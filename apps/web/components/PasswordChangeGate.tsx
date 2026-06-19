'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, LogOut, ShieldCheck } from 'lucide-react';
import {
  PasswordPolicyChecklist,
  type PasswordRule,
} from './PasswordPolicyChecklist';

export interface PasswordChangeGateProps {
  onSubmit: (current: string, next: string) => Promise<void>;
  onLogout: () => void;
  minLength?: number;
  bannedValues?: string[];
  submitting?: boolean;
  serverError?: string | null;
}

function PasswordField({
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
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">
        {label}<span className="ml-0.5 text-danger-600">*</span>
      </label>
      <div className="relative">
        <Lock
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '비밀번호를 입력하세요'}
          autoComplete="off"
          className={[
            'h-10 w-full rounded-lg border bg-white px-9 pr-10 text-[14px] text-foreground outline-none transition-colors',
            'placeholder:text-muted-foreground focus:border-primary',
            error ? 'border-danger-500' : 'border-border',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
        >
          {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {error && <p className="mt-0.5 text-[11px] text-danger-600">{error}</p>}
    </div>
  );
}

export function PasswordChangeGate({
  onSubmit,
  onLogout,
  minLength = 8,
  bannedValues = ['1234', 'password'],
  submitting,
  serverError,
}: PasswordChangeGateProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const rules: PasswordRule[] = useMemo(() => {
    const banned = bannedValues.some(
      (b) => next.toLowerCase() === b.toLowerCase(),
    );
    return [
      { key: 'len', label: `${minLength}자 이상이에요`, passed: next.length >= minLength },
      { key: 'banned', label: '"1234" 같은 쉬운 값이 아니에요', passed: next.length > 0 && !banned },
      { key: 'diff', label: '현재 비밀번호와 달라요', passed: next.length > 0 && next !== current },
      { key: 'match', label: '두 번 입력한 값이 같아요', passed: confirm.length > 0 && next === confirm },
    ];
  }, [current, next, confirm, minLength, bannedValues]);

  const allPassed = rules.every((r) => r.passed);
  const submitBtnDisabled = !allPassed || !!submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allPassed || submitting) return;
    void onSubmit(current, next);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-5xl overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,0.9fr)]">
        <section className="hidden bg-[#0e0e14] px-10 py-10 text-white lg:flex lg:flex-col">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
            <ShieldCheck size={24} aria-hidden />
          </div>
          <div className="mt-auto">
            <p className="text-[13px] font-semibold text-white/70">첫 로그인 보안 설정</p>
            <h1 className="mt-3 max-w-sm text-[30px] font-black leading-[1.3] text-white">
              평가 업무를 시작하기 전에 비밀번호를 변경합니다.
            </h1>
            <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
              {[
                ['현재 비밀번호', '초기 비밀번호 확인'],
                ['새 비밀번호', '정책 조건 충족'],
                ['접속 시작', '변경 후 역할별 화면 이동'],
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
            <div className="mb-7 border-b border-border pb-5">
              <h2 className="text-[24px] font-black text-foreground">비밀번호 변경</h2>
              <p className="mt-2 text-[13px] font-medium leading-6 text-muted-foreground">
                초기 비밀번호를 새 비밀번호로 바꾼 뒤 평가 시스템을 사용할 수 있습니다.
              </p>
            </div>

            {serverError && (
              <div className="mb-4 rounded-lg border border-danger-100 bg-danger-50 p-3 text-[12.5px] font-medium leading-5 text-danger-600">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordField
                id="pw-current"
                label="현재 비밀번호"
                value={current}
                onChange={setCurrent}
                placeholder="현재 비밀번호를 입력하세요"
                error={serverError && !current ? '현재 비밀번호를 확인해 주세요.' : undefined}
              />
              <PasswordField
                id="pw-next"
                label="새 비밀번호"
                value={next}
                onChange={setNext}
                placeholder="새 비밀번호를 입력하세요"
              />
              <PasswordField
                id="pw-confirm"
                label="새 비밀번호 확인"
                value={confirm}
                onChange={setConfirm}
                placeholder="새 비밀번호를 다시 입력하세요"
                error={confirm.length > 0 && next !== confirm ? '비밀번호가 일치하지 않아요.' : undefined}
              />

              <div className="rounded-lg border border-border bg-muted p-4">
                <p className="mb-2 text-[11px] font-bold text-foreground">비밀번호 정책</p>
                <PasswordPolicyChecklist rules={rules} />
              </div>

              <button
                type="submit"
                disabled={submitBtnDisabled}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-[14px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:bg-muted-foreground disabled:opacity-70"
              >
                {submitting ? '변경 중...' : '비밀번호 변경하고 시작하기'}
              </button>
            </form>

            <div className="my-5 border-t border-border" />

            <button
              type="button"
              onClick={onLogout}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              <LogOut size={15} aria-hidden />
              로그아웃
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
