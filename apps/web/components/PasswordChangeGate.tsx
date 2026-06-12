'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from './TextField';
import { Button } from './Button';
import {
  PasswordPolicyChecklist,
  type PasswordRule,
} from './PasswordPolicyChecklist';

export interface PasswordChangeGateProps {
  onSubmit: (current: string, next: string) => Promise<void>;
  onLogout: () => void;
  minLength?: number; // 기본 8
  bannedValues?: string[]; // 기본 ['1234','password']
  submitting?: boolean;
  serverError?: string | null; // "현재 비밀번호가 일치하지 않아요."
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

  function handleSubmit() {
    if (!allPassed || submitting) return;
    void onSubmit(current, next);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <span className="text-base font-bold tracking-tight text-foreground">
        에너지엑스 인사 평가
      </span>
      <Card className="w-full max-w-[420px] border-[#cac4d2]/50 shadow-sm">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-lg font-bold">
            비밀번호를 새로 설정해 주세요
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            처음 로그인하셨네요. 안전을 위해 초기 비밀번호(1234)를 꼭 바꿔 주세요.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <TextField
              label="현재 비밀번호"
              type="password"
              value={current}
              onChange={setCurrent}
              required
              error={serverError ?? undefined}
            />
            <TextField
              label="새 비밀번호"
              type="password"
              value={next}
              onChange={setNext}
              required
            />
            <TextField
              label="새 비밀번호 확인"
              type="password"
              value={confirm}
              onChange={setConfirm}
              required
            />
            <PasswordPolicyChecklist rules={rules} />
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              disabled={!allPassed}
            >
              비밀번호 변경하고 시작하기
            </Button>
            <Button variant="ghost" fullWidth onClick={onLogout}>
              로그아웃
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
