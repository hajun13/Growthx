'use client';

// 로그인 폼 입력 필드 — page.tsx 200줄 상한 분리(표현 계층만, 상태/핸들러는 부모에서 주입).
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

export interface LoginFormFieldsProps {
  emailId: string;
  passwordId: string;
  email: string;
  password: string;
  showPassword: boolean;
  emailError: string | null;
  passwordError: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePassword: () => void;
}

export function LoginFormFields({
  emailId,
  passwordId,
  email,
  password,
  showPassword,
  emailError,
  passwordError,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
}: LoginFormFieldsProps) {
  return (
    <>
      {/* 아이디(이메일) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={emailId} className="text-12 text-muted-foreground">
          아이디
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <User aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="아이디를 입력하세요"
            required
            autoComplete="username"
            aria-invalid={emailError ? true : undefined}
          />
        </InputGroup>
        {emailError && <p className="mt-0.5 text-11 text-danger-600">{emailError}</p>}
      </div>

      {/* 비밀번호 */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={passwordId} className="text-12 text-muted-foreground">
          비밀번호
        </Label>
        <InputGroup>
          <InputGroupAddon>
            <Lock aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
            autoComplete="current-password"
            aria-invalid={passwordError ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={onTogglePassword}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {passwordError && <p className="mt-0.5 text-11 text-danger-600">{passwordError}</p>}
      </div>
    </>
  );
}
