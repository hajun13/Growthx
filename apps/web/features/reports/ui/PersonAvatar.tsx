'use client';

// 이름 해시 파스텔 폴백 아바타 — L1 ui/avatar 직접 조합(구 components/Avatar 래퍼 대체, photoUrl 없음).
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;

function toneOf(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function PersonAvatar({ name, size = 'md' }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return (
    <Avatar size={size}>
      <AvatarFallback role="img" aria-label={name} size={size} tone={toneOf(name || '?')}>
        {name.trim() ? name.trim().charAt(0) : '?'}
      </AvatarFallback>
    </Avatar>
  );
}
