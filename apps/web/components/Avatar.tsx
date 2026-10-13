'use client';

// 공용 아바타 — Part/ 브리프 §6 SSOT(_workspace/01_design/part-revision-brief.md).
// API에 User.photoUrl 필드가 없어 폴백이 사실상 기본값이다(API 갭 — 백엔드 확장 전까지 전 화면 폴백 렌더).
// 폴백은 이름 해시 기반 파스텔 5색 로테이션 + 진한 톤 이니셜 1글자 — 검은 배경 이니셜은 금지.
import {
  Avatar as UIAvatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

// 파스텔 배경 + 짝을 이루는 진한 톤 텍스트 5색 로테이션(브리프 §6) — 색 클래스는 ui/avatar 의 tone 변형.
const FALLBACK_TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;

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

/**
 * @deprecated — L1(@/components/ui/avatar) 사용으로 이관 대상.
 * 이름 해시 파스텔 폴백 + 사진 로드 실패 시 폴백 복귀를 제공하는 호환 래퍼.
 */
export function Avatar({ photoUrl, name, size = 'md', className }: AvatarProps) {
  const tone = FALLBACK_TONES[hashIndex(name || '?', FALLBACK_TONES.length)];
  return (
    <UIAvatar size={size} className={className}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
      <AvatarFallback role="img" aria-label={name} size={size} tone={tone}>
        {initialOf(name)}
      </AvatarFallback>
    </UIAvatar>
  );
}
