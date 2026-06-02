'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, login, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // 이미 로그인 상태면 메인으로.
  useEffect(() => {
    if (!authLoading && user) router.replace('/eval');
  }, [authLoading, user, router]);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setFieldError(null);
    try {
      await login(email.trim(), password);
      router.replace('/eval');
    } catch (err) {
      const msg =
        err instanceof ApiError && err.isUnauthorized
          ? '이메일 또는 비밀번호를 확인해 주세요.'
          : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
      setFieldError(msg);
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-[400px]">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              에너지엑스 인사 평가
            </CardTitle>
            <CardDescription>성과를 만든 사람이 평가받는 구조</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <TextField
                label="이메일"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@energyx.co.kr"
                required
              />
              <TextField
                label="비밀번호"
                type="password"
                value={password}
                onChange={setPassword}
                required
                error={fieldError ?? undefined}
              />
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={submitting}
                disabled={!canSubmit}
              >
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          회사 이메일 계정으로 로그인해 주세요.
        </p>
      </div>
    </main>
  );
}
