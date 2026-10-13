'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
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
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-11 font-semibold text-muted-foreground">
        {label}
        <span className="ml-1 text-destructive">*</span>
      </Label>
      <InputGroup className="h-11">
        <InputGroupAddon>
          <Lock aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '비밀번호를 입력하세요'}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            className="size-7"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
          >
            {show ? (
              <EyeOff className="text-muted-foreground" />
            ) : (
              <Eye className="text-muted-foreground" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && <p className="mt-0.5 text-11 text-destructive">{error}</p>}
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

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background px-4 py-10"
    >
      <div className="w-full max-w-110">
        {/* 브랜드 헤더 */}
        <div className="mb-7 flex flex-col items-center gap-2">
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-primary">
            <ShieldCheck size={24} strokeWidth={2} aria-hidden />
          </div>
          <p className="text-17 font-extrabold text-primary">
            에너지엑스 KPI 시스템
          </p>
        </div>

        {/* 메인 카드 */}
        <Card className="px-8 py-8">
          {/* 카드 헤더 */}
          <div className="mb-6">
            <h1 className="mb-1.5 text-20 font-bold text-foreground">
              비밀번호를 새로 설정해 주세요
            </h1>
            <p className="text-13 leading-relaxed text-muted-foreground">
              처음 로그인하셨네요.{' '}
              <strong className="text-foreground">안전을 위해 초기 비밀번호(1234)를 꼭 바꿔 주세요.</strong>
            </p>
          </div>

          {/* 서버 에러 (폼 전체 레벨) */}
          {serverError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-12h leading-relaxed">
                {serverError}
              </AlertDescription>
            </Alert>
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
              <p className="mb-2 text-10 font-bold uppercase tracking-widest text-primary">
                비밀번호 정책
              </p>
              {/* 공용 PasswordPolicyChecklist — 수정하지 않고 그대로 사용 */}
              <PasswordPolicyChecklist rules={rules} />
            </div>

            {/* 제출 버튼 */}
            <Button
              type="submit"
              className="mt-1 h-11 w-full"
              disabled={!allPassed}
              loading={!!submitting}
            >
              {submitting ? '변경 중...' : '비밀번호 변경하고 시작하기'}
            </Button>
          </form>

          {/* 구분선 */}
          <div className="my-5 border-t border-border" />

          {/* 로그아웃 버튼 */}
          <Button variant="outline" className="w-full" onClick={onLogout}>
            <LogOut />
            로그아웃
          </Button>
        </Card>

        {/* 푸터 */}
        <p className="mt-5 text-center text-10h text-muted-foreground">
          © 2026 에너지엑스 · KPI 시스템
        </p>
      </div>
    </div>
  );
}
