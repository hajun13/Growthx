'use client';

/**
 * UsersTab — 사용자 목록 탭.
 * StatCard, SearchInput, FilterChipBar, DataTable DS 컴포넌트 사용.
 * 인라인 style / hex 제거. raw <button>/<input> → DS 컴포넌트 또는 Tailwind 클래스.
 * ~200줄 파일상한 준수.
 */

import {
  Edit2, Trash2, UserMinus, UserCheck, ShieldAlert, Ban, Mail, CalendarDays, Building2,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/Button';
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
  active: number;
  inactive: number;
  exempt: number;
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

const EMPLOYMENT_TONE: Record<'active' | 'on_leave' | 'resigned', 'primary' | 'gray' | 'darkgray'> = {
  active: 'primary',
  on_leave: 'gray',
  resigned: 'darkgray',
};

function RowAction({ onClick, icon, label, colorCls }: { onClick: () => void; icon: ReactNode; label: string; colorCls: string }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#f7f8fa] ${colorCls}`}
    >
      {icon}
    </button>
  );
}

function UserDetailPanel({
  row,
  onEdit,
  onToggleExempt,
  onResign,
  onReactivate,
  onDelete,
}: {
  row: Row | null;
  onEdit: (r: Row) => void;
  onToggleExempt: (r: Row) => void;
  onResign: (r: Row) => void;
  onReactivate: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  if (!row) {
    return (
      <aside className="gx-panel flex min-h-[420px] items-center justify-center p-6 text-center text-sm font-medium text-[#8b95a1]">
        사용자를 선택하면 상세 정보가 표시됩니다.
      </aside>
    );
  }

  const statusTone = row.user.isActive ? 'primary' : 'darkgray';
  const orgText = [row.group, row.division, row.team].filter(Boolean).join(' / ') || '소속 미지정';

  return (
    <aside className="gx-panel overflow-hidden">
      <div className="flex items-start gap-4 border-b border-[#e5e8eb] p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#f2f4f6] text-[20px] font-black text-[#191f28]">
          {row.user.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[20px] font-black text-[#191f28]">{row.user.name}</h3>
            <DesignLabel tone={statusTone}>{row.user.isActive ? '재직' : '비활성'}</DesignLabel>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-[#4e5968]">{row.positionLabel}</p>
          <p className="mt-0.5 truncate text-[12px] font-medium text-[#8b95a1]">{orgText}</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 text-[13px]">
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-[#8b95a1]" aria-hidden />
            <span className="min-w-[72px] font-semibold text-[#4e5968]">이메일</span>
            <span className="min-w-0 truncate font-medium text-[#191f28]">{row.user.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-[#8b95a1]" aria-hidden />
            <span className="min-w-[72px] font-semibold text-[#4e5968]">소속</span>
            <span className="min-w-0 truncate font-medium text-[#191f28]">{orgText}</span>
          </div>
          <div className="flex items-center gap-3">
            <CalendarDays size={16} className="text-[#8b95a1]" aria-hidden />
            <span className="min-w-[72px] font-semibold text-[#4e5968]">입사일</span>
            <span className="font-medium tabular-nums text-[#191f28]">
              {row.user.hireDate ? row.user.hireDate.slice(0, 10).replace(/-/g, '.') : '-'}
            </span>
          </div>
        </div>

        <div className="border-t border-[#e5e8eb] pt-5">
          <h4 className="text-[14px] font-black text-[#191f28]">빠른 작업</h4>
          <div className="mt-3 grid gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Edit2 size={14} aria-hidden />} onClick={() => onEdit(row)}>
              정보 수정
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Ban size={14} aria-hidden />} onClick={() => onToggleExempt(row)}>
              {row.user.evaluationExempt ? '평가 포함' : '평가 제외'}
            </Button>
            {row.user.isActive ? (
              <Button variant="danger" size="sm" leftIcon={<UserMinus size={14} aria-hidden />} onClick={() => onResign(row)}>
                비활성 처리
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" leftIcon={<UserCheck size={14} aria-hidden />} onClick={() => onReactivate(row)}>
                  복직
                </Button>
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} aria-hidden />} onClick={() => onDelete(row)}>
                  삭제
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function UsersTab({
  rows, filtered, stats, search, setSearch,
  filterGroup, setFilterGroup, groupFilterOptions,
  includeInactive, setIncludeInactive,
  loading, onEdit, onToggleExempt, onResign, onReactivate, onDelete, onPurge,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const chipOptions = groupFilterOptions.map((g) => ({ value: g, label: g }));
  const selected = useMemo(
    () => filtered.find((r) => r.user.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

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
        <DesignLabel tone="darkgray">{r.positionLabel}</DesignLabel>
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
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="gx-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e8eb] px-5 py-4">
          <SearchInput value={search} onChange={setSearch} placeholder="이름, 이메일, 팀 검색" className="w-72" />
          <FilterChipBar options={chipOptions} value={filterGroup} onChange={setFilterGroup} />
          <Button
            variant={includeInactive ? 'primary' : 'secondary'}
            size="sm"
            className="ml-auto"
            onClick={() => setIncludeInactive((v) => !v)}
          >
            비활성 포함
          </Button>
          <span className="text-[12px] font-semibold text-[#8b95a1]">
            {filtered.length} / {stats.total}명
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.user.id}
            onRowClick={(r) => setSelectedId(r.user.id)}
            stickyHeader
            emphasizeHeader
            wrapperClassName="max-h-[560px]"
          />
        )}
      </section>

      <UserDetailPanel
        row={selected}
        onEdit={onEdit}
        onToggleExempt={onToggleExempt}
        onResign={onResign}
        onReactivate={onReactivate}
        onDelete={onDelete}
      />
    </div>
  );
}
