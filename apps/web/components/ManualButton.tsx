'use client';

import { BookOpen } from 'lucide-react';
import { resolveManualLink } from '@/lib/manualLink';
import type { Role } from '@/lib/types';

export interface ManualButtonProps {
  role: Role;
  pathname: string;
}

/**
 * 헤더 전역 매뉴얼 버튼.
 *
 * 현재 라우트·역할에 맞는 노션 매뉴얼 페이지를 새 탭으로 연다. 링크가 아직 없으면
 * (노션 URL 미입력) 아무것도 렌더하지 않는다 — 채워진 화면에만 버튼이 나타난다.
 * 스타일은 헤더의 알림 벨(32x32 아이콘 버튼)과 맞춘다.
 */
export function ManualButton({ role, pathname }: ManualButtonProps) {
  const href = resolveManualLink(role, pathname);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      style={{ width: 32, height: 32 }}
      aria-label="이 화면 사용 매뉴얼 열기"
      title="이 화면 사용 매뉴얼"
    >
      <BookOpen size={15} />
    </a>
  );
}
