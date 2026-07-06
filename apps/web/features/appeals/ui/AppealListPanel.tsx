'use client';

// 좌측 이의제기 목록 — 2026-07-02 목업 정렬: 카드 패널 안에 [상태 탭 → 검색 → 부서 필터 → 목록 → 페이지네이션].
// 목록 행 = [상태칩 | 아바타 | 이름·부서·제목 | 날짜], 선택 시 파란 테두리.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Select } from '@/components/Select';
import { EmptyState } from '@/components/States';
import { cn } from '@/lib/utils';
import type { Appeal } from '../hooks';
import { FILTER_OPTIONS, displayStatus } from './appealTimeline';

const PAGE_SIZE = 6;

// 상태 배지 — closed+기각 파생 상태(반려)는 빨간 배지로 별도 렌더.
export function AppealStatusBadge({ appeal }: { appeal: Appeal }) {
  if (displayStatus(appeal) === 'rejected') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-600">
        반려
      </span>
    );
  }
  return <StatusBadge status={appeal.status} />;
}

interface Props {
  appeals: Appeal[];
  filtered: Appeal[];
  filter: string;
  onFilterChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AppealListPanel({
  appeals,
  filtered,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  selectedId,
  onSelect,
}: Props) {
  const filterWithCount = FILTER_OPTIONS.map((f) => ({
    ...f,
    count: f.value === 'all' ? appeals.length : appeals.filter((a) => displayStatus(a) === f.value).length,
  }));

  const [dept, setDept] = useState('all');
  const [page, setPage] = useState(1);
  const deptOptions = useMemo(
    () => [
      { value: 'all', label: '전체 부서' },
      ...Array.from(new Set(appeals.map((a) => a.departmentName).filter((d): d is string => !!d))).map((d) => ({ value: d, label: d })),
    ],
    [appeals],
  );
  const visible = useMemo(
    () => filtered.filter((a) => dept === 'all' || a.departmentName === dept),
    [filtered, dept],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3 self-start rounded-lg border border-border bg-card p-4 shadow-elev-1">
      {/* 상태 탭 → 검색 → 부서 필터 순(목업 정렬) */}
      <FilterChipBar options={filterWithCount} value={filter} onChange={(v) => { onFilterChange(v); setPage(1); }} />
      <SearchInput value={search} onChange={onSearchChange} placeholder="이의제기 제목, 신청자 검색" />
      <div className="w-[160px]">
        <Select value={dept} options={deptOptions} onChange={(v) => { setDept(v); setPage(1); }} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="이의제기 내역이 없어요."
          description={filter === 'all' ? '아직 등록된 이의제기가 없어요.' : '해당 상태의 이의제기가 없어요.'}
        />
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((appeal) => {
              const isSelected = selectedId === appeal.id;
              const name = appeal.userName ?? appeal.userId.slice(0, 8);
              return (
                <button
                  key={appeal.id}
                  type="button"
                  onClick={() => onSelect(appeal.id)}
                  className={cn(
                    'w-full rounded-lg border bg-card p-3 text-left transition-colors',
                    isSelected ? 'border-primary ring-1 ring-primary/25' : 'border-border hover:border-primary/35',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0"><AppealStatusBadge appeal={appeal} /></span>
                    <Avatar name={name} photoUrl={appeal.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-foreground">{name}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {appeal.createdAt.slice(0, 10).replaceAll('-', '.')}
                        </span>
                      </div>
                      {appeal.departmentName && (
                        <div className="text-[11.5px] text-muted-foreground">{appeal.departmentName}</div>
                      )}
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-relaxed text-foreground">{appeal.reason}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <PagerBtn label="첫 페이지" disabled={safePage <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft size={14} aria-hidden />
              </PagerBtn>
              <PagerBtn label="이전 페이지" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft size={14} aria-hidden />
              </PagerBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === safePage ? 'page' : undefined}
                  className={cn(
                    'h-7 w-7 rounded-md text-[12px] font-semibold tabular-nums transition-colors',
                    p === safePage ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {p}
                </button>
              ))}
              <PagerBtn label="다음 페이지" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                <ChevronRight size={14} aria-hidden />
              </PagerBtn>
              <PagerBtn label="마지막 페이지" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight size={14} aria-hidden />
              </PagerBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PagerBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
