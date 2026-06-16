'use client';

import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** 접근성 레이블 (aria-label). placeholder 와 다를 때만 지정. */
  ariaLabel?: string;
}

/**
 * SearchInput — pill 검색창.
 * rounded-pill 테두리 · 좌측 Search 아이콘 · 포커스 링 · 지우기 버튼.
 *
 * 사용 예:
 * <SearchInput value={q} onChange={setQ} placeholder="이름·이메일 검색" />
 */
export function SearchInput({
  value,
  onChange,
  placeholder = '검색',
  className,
  ariaLabel,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        'relative inline-flex items-center',
        'rounded-pill border border-input bg-card',
        'transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
        'h-10 min-w-[200px]',
        className,
      )}
    >
      {/* 좌측 아이콘 */}
      <Search
        aria-hidden
        className="ml-3 h-4 w-4 shrink-0 text-muted-foreground"
      />

      {/* 실제 input — 밖으로 raw input 노출 X */}
      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent px-2 py-0 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'outline-none',
          // 브라우저 기본 검색 취소 버튼 제거
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />

      {/* 우측 지우기 버튼 — 값 있을 때만 */}
      {value && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={handleClear}
          className={cn(
            'mr-2 flex h-5 w-5 shrink-0 items-center justify-center',
            'rounded-pill bg-neutral-200 text-neutral-600',
            'hover:bg-neutral-300 transition-colors',
          )}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
