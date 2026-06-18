'use client';

/**
 * UsersTab — 사용자 목록 탭.
 * StatCard, SearchInput, FilterChipBar, DataTable DS 컴포넌트 사용.
 * 인라인 style / hex 제거. raw <button>/<input> → DS 컴포넌트 또는 Tailwind 클래스.
 * ~200줄 파일상한 준수.
 */

import {
  Edit2, Trash2, UserMinus, UserCheck, ShieldAlert, Ban,
} from 'lucide-react';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { DesignLabel } from '@/components/DesignLabel';
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

interface Props {
  rows: Row[];
  filtered: Row[];
  stats: Stats;
  search: string;
  setSearch: (v: string) => void;
  filterGroup: string;
  setFilterGroup: (v: string) => void;
  groupFilterOptions: string[];
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
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-muted ${colorCls}`}
    >
      {icon}
    </button>
  );
}

export function UsersTab({
  rows, filtered, stats, search, setSearch,
  filterGroup, setFilterGroup, groupFilterOptions,
  includeInactive, setIncludeInactive,
  loading, onEdit, onToggleExempt, onResign, onReactivate, onDelete, onPurge,
}: Props) {
  const chipOptions = groupFilterOptions.map((g) => ({ value: g, label: g }));

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: '이름',
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${r.user.isActive ? 'bg-primary' : 'bg-neutral-400'}`}>
            {r.user.name[0]}
          </div>
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
      key: 'org',
      header: '그룹 / 본부',
      render: (r) => (
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-foreground truncate">{r.group || '—'}</div>
          <div className="text-[11px] text-muted-foreground truncate">{r.division || '—'}</div>
        </div>
      ),
    },
    {
      key: 'team',
      header: '팀',
      render: (r) => <span className="text-[12.5px] text-muted-foreground truncate">{r.team || '—'}</span>,
    },
    {
      key: 'position',
      header: '직급',
      render: (r) => (
        <DesignLabel tone="gray">{r.positionLabel}</DesignLabel>
      ),
    },
    {
      key: 'status',
      header: '상태',
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
      header: '입사일 · 나이',
      render: (r) => (
        <div>
          <div className="text-[12px] tabular-nums text-muted-foreground">
            {r.user.hireDate ? r.user.hireDate.slice(0, 10).replace(/-/g, '.') : '—'}
          </div>
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {r.user.age !== null ? `만 ${r.user.age}세` : '—'}
          </div>
        </div>
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
      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="이름·이메일·팀 검색" className="w-64" />
        <FilterChipBar
          options={chipOptions}
          value={filterGroup}
          onChange={setFilterGroup}
        />
        <button
          onClick={() => setIncludeInactive((v) => !v)}
          className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${includeInactive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-accent'}`}
        >
          비활성 포함
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length}명</span>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-hidden">
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
