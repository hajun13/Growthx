'use client';

// OrgStructureBoard 의 공용 상수·타입 + 구성원 카드(우측 상세의 한 행).
import { Crown } from 'lucide-react';
import type { OrgChartNode, OrgNodeType, PositionDef, User } from '@/lib/types';
import { getPositionLabel, roleLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';

export const ORG_TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

export const HEAD_LABEL: Record<OrgNodeType, string> = {
  group: '그룹대표',
  division: '본부장',
  team: '팀장',
};

// 계층 깊이별 강조색: 대부분 잉크/그레이, 선택 신호만 블루. (정적 룩업 — 클래스 전체 문자열 유지)
export const ACCENT: Record<OrgNodeType, { dot: string; text: string; bar: string; tint: string }> = {
  group: {
    dot: 'bg-neutral-950',
    text: 'text-neutral-950',
    bar: 'border-l-neutral-950',
    tint: 'bg-neutral-950/10',
  },
  division: {
    dot: 'bg-primary',
    text: 'text-primary',
    bar: 'border-l-primary',
    tint: 'bg-primary/10',
  },
  team: {
    dot: 'bg-neutral-500',
    text: 'text-neutral-500',
    bar: 'border-l-neutral-500',
    tint: 'bg-neutral-500/10',
  },
};

export type DragItem =
  | { kind: 'person'; userId: string; name: string; fromDeptId: string | null }
  | { kind: 'dept'; node: OrgChartNode };

export function OrgMemberCard({
  user,
  isHead,
  isDeputy,
  deptType,
  deptId,
  isMatch,
  isAdmin,
  positions,
  onDragStart,
  onDragEnd,
  onSetHead,
  onSetDeputyHead,
}: {
  user: User;
  isHead: boolean;
  isDeputy: boolean;
  deptType: OrgNodeType;
  deptId: string;
  isMatch: boolean;
  isAdmin: boolean;
  positions: PositionDef[];
  onDragStart: (user: User) => void;
  onDragEnd: () => void;
  onSetHead: (deptId: string, userId: string) => void | Promise<void>;
  onSetDeputyHead?: (deptId: string, userId: string) => void | Promise<void>;
}) {
  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => {
        onDragStart(user);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={onDragEnd}
      title={isAdmin ? '드래그해서 다른 부서로 옮길 수 있어요' : undefined}
      // flex-wrap: 버튼(부서장·부그룹장 최대 2개)이 안 들어가면 이름을 세로로 꺾지 말고
      // 버튼 묶음이 다음 줄로 내려가게 한다. 검색 매칭 구성원은 브랜드 블루 보더로 하이라이트.
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-md border px-3 py-2',
        isHead || isMatch ? 'bg-primary/6' : 'bg-card',
        isMatch ? 'border-primary/45' : isHead ? 'border-primary/24' : 'border-border',
        isAdmin ? 'cursor-grab' : 'cursor-default',
        !user.isActive && 'opacity-50',
      )}
    >
      <Avatar name={user.name} size="sm" />
      {/* 이름·직급 — nowrap+말줄임(글자 단위 세로 꺾임 방지). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-13 font-semibold text-neutral-950">{user.name}</span>
          {isHead && (
            <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-10 font-bold text-neutral-950">
              <Crown className="size-2.75" /> {HEAD_LABEL[deptType]}
            </span>
          )}
          {isDeputy && !isHead && (
            <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-10 font-bold text-primary">
              <Crown className="size-2.75" /> 부그룹장
            </span>
          )}
          {!user.isActive && (
            <span className="shrink-0 whitespace-nowrap text-10 text-neutral-500">(비활성)</span>
          )}
        </div>
        <span className="truncate text-11h text-neutral-500">
          {getPositionLabel(user.position, positions)}
          <span className="text-neutral-400"> · {roleLabel[user.role]}</span>
        </span>
      </div>
      {/* 부서장·부그룹장 지정/해제(관리자) */}
      {isAdmin && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant={isHead ? 'secondary' : 'outline'}
            size="xs"
            className="h-6"
            onClick={(e) => {
              e.stopPropagation();
              void onSetHead(deptId, isHead ? '' : user.id);
            }}
            title={isHead ? `${HEAD_LABEL[deptType]} 지정을 해제해요` : `${HEAD_LABEL[deptType]}으로 지정해요`}
          >
            <Crown className="size-3" /> {isHead ? '해제' : HEAD_LABEL[deptType]}
          </Button>
          {/* 부그룹장: 그룹에서만, 부서장이 아닌 구성원 대상. 팀장 2차·본부장 1차 평가자. */}
          {deptType === 'group' && onSetDeputyHead && !isHead && (
            <Button
              variant={isDeputy ? 'secondary' : 'outline'}
              size="xs"
              className="h-6"
              onClick={(e) => {
                e.stopPropagation();
                void onSetDeputyHead(deptId, isDeputy ? '' : user.id);
              }}
              title={
                isDeputy
                  ? '부그룹장 지정을 해제해요'
                  : '부그룹장으로 지정해요 (팀장 2차·본부장 1차 평가자)'
              }
            >
              <Crown className="size-3" /> {isDeputy ? '해제' : '부그룹장'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
