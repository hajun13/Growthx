'use client';

// 권한 관리 화면 공용 조각 — 타입·가시성 시안 데이터·상태 스위치/배지.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LEVEL_BY_KEY, type PermLevel } from '@/lib/permConfig';
import type { NavItem } from '@/lib/nav';
import type { User } from '@/lib/types';

export interface PermRow {
  user: User;
  deptLabel: string;
  positionLabel: string;
}

export type SidebarPermissionRow =
  | { id: string; kind: 'section'; label: string; count: number; items: NavItem[] }
  | { id: string; kind: 'item'; label: string; item: NavItem; grouped: boolean };

// 가시성 설정(정적 mock)
export type VisScope = '전체' | '그룹' | '본부' | '팀' | '본인';
export type SensitiveField = '매출' | '등급' | 'KPI점수' | '평가의견';
export interface VisRule {
  role: string;
  title: string;
  scope: VisScope;
  sensitive: Partial<Record<SensitiveField, boolean>>;
  note: string;
}
export const sensitiveFields: SensitiveField[] = ['매출', '등급', 'KPI점수', '평가의견'];
export const initialVisRules: VisRule[] = [
  { role: 'hr-admin',   title: '인사총무팀 (관리자)', scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '전 조직 전체 열람·수정 가능' },
  { role: 'ceo',        title: '대표이사',            scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false }, note: '그룹 전체 집계 열람' },
  { role: 'group-head', title: '그룹대표',            scope: '그룹', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false }, note: '소속 그룹 전체 열람' },
  { role: 'dept-head',  title: '본부장',              scope: '본부', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 본부만 열람, 타 본부 차단' },
  { role: 'team-lead',  title: '팀장',                scope: '팀',   sensitive: { 매출: false, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 팀만 열람, 매출 집계 제한' },
  { role: 'member',     title: '팀원',                scope: '본인', sensitive: { 매출: false, 등급: false, KPI점수: true, 평가의견: false }, note: '본인 데이터만 열람 가능' },
];

type SolidVariant = 'solid-dark' | 'solid-primary' | 'solid-info' | 'solid-success' | 'muted';

const scopeVariant: Record<VisScope, SolidVariant> = {
  전체: 'solid-dark',
  그룹: 'solid-primary',
  본부: 'solid-info',
  팀: 'solid-success',
  본인: 'muted',
};

const levelVariant: Record<PermLevel, SolidVariant> = {
  hr: 'solid-dark',
  group: 'solid-primary',
  division: 'solid-info',
  team: 'solid-success',
  member: 'muted',
};

export function PermissionTabShell({
  notice,
  children,
}: {
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {notice}
      {children}
    </div>
  );
}

/** 허용/차단(표시/숨김) 스위치 — role="switch" + aria-checked(Radix Switch), 접근성 이름은 상태 라벨. */
export function PermissionStateButton({
  checked,
  onClick,
  disabled,
  checkedLabel = '허용',
  uncheckedLabel = '차단',
}: {
  checked: boolean;
  onClick?: () => void;
  disabled?: boolean;
  checkedLabel?: string;
  uncheckedLabel?: string;
}) {
  const label = checked ? checkedLabel : uncheckedLabel;
  return (
    <span
      className={`inline-flex h-7 w-22 items-center justify-center gap-2 text-11 font-semibold ${
        checked ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      <Switch checked={checked} onCheckedChange={() => onClick?.()} disabled={disabled} aria-label={label} />
      <span className="w-7 shrink-0 whitespace-nowrap text-left leading-none" aria-hidden>
        {label}
      </span>
    </span>
  );
}

export function PermissionBulkButton({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={active ? 'secondary' : 'link'}
      size="xs"
      onClick={onClick}
      disabled={disabled}
      className="h-6"
    >
      {active ? '모두 숨김' : '모두 표시'}
    </Button>
  );
}

export function ScopeBadge({ scope }: { scope: VisScope }) {
  return (
    <Badge variant={scopeVariant[scope]} className="h-7 min-w-14">
      {scope}
    </Badge>
  );
}

// ── 권한 레벨 배지 ──────────────────────────────────────────────
export function LevelBadge({ level }: { level: PermLevel }) {
  return (
    <Badge variant={levelVariant[level]} className="min-w-21">
      {LEVEL_BY_KEY[level].label}
    </Badge>
  );
}
