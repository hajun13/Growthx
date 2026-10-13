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
  Edit2, Trash2, UserMinus, UserCheck, ShieldAlert, Ban, ArrowUp, ArrowDown, ArrowUpDown, Search, X,
  type LucideIcon,
} from 'lucide-react';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { DesignLabel } from '@/components/DesignLabel';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { employmentStatusLabel } from '@/lib/ui';
import type { User } from '@/lib/types';

interface Row {
  user: User;
  group: string;
  division: string;
  team: string;
  positionLabel: string;
}

export type UserSortKey = 'group' | 'division' | 'team' | 'position' | 'hireDate' | 'age' | 'status';
export type SortDir = 'asc' | 'desc';

interface Props {
  rows: Row[];
  filtered: Row[];
  /** 서버 전체 인원(meta.total) — pageSize 하드캡으로 목록이 잘렸으면 경고 배지 표시. */
  serverTotal?: number | null;
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

// 이름 해시 → 파스텔 5색 로테이션(같은 이름은 항상 같은 색). 구 L2 Avatar 와 동일 규칙.
const AVATAR_TONES = ['blue', 'green', 'purple', 'amber', 'mint'] as const;
function UserAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <Avatar size="sm">
      {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
      <AvatarFallback role="img" aria-label={name} size="sm" tone={tone}>
        {name.trim().charAt(0) || '?'}
      </AvatarFallback>
    </Avatar>
  );
}

function RowAction({ onClick, icon: Icon, label, colorCls }: { onClick: () => void; icon: LucideIcon; label: string; colorCls: string }) {
  return (
    <Button variant="ghost-muted" size="icon-xs" onClick={onClick} title={label} aria-label={label}>
      <Icon className={colorCls} aria-hidden />
    </Button>
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
    <Button
      variant="ghost-muted"
      size="xs"
      onClick={() => onSort(sortKey)}
      className="-ml-2 h-6"
      aria-label={`${label} 기준 정렬`}
    >
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />
      ) : (
        <ArrowUpDown className="opacity-40" aria-hidden />
      )}
    </Button>
  );
}

export function UsersTab({
  rows, filtered, serverTotal, search, setSearch,
  filterGroup, setFilterGroup, groupFilterOptions,
  sortKey, sortDir, onSort,
  includeInactive, setIncludeInactive,
  loading, onEdit, onToggleExempt, onResign, onReactivate, onDelete, onPurge,
}: Props) {
  const chipOptions = groupFilterOptions.map((g) => ({ value: g, label: g }));
  // 500명 하드캡 무언 절단 방지 — 서버 total 이 로드분보다 크면 명시적으로 알린다.
  const truncated = serverTotal != null && serverTotal > rows.length;

  const sh = (key: UserSortKey, label: string) => (
    <SortHeader label={label} sortKey={key} active={sortKey === key} dir={sortDir} onSort={onSort} />
  );

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: '이름',
      render: (r) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={!r.user.isActive ? 'opacity-50' : undefined}><UserAvatar name={r.user.name} /></span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-13 font-semibold text-foreground truncate">{r.user.name}</span>
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
        <span className="text-12 font-medium text-foreground truncate block">{r.group || '—'}</span>
      ),
    },
    {
      key: 'division',
      header: sh('division', '본부'),
      render: (r) => (
        <span className="text-12 text-muted-foreground truncate block">{r.division || '—'}</span>
      ),
    },
    {
      key: 'team',
      header: sh('team', '팀'),
      render: (r) => <span className="text-12h text-muted-foreground truncate">{r.team || '—'}</span>,
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
        <span className="text-12 tabular-nums text-muted-foreground">
          {r.user.hireDate ? r.user.hireDate.slice(0, 10).replace(/-/g, '.') : '—'}
        </span>
      ),
    },
    {
      key: 'age',
      header: sh('age', '나이'),
      render: (r) => (
        <span className="text-12 tabular-nums text-muted-foreground">
          {r.user.age !== null ? `만 ${r.user.age}세` : '—'}
        </span>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      render: (r) => (
        <span className="text-12 text-muted-foreground truncate block" title={r.user.email}>{r.user.email}</span>
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
              <RowAction onClick={() => onEdit(r)} icon={Edit2} label="수정" colorCls="text-primary" />
              <RowAction onClick={() => onToggleExempt(r)} icon={Ban} label={r.user.evaluationExempt ? '평가포함' : '평가제외'} colorCls={r.user.evaluationExempt ? 'text-success-600' : 'text-muted-foreground'} />
              <RowAction onClick={() => onResign(r)} icon={UserMinus} label="퇴사" colorCls="text-warning-700" />
            </>
          ) : (
            <>
              <RowAction onClick={() => onReactivate(r)} icon={UserCheck} label="복직" colorCls="text-success-600" />
              <RowAction onClick={() => onDelete(r)} icon={Trash2} label="삭제" colorCls="text-muted-foreground" />
              <RowAction onClick={() => onPurge(r)} icon={ShieldAlert} label="완전삭제" colorCls="text-danger-600" />
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
        <InputGroup className="inline-flex h-9 w-full min-w-50 md:w-72">
          <InputGroupAddon align="inline-start"><Search aria-hidden /></InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label="이름·이메일·조직·직급 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·이메일·조직·직급 검색"
            className="h-full"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton variant="secondary" size="icon-xs" aria-label="검색어 지우기" onClick={() => setSearch('')}>
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <FilterChipBar
          options={chipOptions}
          value={filterGroup}
          onChange={setFilterGroup}
        />
        <Button
          variant={includeInactive ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIncludeInactive((v) => !v)}
          className="ml-auto"
        >
          비활성 포함
        </Button>
        <span className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-12 font-bold text-muted-foreground">{filtered.length}명</span>
        {truncated && (
          <span
            className="inline-flex h-8 items-center gap-1 rounded-md border border-warning-300 bg-warning-50 px-3 text-12 font-semibold text-warning-700"
            title="한 번에 500명까지만 불러와요. 나머지는 검색·필터로 서버에서 좁혀 확인하세요."
          >
            전체 {serverTotal}명 중 {rows.length}명까지 표시
          </span>
        )}
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
