'use client';

// 공용 아바타 — Part/ 브리프 §6 SSOT(_workspace/01_design/part-revision-brief.md).
// API에 User.photoUrl 필드가 없어 폴백이 사실상 기본값이다(API 갭 — 백엔드 확장 전까지 전 화면 폴백 렌더).
// 폴백은 이름 해시 기반 파스텔 5색 로테이션 + 진한 톤 이니셜 1글자 — 검은 배경 이니셜은 금지.
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
};

const FONT_PX: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 20,
};

// 파스텔 배경 + 짝을 이루는 진한 톤 텍스트 5색 로테이션(브리프 §6).
const FALLBACK_PALETTE: Array<{ bg: string; color: string }> = [
  { bg: '#DCE7FA', color: '#1D4ED8' }, // 파스텔 블루
  { bg: '#E3F7EC', color: '#0B7A47' }, // 파스텔 그린
  { bg: '#F3EBFE', color: '#6D28D9' }, // 파스텔 퍼플
  { bg: '#FFEEDD', color: '#C2570A' }, // 파스텔 오렌지
  { bg: '#E4FBFB', color: '#0E7E85' }, // 파스텔 민트
];

// 이름 문자열을 안정적으로 0~4 인덱스로 해시(같은 이름은 항상 같은 색).
function hashIndex(name: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

// 폴백 이니셜: 성 1자(한글 이름은 첫 글자, 그 외는 첫 글자) — 이름이 비어 있으면 '?'.
function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : '?';
}

export interface AvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ photoUrl, name, size = 'md', className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const px = SIZE_PX[size];
  const fontPx = FONT_PX[size];

  if (photoUrl && !errored) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setErrored(true)}
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={{ width: px, height: px }}
      />
    );
  }

  const tone = FALLBACK_PALETTE[hashIndex(name || '?', FALLBACK_PALETTE.length)];
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none',
        className,
      )}
      style={{
        width: px,
        height: px,
        background: tone.bg,
        color: tone.color,
        fontSize: fontPx,
      }}
    >
      {initialOf(name)}
    </span>
  );
}
