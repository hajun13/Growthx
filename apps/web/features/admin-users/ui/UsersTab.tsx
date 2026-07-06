'use client';

/**
 * UsersTab — 사용자 목록 탭.
 * StatCard, SearchInput, FilterChipBar, DataTable DS 컴포넌트 사용.
 * 인라인 style / hex 제거. raw <button>/<input> → DS 컴포넌트 또는 Tailwind 클래스.
 * ~200줄 파일상한 준수.
 *
 * Part/ 수정요청 P3: 컬럼 정렬(그룹/본부·팀·직급·입사일·상태) + 그룹·팀·직급 빠른 필터.
 * 정렬·필터는 전부 클라이언트 사이드(훅/API 시그니처 불변).
 */

import {
  Edit2, Trash2, UserMinus, UserCheck, ShieldAlert, Ban, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { DesignLabel } from '@/components/DesignLabel';
import { Avatar } from '@/components/Avatar';
import { employmentStatusLabel } from '@/lib/ui';
import type { User } from '@/lib/types';

interface Row {
  user: User;
  group: string;
  division: string;
  team: string;
  positionLabel: string;
}

interface Stats {
  total: number;
  exec: number;
  lead: number;
  member: number;
}

export type UserSortKey = 'group' | 'division' | 'team' | 'position' | 'hireDate' | 'age' | 'status';
export type SortDir = 'asc' | 'desc';

interface Props {
  rows: Row[];
  filtered: Row[];
  stats: Stats;
  search: string;
  setSearch: (v: string) => void;
  filterGroup: string;
  setFilterGroup: (v: string) => void;
  groupFilterOptions: string[];
  sortKey: UserSortKey | null;
  sortDir: SortDir;
  onSort: (key: UserSortKey) => void;
  includeInactive: boolean;
  setIncludeInactive: (v: (prev: boolean) => boolean) => void;
  loading: boolean;
  onEdit: (r: Row) => void;
  onToggleExempt: (r: Row) => void;
  onResign: (r: Row) => void;
  onReactivate: (r: Row) => void;
  onDelete: (r: Row) => void;
  onPurge: (r: Row) => void;
}

const EMPLOYMENT_TONE: Record<'active' | 'on_leave' | 'resigned', 'blue' | 'amber' | 'gray'> = {
  active: 'blue',
  on_leave: 'amber',
  resigned: 'gray',
};

function RowAction({ onClick, icon, label, colorCls }: { onClick: () => void; icon: React.ReactNode; label: string; colorCls: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`gx-icon-button transition-colors hover:bg-muted ${colorCls}`}
    >
      {icon}
    </button>
  );
}

// 정렬 가능한 컬럼 헤더 — 클릭 시 오름/내림차순 토글, 방향 아이콘 표시.
function SortHeader({ label, sortKey, active, dir, onSort }: {
  label: string;
  sortKey: UserSortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: UserSortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      aria-label={`${label} 기준 정렬`}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />
      ) : (
        <ArrowUpDown size={11} className="opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function UsersTab({
  rows, filtered, stats, search, setSearch,
  filterGroup, setFilterGroup, groupFilterOptions,
  sortKey, sortDir, onSort,
  includeInactive, setIncludeInactive,
  loading, onEdit, onToggleExempt, onResign, onReactivate, onDelete, onPurge,
}: Props) {
  const chipOptions = groupFilterOptions.map((g) => ({ value: g, label: g }));

  const sh = (key: UserSortKey, label: string) => (
    <SortHeader label={label} sortKey={key} active={sortKey === key} dir={sortDir} onSort={onSort} />
  );

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: '이름',
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={r.user.name} size="sm" className={!r.user.isActive ? 'opacity-50' : undefined} />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-foreground truncate">{r.user.name}</span>
            {r.user.evaluationExempt && (
              <Badge variant="warning" className="shrink-0" title={r.user.evaluationExemptReason ?? '평가 대상에서 제외됨'}>
                평가제외
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'group',
      header: sh('group', '그룹'),
      render: (r) => (
        <span className="text-[12px] font-medium text-foreground truncate block">{r.group || '—'}</span>
      ),
    },
    {
      key: 'division',
      header: sh('division', '본부'),
      render: (r) => (
        <span className="text-[12px] text-muted-foreground truncate block">{r.division || '—'}</span>
      ),
    },
    {
      key: 'team',
      header: sh('team', '팀'),
      render: (r) => <span className="text-[12.5px] text-muted-foreground truncate">{r.team || '—'}</span>,
    },
    {
      key: 'position',
      header: sh('position', '직급'),
      render: (r) => (
        <DesignLabel tone="gray">{r.positionLabel}</DesignLabel>
      ),
    },
    {
      key: 'status',
      header: sh('status', '상태'),
      render: (r) => {
        const tone = r.user.employmentStatus in EMPLOYMENT_TONE
          ? EMPLOYMENT_TONE[r.user.employmentStatus as keyof typeof EMPLOYMENT_TONE]
          : 'gray';
        return (
          <DesignLabel tone={tone}>
            {employmentStatusLabel[r.user.employmentStatus]}
          </DesignLabel>
        );
      },
    },
    {
      key: 'hireDate',
      header: sh('hireDate', '입사일'),
      render: (r) => (
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {r.user.hireDate ? r.user.hireDate.slice(0, 10).replace(/-/g, '.') : '—'}
        </span>
      ),
    },
    {
      key: 'age',
      header: sh('age', '나이'),
      render: (r) => (
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {r.user.age !== null ? `만 ${r.user.age}세` : '—'}
        </span>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      render: (r) => (
        <span className="text-[12px] text-muted-foreground truncate block" title={r.user.email}>{r.user.email}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      render: (r) => (
        <div className="flex items-center gap-0.5 flex-nowrap">
          {r.user.isActive ? (
            <>
              <RowAction onClick={() => onEdit(r)} icon={<Edit2 size={12} aria-hidden />} label="수정" colorCls="text-primary" />
              <RowAction onClick={() => onToggleExempt(r)} icon={<Ban size={12} aria-hidden />} label={r.user.evaluationExempt ? '평가포함' : '평가제외'} colorCls={r.user.evaluationExempt ? 'text-success-600' : 'text-muted-foreground'} />
              <RowAction onClick={() => onResign(r)} icon={<UserMinus size={12} aria-hidden />} label="퇴사" colorCls="text-warning-700" />
            </>
          ) : (
            <>
              <RowAction onClick={() => onReactivate(r)} icon={<UserCheck size={12} aria-hidden />} label="복직" colorCls="text-success-600" />
              <RowAction onClick={() => onDelete(r)} icon={<Trash2 size={12} aria-hidden />} label="삭제" colorCls="text-muted-foreground" />
              <RowAction onClick={() => onPurge(r)} icon={<ShieldAlert size={12} aria-hidden />} label="완전삭제" colorCls="text-danger-600" />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 필터 — 검색 + 그룹/본부 필터 */}
      <div className="gx-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="이름·이메일·팀 검색" className="w-full md:w-72" />
        <FilterChipBar
          options={chipOptions}
          value={filterGroup}
          onChange={setFilterGroup}
        />
        <button
          onClick={() => setIncludeInactive((v) => !v)}
          className={`ml-auto inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-bold transition-colors ${includeInactive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/60'}`}
        >
          비활성 포함
        </button>
        <span className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-[12px] font-bold text-muted-foreground">{filtered.length}명</span>
      </div>

      {/* 팀·직급 칩 필터 바는 사용자 피드백(2026-07-02)으로 제거 — 컬럼 정렬·검색으로 대체. */}

      {/* 테이블 */}
      <div className="gx-panel overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.user.id}
            stickyHeader
          />
        )}
      </div>
    </div>
  );
}
