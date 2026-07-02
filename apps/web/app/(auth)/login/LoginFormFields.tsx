'use client';

// 로그인 폼 입력 필드 — page.tsx 200줄 상한 분리(표현 계층만, 상태/핸들러는 부모에서 주입).
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
        <label htmlFor={emailId} className="text-[12px] font-medium text-[#6B6980]">
          아이디
        </label>
        <div className="relative">
          <User
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9B98AC]"
            aria-hidden
          />
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="이메일 주소를 입력하세요"
            required
            autoComplete="username"
            className={[
              'h-10 rounded-[8px] border-[#D8DCEB] pl-9 focus-visible:border-[#0257CE] focus-visible:ring-[#0257CE]/20',
              emailError ? 'border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]/20' : '',
            ].join(' ')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                document.getElementById(passwordId)?.focus();
              }
            }}
          />
        </div>
        {emailError && <p className="mt-0.5 text-[11px] text-[#C81E1E]">{emailError}</p>}
      </div>

      {/* 비밀번호 */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwordId} className="text-[12px] font-medium text-[#6B6980]">
          비밀번호
        </label>
        <div className="relative">
          <Lock
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9B98AC]"
            aria-hidden
          />
          <Input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
            autoComplete="current-password"
            className={[
              'h-10 rounded-[8px] border-[#D8DCEB] pl-9 pr-10 focus-visible:border-[#0257CE] focus-visible:ring-[#0257CE]/20',
              passwordError ? 'border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]/20' : '',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B98AC] transition-colors hover:text-[#6B6980]"
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
            tabIndex={0}
          >
            {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        {passwordError && <p className="mt-0.5 text-[11px] text-[#C81E1E]">{passwordError}</p>}
      </div>
    </>
  );
}
