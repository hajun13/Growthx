'use client';

import { Mail, Phone, MoreHorizontal } from 'lucide-react';
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

export function OrgPersonCard({
  person,
  showAdminMeta,
  onEdit,
  onMove,
  onToggleActive,
}: OrgPersonCardProps) {
  return (
    <UICard
      className={cn(
        'rounded-xl border-border shadow-sm',
        !person.active && 'opacity-60',
      )}
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            {person.avatarUrl && (
              <AvatarImage src={person.avatarUrl} alt="" />
            )}
            <AvatarFallback className="text-sm font-semibold">
              {person.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-bold text-foreground">
                {person.name}
              </h3>
              <Badge variant="secondary">{POSITION_LABEL[person.position]}</Badge>
              {!person.active && (
                <Badge variant="outline" className="text-muted-foreground">
                  비활성
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {person.deptPath.length > 0
                ? person.deptPath.join(' › ')
                : '소속 미지정'}
            </p>
          </div>
          {showAdminMeta && (onEdit || onMove || onToggleActive) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${person.name} 작업`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
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

        <a
          href={`mailto:${person.email}`}
          className="flex items-center gap-1.5 truncate text-sm text-primary hover:underline"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{person.email}</span>
        </a>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {person.phone ? person.phone : '연락처 미등록'}
        </p>

        {showAdminMeta && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <Badge variant="outline" className="font-medium">
              {roleLabel[person.role]}
              {person.roleIsOverride && (
                <span className="ml-1 text-muted-foreground">· 수동</span>
              )}
            </Badge>
            <Badge variant="outline" className="font-medium">
              {SCOPE_LABEL[person.visibilityScope]}
              {person.scopeIsOverride && (
                <span className="ml-1 text-muted-foreground">· 수동</span>
              )}
            </Badge>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}
