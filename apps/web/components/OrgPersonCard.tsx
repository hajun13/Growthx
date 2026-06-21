'use client';

import { Mail, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card as UICard, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { POSITION_LABEL, SCOPE_LABEL, roleLabel } from '@/lib/ui';
import type { OrgPerson } from '@/lib/types';

export interface OrgPersonCardProps {
  person: OrgPerson;
  showAdminMeta?: boolean;
  onEdit?: () => void;
  onMove?: () => void;
  onToggleActive?: () => void;
}

// 소속 경로가 길면 마지막 2개 세그먼트만 표시(그룹 › 본부 › 팀 → 본부 › 팀).
function shortDeptPath(path: string[]): string {
  if (path.length === 0) return '소속 미지정';
  return path.slice(-2).join(' › ');
}

export function OrgPersonCard({
  person,
  showAdminMeta,
  onEdit,
  onMove,
  onToggleActive,
}: OrgPersonCardProps) {
  const hasMenu = showAdminMeta && (onEdit || onMove || onToggleActive);

  return (
    <UICard
      className={cn(
        'border-border shadow-none transition-colors duration-150',
        !person.active && 'opacity-60',
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* 상단: 아바타 + 이름/직급/소속 + 메뉴 */}
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
            <AvatarFallback className="text-sm font-semibold">
              {person.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
                {person.name}
              </h3>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {POSITION_LABEL[person.position]}
              </span>
              {!person.active && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] text-muted-foreground"
                >
                  비활성
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {shortDeptPath(person.deptPath)}
            </p>
          </div>

          {hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${person.name} 작업`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>수정</DropdownMenuItem>
                )}
                {onMove && (
                  <DropdownMenuItem onClick={onMove}>소속 이동</DropdownMenuItem>
                )}
                {onToggleActive && (
                  <DropdownMenuItem onClick={onToggleActive}>
                    {person.active ? '비활성화' : '활성화'}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* 이메일 */}
        <a
          href={`mailto:${person.email}`}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-primary"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{person.email}</span>
        </a>

        {/* 관리자용 권한 메타(compact) */}
        {showAdminMeta && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-medium text-muted-foreground"
            >
              {roleLabel[person.role]}
              {person.roleIsOverride && (
                <span className="text-primary">수동</span>
              )}
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 text-[11px] font-medium text-muted-foreground"
            >
              {SCOPE_LABEL[person.visibilityScope]}
              {person.scopeIsOverride && (
                <span className="text-primary">수동</span>
              )}
            </Badge>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}
