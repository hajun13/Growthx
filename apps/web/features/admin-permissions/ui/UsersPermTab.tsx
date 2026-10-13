'use client';

// 사용자별 권한 탭 — 검색·조직 캐스케이드·레벨 칩 툴바 + 사용자 표(행 단위 즉시 적용).
import { Search, X } from 'lucide-react';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { InfoBanner } from '@/components/InfoBanner';
import { OrgCascadeFilter, type OrgCascadeValue } from '@/components/OrgCascadeFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEVEL_BY_KEY, LEVEL_DEFS, LEVEL_KEYS, levelOf, type PermLevel } from '@/lib/permConfig';
import type { FlatNode } from '@/lib/org';
import type { User } from '@/lib/types';
import type { PermRow } from './PermissionsParts';

const userLevel = (u: User): PermLevel => levelOf(u.role, u.visibilityScope);

const filterOptions = [
  { value: '전체', label: '전체' },
  ...LEVEL_KEYS.map((l) => ({ value: l, label: LEVEL_BY_KEY[l].label })),
];

export interface UsersPermTabProps {
  canEdit: boolean;
  currentUserId: string;
  rows: PermRow[];
  filtered: PermRow[];
  loading: boolean;
  savingId: string | null;
  search: string;
  onSearch: (v: string) => void;
  flat: Map<string, FlatNode>;
  orgFilter: OrgCascadeValue;
  onOrgFilter: (v: OrgCascadeValue) => void;
  filterLevel: PermLevel | '전체';
  onFilterLevel: (v: PermLevel | '전체') => void;
  sortByOrg: boolean;
  onToggleSortByOrg: () => void;
  serverTotal: number | null;
  loadedCount: number;
  truncated: boolean;
  onUpdateLevel: (u: User, level: PermLevel) => void;
  onResetFilters: () => void;
}

export function UsersPermTab(p: UsersPermTabProps) {
  const columns: DataTableColumn<PermRow>[] = [
    {
      key: 'name',
      header: '이름 / 부서',
      render: (r: PermRow) => (
        <div>
          <div className="text-13 font-semibold text-foreground">{r.user.name}</div>
          <div className="text-11 text-muted-foreground">{r.deptLabel}</div>
        </div>
      ),
    },
    {
      key: 'position',
      header: '직급',
      width: '80px',
      render: (r: PermRow) => <span className="text-12 text-muted-foreground">{r.positionLabel}</span>,
    },
    {
      key: 'level',
      header: '권한 레벨',
      width: '200px',
      render: (r: PermRow) => {
        // 본인 강등은 즉시 커밋이라 실수 한 번에 권한을 잃는다(자기잠금) — 매트릭스 탭 방어와 정합되게 차단.
        const isSelf = r.user.id === p.currentUserId;
        return (
          <div>
            <Select
              value={userLevel(r.user)}
              onValueChange={(v) => p.onUpdateLevel(r.user, v as PermLevel)}
              disabled={p.savingId === r.user.id || !p.canEdit || isSelf}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_DEFS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="mt-1 text-11 leading-snug text-muted-foreground">
                본인 권한은 다른 관리자가 변경할 수 있어요.
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* 저장 모델 안내 — 매트릭스/사이드바(저장 버튼)와 달리 이 탭은 행 단위 즉시 적용. */}
      <InfoBanner tone={p.canEdit ? 'info' : 'tip'}>
        {p.canEdit
          ? '이 탭에서 바꾼 권한 레벨은 즉시 적용돼요 — 별도 저장 버튼이 없어요.'
          : "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다."}
      </InfoBanner>
      {/* 검색 + 조직 단위 캐스케이드(P5, image 2.png — 역할 칩 왼편) + 역할 칩 한 줄 */}
      <div className="gx-toolbar">
        <InputGroup className="inline-flex h-9 w-full min-w-50 md:w-56">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label="이름·부서 검색"
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="이름·부서 검색"
            className="h-full"
          />
          {p.search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="secondary"
                size="icon-xs"
                aria-label="검색어 지우기"
                onClick={() => p.onSearch('')}
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <OrgCascadeFilter flat={p.flat} value={p.orgFilter} onChange={p.onOrgFilter} compact />
        <FilterChipBar
          options={filterOptions}
          value={p.filterLevel}
          onChange={(v) => p.onFilterLevel(v as PermLevel | '전체')}
        />
        <Button
          variant={p.sortByOrg ? 'default' : 'outline'}
          size="sm"
          aria-pressed={p.sortByOrg}
          onClick={p.onToggleSortByOrg}
          className="ml-auto"
        >
          조직순 정렬
        </Button>
        <Badge variant="muted" className="h-8">
          {p.filtered.length}명
        </Badge>
        {p.truncated && (
          <Badge
            variant="warning"
            className="h-8"
            title="한 번에 500명까지만 불러와요. 검색·조직 필터로 좁혀 확인하세요."
          >
            전체 {p.serverTotal}명 중 {p.loadedCount}명까지 표시
          </Badge>
        )}
      </div>

      <div className="gx-panel overflow-hidden">
        {p.loading && p.rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={p.filtered}
            rowKey={(r) => r.user.id}
            stickyHeader
            empty={
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>검색 결과가 없어요.</EmptyTitle>
                  <EmptyDescription>다른 이름이나 필터를 시도해 보세요.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="secondary" onClick={p.onResetFilters}>
                    필터 초기화
                  </Button>
                </EmptyContent>
              </Empty>
            }
          />
        )}
      </div>
    </div>
  );
}
