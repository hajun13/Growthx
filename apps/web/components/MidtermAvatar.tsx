'use client';

// 중간점검 화면 이름 아바타 — L1(ui/avatar) 직접 조합. 이름 해시 → 파스텔 5색 폴백(구 L2 Avatar 와 동일 규칙).
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;

function toneOf(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function MidtermAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const trimmed = name.trim();
  return (
    <Avatar size={size}>
      <AvatarFallback role="img" aria-label={name} size={size} tone={toneOf(name || '?')}>
        {trimmed ? trimmed.charAt(0) : '?'}
      </AvatarFallback>
    </Avatar>
  );
}
