'use client';

// OrgStructureBoard 우측 상세 패널 — 헤더(브레드크럼·부서장·관리자 액션)·직속 하위 조직·직속 구성원(드롭 영역).
import type { CSSProperties, DragEvent } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Crown,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import type { OrgChartNode, PositionDef, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ACCENT,
  HEAD_LABEL,
  ORG_TYPE_LABEL,
  OrgMemberCard,
} from './OrgStructureBoardParts';

const SECTION_LABEL = 'text-11 font-bold uppercase tracking-wide text-neutral-500';

export function OrgDetailPanel({
  node,
  path,
  members,
  head,
  deputy,
  isAdmin,
  positions,
  isOver,
  personDragging,
  trimmedQuery,
  onSelect,
  onNodeAction,
  onAddMember,
  onSetHead,
  onSetDeputyHead,
  onMemberDragStart,
  onDragEnd,
  onZoneDragOver,
  onZoneDrop,
}: {
  node: OrgChartNode;
  path: OrgChartNode[];
  members: User[];
  head: User | null;
  deputy: User | null;
  isAdmin: boolean;
  positions: PositionDef[];
  isOver: boolean;
  personDragging: boolean;
  trimmedQuery: string;
  onSelect: (id: string) => void;
  onNodeAction: (action: 'addChild' | 'rename' | 'delete', node: OrgChartNode) => void;
  onAddMember?: (node: OrgChartNode) => void;
  onSetHead: (deptId: string, userId: string) => void | Promise<void>;
  onSetDeputyHead?: (deptId: string, userId: string) => void | Promise<void>;
  onMemberDragStart: (user: User) => void;
  onDragEnd: () => void;
  onZoneDragOver: (e: DragEvent) => void;
  onZoneDrop: (e: DragEvent) => void;
}) {
  const children = node.children ?? [];
  const accent = ACCENT[node.type];

  return (
    // 좌측 트리와 동일하게 뷰포트 연동 높이 — 넘치면 상세 내부 스크롤.
    <Card
      style={{ '--mh': 'calc(100vh - 280px)' } as CSSProperties}
      className="max-h-(--mh) overflow-y-auto overflow-x-hidden"
    >
      {/* 상세 헤더 */}
      <div className="border-b border-border px-5 py-4">
        {path.length > 1 && (
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {path.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-2.75 text-neutral-400" />}
                <Button variant="link" size="inline" onClick={() => onSelect(p.id)}>
                  <span className={cn('text-11h', p.id === node.id && 'font-bold text-neutral-700')}>
                    {p.name}
                  </span>
                </Button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-block size-2.5 shrink-0 rounded-full', accent.dot)} />
          <span className="text-17 font-bold text-neutral-950">{node.name}</span>
          <span
            className={cn('rounded-pill px-2.25 py-0.5 text-11 font-bold', accent.text, accent.tint)}
          >
            {ORG_TYPE_LABEL[node.type]}
          </span>
          {head ? (
            <span className="flex items-center gap-1 text-12h text-neutral-700">
              <Crown className="size-3.25 text-neutral-950" />
              {head.name} <span className="text-neutral-400">{HEAD_LABEL[node.type]}</span>
            </span>
          ) : (
            // B-1: 부서장 미지정 = 이 조직 계층의 평가 단계가 비어 상위가 대신 평가 — warning 톤으로 승격.
            <span
              className="inline-flex items-center gap-1 rounded-sm border border-warning-300 bg-warning-50 px-2 py-0.5 text-11 font-bold text-warning-700"
              title="부서장이 지정되지 않아 이 단계 평가는 상위 부서장이 맡아요. 구성원의 왕관 버튼으로 지정하세요."
            >
              <AlertTriangle className="size-2.75" aria-hidden /> {HEAD_LABEL[node.type]} 미지정
            </span>
          )}
          {deputy && (
            <span className="flex items-center gap-1 text-12h text-neutral-700">
              <Crown className="size-3.25 text-primary" />
              {deputy.name} <span className="text-neutral-400">부그룹장</span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-12 text-neutral-500">
            <Users className="size-3.25" /> 직속 {members.length}명 · 전체 {node.totalCount}명
          </span>
        </div>

        {/* 관리자 액션 */}
        {isAdmin && (
          <div className="mt-3 flex items-center gap-2">
            {/* 구성원 추가 — 본부/팀 선택 시 주요 액션(블루 solid, 브리프 §4). 기존 배치 API(PersonEditModal) 재사용. */}
            {onAddMember && node.type !== 'group' && (
              <Button size="sm" onClick={() => onAddMember(node)}>
                <UserPlus className="size-3.25" /> 구성원 추가
              </Button>
            )}
            {node.type !== 'team' && (
              <Button variant="outline" size="sm" onClick={() => onNodeAction('addChild', node)}>
                <Plus className="size-3.25" /> {node.type === 'group' ? '본부·팀 추가' : '팀 추가'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onNodeAction('rename', node)}>
              <Pencil className="size-3" /> 이름 변경
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNodeAction('delete', node)}>
              <Trash2 className="size-3" /> 삭제
            </Button>
          </div>
        )}
      </div>

      {/* 직속 하위 조직 */}
      {children.length > 0 && (
        <div className="border-b border-border px-5 py-3.5">
          <div className={cn('mb-2.5', SECTION_LABEL)}>직속 하위 조직 {children.length}</div>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => {
              const cAccent = ACCENT[c.type];
              return (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  className="relative overflow-hidden"
                  onClick={() => onSelect(c.id)}
                >
                  <span
                    aria-hidden
                    className={cn('absolute inset-y-0 left-0 w-0.75', cAccent.dot)}
                  />
                  <span className="text-12h font-semibold text-neutral-950">{c.name}</span>
                  <span
                    className={cn(
                      'rounded-pill px-1.75 py-px text-10 font-bold',
                      cAccent.text,
                      cAccent.tint,
                    )}
                  >
                    {ORG_TYPE_LABEL[c.type]}
                  </span>
                  <span className="text-11 font-normal text-neutral-400">{c.totalCount}명</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* 구성원 — 이 부서 직속 멤버를 드롭 영역으로도 사용 */}
      <div
        className={cn('px-5 py-3.5', isOver && 'bg-primary/5')}
        onDragOver={onZoneDragOver}
        onDrop={onZoneDrop}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className={SECTION_LABEL}>직속 구성원 {members.length}</span>
          {isAdmin && <span className="text-11 text-neutral-400">왕관 = 부서장 지정·해제</span>}
        </div>
        {members.length > 0 ? (
          // 카드 최소 폭: 이름·배지 + 버튼 2개(부서장·부그룹장)가 한 줄에 여유 있게 들어가는 폭.
          <div
            style={{ '--cols': 'repeat(auto-fill, minmax(300px, 1fr))' } as CSSProperties}
            className="grid grid-cols-(--cols) gap-2"
          >
            {members.map((m) => (
              <OrgMemberCard
                key={m.id}
                user={m}
                isHead={m.id === head?.id}
                isDeputy={m.id === deputy?.id}
                deptType={node.type}
                deptId={node.id}
                isMatch={!!trimmedQuery && m.name.toLowerCase().includes(trimmedQuery)}
                isAdmin={isAdmin}
                positions={positions}
                onDragStart={onMemberDragStart}
                onDragEnd={onDragEnd}
                onSetHead={onSetHead}
                onSetDeputyHead={onSetDeputyHead}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 text-12h transition-colors',
              personDragging
                ? 'border-primary bg-primary/4 font-semibold text-primary'
                : 'border-border text-neutral-400',
            )}
          >
            <Users className="size-5" />
            {personDragging ? '여기에 놓으면 이 부서로 옮겨져요' : '직속 구성원이 없어요'}
          </div>
        )}
      </div>
    </Card>
  );
}
