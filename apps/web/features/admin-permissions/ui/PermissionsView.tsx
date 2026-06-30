'use client';

// 권한 관리 (hr_admin) — 탭4: 사용자별 권한 / 권한 매트릭스 / 사이드바 메뉴 / 가시성 설정.
// 데이터: GET /users(실데이터) + matrix/nav(usePermissions) + visibility(정적 mock).
import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/Button';
import { Tabs } from '@/components/Tabs';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { InfoBanner } from '@/components/InfoBanner';
import { Select } from '@/components/Select';
import { isHrAdmin, NAV_ITEMS, NAV_GROUP_ORDER, type NavItem } from '@/lib/nav';
import {
  levelOf,
  LEVEL_DEFS,
  LEVEL_BY_KEY,
  LEVEL_KEYS,
  type FeatureKey,
  type PermLevel,
  type MatrixConfig,
  type NavConfig,
} from '@/lib/permConfig';
import { flattenOrg, deptPath } from '@/lib/org';
import { getPositionLabel } from '@/lib/ui';
import { usePositions } from '@/hooks/usePositions';
import type { User } from '@/lib/types';
import { usePermissionsCommands } from '../hooks';

// 사용자 → 권한 레벨 래퍼
const userLevel = (u: User): PermLevel => levelOf(u.role, u.visibilityScope);

// 권한 매트릭스 열
const matrixCols: FeatureKey[] = [
  '평가결과 전체열람',
  'KPI 승인/반려',
  '등급풀 수정',
  '권한 부여·수정',
  '시스템 설정',
  '감사로그',
];

// 가시성 설정(정적 mock)
type VisScope = '전체' | '그룹' | '본부' | '팀' | '본인';
type SensitiveField = '매출' | '등급' | 'KPI점수' | '평가의견';
interface VisRule {
  role: string;
  title: string;
  scope: VisScope;
  sensitive: Partial<Record<SensitiveField, boolean>>;
  note: string;
}
const sensitiveFields: SensitiveField[] = ['매출', '등급', 'KPI점수', '평가의견'];
const initialVisRules: VisRule[] = [
  { role: 'hr-admin',   title: '인사총무팀 (관리자)', scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '전 조직 전체 열람·수정 가능' },
  { role: 'ceo',        title: '대표이사',            scope: '전체', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false }, note: '그룹 전체 집계 열람' },
  { role: 'group-head', title: '그룹 대표',           scope: '그룹', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false }, note: '소속 그룹 전체 열람' },
  { role: 'dept-head',  title: '본부장',              scope: '본부', sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 본부만 열람, 타 본부 차단' },
  { role: 'team-lead',  title: '팀장',                scope: '팀',   sensitive: { 매출: false, 등급: true, KPI점수: true, 평가의견: true  }, note: '소속 팀만 열람, 매출 집계 제한' },
  { role: 'member',     title: '팀원',                scope: '본인', sensitive: { 매출: false, 등급: false, KPI점수: true, 평가의견: false }, note: '본인 데이터만 열람 가능' },
];

// 범위별 색 (DS 시맨틱 클래스 매핑)
const scopeBadgeCls: Record<VisScope, string> = {
  전체: 'bg-neutral-900 text-white',
  그룹: 'bg-primary text-primary-foreground',
  본부: 'bg-info-500 text-white',
  팀:   'bg-success-600 text-white',
  본인: 'bg-muted text-muted-foreground',
};

const levelBadgeCls: Record<PermLevel, string> = {
  hr: 'bg-neutral-900 text-white',
  group: 'bg-primary text-primary-foreground',
  division: 'bg-info-500 text-white',
  team: 'bg-success-600 text-white',
  member: 'bg-muted text-muted-foreground',
};

interface PermRow {
  user: User;
  deptLabel: string;
  positionLabel: string;
}

type SidebarPermissionRow =
  | { id: string; kind: 'section'; label: string; count: number; items: NavItem[] }
  | { id: string; kind: 'item'; label: string; item: NavItem; grouped: boolean };

function PermissionTabShell({
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

function PermissionStateButton({
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={`inline-flex h-7 w-[88px] items-center justify-center gap-2 overflow-visible text-[11px] font-semibold transition-colors ${
        checked ? 'text-primary' : 'text-muted-foreground'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:text-foreground'}`}
    >
      <span
        className={`relative h-[22px] w-10 shrink-0 rounded-[4px] border transition-all ${
          checked
            ? 'border-primary bg-primary'
            : 'border-[#B8B3AE] bg-[#E7E3DE]'
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-[3px] border transition-all ${
            checked
              ? 'border-primary bg-primary-foreground'
              : 'border-[#A8A29C] bg-white'
          }`}
          style={{ left: checked ? '20px' : '2px' }}
        />
      </span>
      <span className="w-7 shrink-0 whitespace-nowrap text-left leading-none">{checked ? checkedLabel : uncheckedLabel}</span>
    </button>
  );
}

function PermissionBulkButton({
  active,
  onClick,
  disabled,
}: {
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-6 items-center justify-center border-b text-[10.5px] font-semibold transition-colors ${
        active
          ? 'border-muted-foreground/30 text-muted-foreground'
          : 'border-primary text-primary'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:text-foreground'}`}
    >
      {active ? '모두 숨김' : '모두 표시'}
    </button>
  );
}

function ScopeBadge({ scope }: { scope: VisScope }) {
  return (
    <span className={`inline-flex h-7 min-w-[56px] items-center justify-center rounded-[4px] px-2 text-[12px] font-bold ${scopeBadgeCls[scope]}`}>
      {scope}
    </span>
  );
}

// ── 권한 레벨 배지 ──────────────────────────────────────────────
function LevelBadge({ level }: { level: PermLevel }) {
  return (
    <span className={`inline-flex min-w-[84px] items-center justify-center rounded-[4px] px-2 py-1 text-[12px] font-bold ${levelBadgeCls[level]}`}>
      {LEVEL_BY_KEY[level].label}
    </span>
  );
}

export function PermissionsView() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user && isHrAdmin(user.role);

  const { matrix: serverMatrix, navVisibility: serverNav, setLocal: setPermLocal, hasFeature } = usePermissions();
  const { save: savePermissionsConfig } = usePermissionsCommands();
  const canEditPerms = isAdmin && hasFeature('권한 부여·수정');

  const [tab, setTab] = useState<'users' | 'matrix' | 'sidebar' | 'visibility'>('users');
  const [matrixConfig, setMatrixConfigState] = useState<MatrixConfig>(serverMatrix);
  const [navVisibility, setNavVisibilityState] = useState<NavConfig>(serverNav);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<PermLevel | '전체'>('전체');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [visRules, setVisRules] = useState(initialVisRules);

  useEffect(() => {
    if (dirty) return;
    setMatrixConfigState(serverMatrix);
    setNavVisibilityState(serverNav);
  }, [serverMatrix, serverNav, dirty]);

  const { data: usersData, loading, error, reload } = useUsers({ pageSize: 500 }, { enabled: !!user });
  const { data: chart } = useOrgChart({ enabled: !!user });
  const flat = useMemo(() => flattenOrg(chart), [chart]);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const rows = useMemo<PermRow[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => ({
      user: u,
      deptLabel: deptPath(u.departmentId, flat).join(' · ') || '소속 미지정',
      positionLabel: getPositionLabel(u.position, positions),
    }));
  }, [usersData, flat, positions]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          if (filterLevel !== '전체' && userLevel(r.user) !== filterLevel) return false;
          if (search) {
            const q = search.toLowerCase();
            if (!`${r.user.name} ${r.deptLabel}`.toLowerCase().includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko')),
    [rows, filterLevel, search],
  );

  const sidebarGroups = useMemo(
    () =>
      [
        { group: null as null, items: NAV_ITEMS.filter((i) => !i.group) },
        ...NAV_GROUP_ORDER.map((g) => ({ group: g, items: NAV_ITEMS.filter((i) => i.group === g) })),
      ].filter((g) => g.items.length > 0),
    [],
  );

  const sidebarRows = useMemo<SidebarPermissionRow[]>(() => {
    const list: SidebarPermissionRow[] = [];
    sidebarGroups.forEach(({ group, items }) => {
      if (group) {
        list.push({ id: `section-${group}`, kind: 'section', label: group, count: items.length, items });
      }
      items.forEach((item) => {
        list.push({
          id: `item-${item.key}`,
          kind: 'item',
          label: item.label,
          item,
          grouped: !!group,
        });
      });
    });
    return list;
  }, [sidebarGroups]);

  async function updateLevel(u: User, level: PermLevel) {
    const def = LEVEL_BY_KEY[level];
    if (def.role === u.role && def.scope === u.visibilityScope) return;
    setSavingId(u.id);
    try {
      await userCommands.update(u.id, { role: def.role, visibilityScope: def.scope });
      toast.show({ variant: 'success', message: `${u.name}님의 권한을 '${def.label}'(으)로 변경했어요.` });
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '권한 변경에 실패했어요.' });
    } finally {
      setSavingId(null);
    }
  }

  function toggleMatrix(level: PermLevel, feature: FeatureKey) {
    if (!canEditPerms) return;
    setMatrixConfigState((prev) => ({ ...prev, [level]: { ...prev[level], [feature]: !prev[level][feature] } }));
    setDirty(true);
  }

  function toggleNav(level: PermLevel, key: string) {
    if (!canEditPerms) return;
    setNavVisibilityState((prev) => ({ ...prev, [level]: { ...prev[level], [key]: !(prev[level]?.[key] !== false) } }));
    setDirty(true);
  }

  function isLevelAllSelected(level: PermLevel): boolean {
    return NAV_ITEMS.every((i) => navVisibility[level]?.[i.key] !== false);
  }
  function toggleLevelAll(level: PermLevel) {
    if (!canEditPerms) return;
    const allSel = isLevelAllSelected(level);
    setNavVisibilityState((prev) => {
      const next = { ...prev, [level]: { ...prev[level] } };
      NAV_ITEMS.forEach((i) => { next[level][i.key] = !allSel; });
      return next;
    });
    setDirty(true);
  }

  function isCatAllSelected(level: PermLevel, items: NavItem[]): boolean {
    return items.every((i) => navVisibility[level]?.[i.key] !== false);
  }
  function toggleCatLevel(level: PermLevel, items: NavItem[]) {
    if (!canEditPerms) return;
    const allSel = isCatAllSelected(level, items);
    setNavVisibilityState((prev) => {
      const next = { ...prev, [level]: { ...prev[level] } };
      items.forEach((i) => { next[level][i.key] = !allSel; });
      return next;
    });
    setDirty(true);
  }

  async function handleSavePerms() {
    if (!canEditPerms || saving) return;
    setSaving(true);
    try {
      const saved = await savePermissionsConfig({ matrix: matrixConfig, navVisibility });
      setMatrixConfigState(saved.matrix);
      setNavVisibilityState(saved.navVisibility);
      setPermLocal(saved.matrix, saved.navVisibility);
      setDirty(false);
      toast.show({ variant: 'success', message: '권한 설정을 저장했어요.' });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '권한 설정 저장에 실패했어요.' });
    } finally {
      setSaving(false);
    }
  }

  function toggleVis(roleId: string, field: SensitiveField) {
    setVisRules((prev) =>
      prev.map((r) =>
        r.role === roleId ? { ...r, sensitive: { ...r.sensitive, [field]: !r.sensitive[field] } } : r,
      ),
    );
  }

  if (!user) return null;
  if (!isAdmin) return <Forbidden message="권한 관리는 HR 관리자만 접근할 수 있어요." />;
  if (error) return <ErrorState onRetry={reload} message="사용자를 불러오지 못했어요." />;

  const filterOptions = [
    { value: '전체', label: '전체' },
    ...LEVEL_KEYS.map((l) => ({ value: l, label: LEVEL_BY_KEY[l].label })),
  ];
  const tabItems = [
    { key: 'users',      label: '사용자별 권한' },
    { key: 'matrix',     label: '권한 매트릭스' },
    { key: 'sidebar',    label: '사이드바 메뉴' },
    { key: 'visibility', label: '가시성 설정' },
  ];

  const userTableCols: DataTableColumn<PermRow>[] = [
    {
      key: 'name',
      header: '이름 / 부서',
      render: (r: PermRow) => (
        <div>
          <div className="text-[13px] font-semibold text-foreground">{r.user.name}</div>
          <div className="text-[11px] text-muted-foreground">{r.deptLabel}</div>
        </div>
      ),
    },
    {
      key: 'position',
      header: '직위',
      width: '80px',
      render: (r: PermRow) => (
        <span className="text-[12px] text-muted-foreground">{r.positionLabel}</span>
      ),
    },
    {
      key: 'level',
      header: '권한 레벨',
      width: '160px',
      render: (r: PermRow) => {
        const isSaving = savingId === r.user.id;
        return (
          <Select
            value={userLevel(r.user)}
            options={LEVEL_DEFS.map((d) => ({ value: d.key, label: d.label }))}
            onChange={(v) => void updateLevel(r.user, v as PermLevel)}
            disabled={isSaving || !canEditPerms}
          />
        );
      },
    },
  ];

  const matrixColumns: DataTableColumn<(typeof LEVEL_DEFS)[number]>[] = [
    {
      key: 'level',
      header: '권한 레벨',
      width: '240px',
      render: (cfg) => (
        <div className="min-w-0">
          <LevelBadge level={cfg.key} />
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{cfg.desc}</div>
        </div>
      ),
    },
    ...matrixCols.map((col): DataTableColumn<(typeof LEVEL_DEFS)[number]> => ({
      key: col,
      header: col,
      align: 'center',
      width: '132px',
      render: (cfg) => (
        <PermissionStateButton
          checked={matrixConfig[cfg.key][col]}
          onClick={() => toggleMatrix(cfg.key, col)}
          disabled={!canEditPerms}
        />
      ),
    })),
  ];

  const sidebarColumns: DataTableColumn<SidebarPermissionRow>[] = [
    {
      key: 'menu',
      header: '메뉴',
      width: '280px',
      render: (row) => (
        row.kind === 'section' ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-foreground">{row.label}</span>
            <span className="text-[10.5px] font-semibold text-muted-foreground">{row.count}</span>
          </div>
        ) : (
          <span className={`block truncate text-[13px] font-medium text-foreground ${row.grouped ? 'pl-4' : ''}`}>
            {row.label}
          </span>
        )
      ),
    },
    ...LEVEL_DEFS.map((def): DataTableColumn<SidebarPermissionRow> => ({
      key: def.key,
      header: (
        <div className="flex flex-col items-center gap-1">
          <span className="whitespace-nowrap text-[11.5px]">{def.label}</span>
          <PermissionBulkButton
            active={isLevelAllSelected(def.key)}
            onClick={() => toggleLevelAll(def.key)}
            disabled={!canEditPerms}
          />
        </div>
      ),
      align: 'center',
      width: '156px',
      render: (row) => {
        if (row.kind === 'section') {
          return (
            <PermissionBulkButton
              active={isCatAllSelected(def.key, row.items)}
              onClick={() => toggleCatLevel(def.key, row.items)}
              disabled={!canEditPerms}
            />
          );
        }
        const visible = navVisibility[def.key]?.[row.item.key] !== false;
        return (
          <PermissionStateButton
            checked={visible}
            checkedLabel="표시"
            uncheckedLabel="숨김"
            onClick={() => toggleNav(def.key, row.item.key)}
            disabled={!canEditPerms}
          />
        );
      },
    })),
  ];

  const visibilityColumns: DataTableColumn<VisRule>[] = [
    {
      key: 'role',
      header: '직급/직책',
      width: '240px',
      render: (rule) => (
        <div>
          <div className="text-[13px] font-semibold text-foreground">{rule.title}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{rule.note}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      header: '범위',
      align: 'center',
      width: '96px',
      render: (rule) => <ScopeBadge scope={rule.scope} />,
    },
    ...sensitiveFields.map((field): DataTableColumn<VisRule> => ({
      key: field,
      header: field,
      align: 'center',
      width: '128px',
      render: (rule) => {
        if (rule.scope === '본인') {
          return <span className="text-[13px] font-semibold text-muted-foreground/60">-</span>;
        }
        const isAdminRule = rule.role === 'hr-admin';
        const isAllowed = !!rule.sensitive[field];
        return (
          <PermissionStateButton
            checked={isAllowed}
            checkedLabel={isAdminRule ? '고정' : '허용'}
            uncheckedLabel="차단"
            onClick={() => toggleVis(rule.role, field)}
            disabled={isAdminRule}
          />
        );
      },
    })),
  ];

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="권한 관리"
        subtitle="조직·직급·직책 단위로 시스템 접근 권한과 데이터 가시성을 설정합니다."
        right={
          (tab === 'matrix' || tab === 'sidebar') && canEditPerms ? (
            <>
              {dirty && (
                <span className="text-[11.5px] font-semibold text-warning-700">
                  저장하지 않은 변경이 있어요
                </span>
              )}
              <Button
                variant="primary"
                leftIcon={<Save size={14} aria-hidden />}
                loading={saving}
                disabled={!dirty || saving}
                onClick={() => void handleSavePerms()}
              >
                권한 저장
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs
        items={tabItems}
        activeKey={tab}
        onChange={(k) => setTab(k as typeof tab)}
      />

      {/* ── 사용자별 권한 ── (사용자 관리 탭과 동일 패턴: 0 inset 툴바 + 카드 프레임 표) */}
      {tab === 'users' && (
        <div className="space-y-5">
          <div className="gx-toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="이름·부서 검색"
              className="w-full md:w-72"
            />
            <FilterChipBar
              options={filterOptions}
              value={filterLevel}
              onChange={(v) => setFilterLevel(v as PermLevel | '전체')}
            />
            <span className="ml-auto inline-flex h-8 items-center rounded-[4px] bg-muted px-3 text-[12px] font-bold text-muted-foreground">
              {filtered.length}명
            </span>
          </div>

          <div className="gx-panel overflow-hidden">
            {loading && rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
            ) : (
              <DataTable
                columns={userTableCols}
                rows={filtered}
                rowKey={(r) => r.user.id}
                stickyHeader
                empty={
                  <EmptyState
                    title="검색 결과가 없어요."
                    description="다른 이름이나 필터를 시도해 보세요."
                    action={
                      <Button variant="secondary" onClick={() => { setSearch(''); setFilterLevel('전체'); }}>
                        필터 초기화
                      </Button>
                    }
                  />
                }
              />
            )}
          </div>
        </div>
      )}

      {/* ── 권한 매트릭스 ── */}
      {tab === 'matrix' && (
        <PermissionTabShell
          notice={(
            <InfoBanner tone={canEditPerms ? 'info' : 'tip'}>
              {canEditPerms
                ? '셀에서 허용/차단을 전환한 뒤 권한 저장을 누르세요.'
                : "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다."}
            </InfoBanner>
          )}
        >
          <div className="gx-panel overflow-hidden">
            <DataTable
              columns={matrixColumns}
              rows={LEVEL_DEFS}
              rowKey={(row) => row.key}
              stickyHeader
              emphasizeHeader
              className="min-w-[1120px]"
              rowClassName={(row) => (row.key === 'hr' ? 'bg-muted/40' : undefined)}
            />
          </div>
        </PermissionTabShell>
      )}

      {/* ── 사이드바 메뉴 ── */}
      {tab === 'sidebar' && (
        <PermissionTabShell
          notice={(
            <InfoBanner tone={canEditPerms ? 'info' : 'tip'}>
              {canEditPerms
                ? '레벨 전체 또는 카테고리 단위로 메뉴 노출을 조정합니다.'
                : "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다."}
            </InfoBanner>
          )}
        >
          <div className="gx-panel overflow-hidden">
            <DataTable
              columns={sidebarColumns}
              rows={sidebarRows}
              rowKey={(row) => row.id}
              stickyHeader
              emphasizeHeader
              className="min-w-[1060px]"
              rowClassName={(row) => (row.kind === 'section' ? 'bg-accent/45 hover:bg-accent/45' : undefined)}
            />
          </div>
        </PermissionTabShell>
      )}

      {/* ── 가시성 설정(정책 시안) ── */}
      {tab === 'visibility' && (
        <PermissionTabShell>
          <div className="gx-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="gx-quiet-section-title">열람 범위</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                본인을 제외한 타인의 데이터를 어디까지 볼 수 있는지 정의합니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-0 md:grid-cols-3 xl:grid-cols-5">
              {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((scope) => {
                const desc: Record<VisScope, string> = {
                  전체: '전 조직',
                  그룹: '소속 그룹',
                  본부: '소속 본부',
                  팀: '소속 팀',
                  본인: '타인 열람 없음',
                };
                return (
                  <div key={scope} className="min-h-[98px] border-r border-border px-5 py-4 last:border-r-0">
                    <ScopeBadge scope={scope} />
                    <p className="mt-2 text-[13px] font-semibold text-foreground">{desc[scope]}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">본인 데이터는 항상 열람</p>
                  </div>
                );
              })}
            </div>
          </div>

          <InfoBanner tone="warning">
            <strong className="text-foreground">경쟁 구조 보호</strong> — 본부/팀 간 데이터는 상호 비공개이며,
            민감정보는 권한 범위 안에서만 표시됩니다.
          </InfoBanner>

          <div className="gx-panel overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="gx-quiet-section-title">타인 민감정보 열람 권한</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                권한 매트릭스와 동일한 토글 규격으로 허용/차단 상태를 조정합니다. 현재는 정책 시안이며 저장 연동 전입니다.
              </p>
            </div>
            <DataTable
              columns={visibilityColumns}
              rows={visRules}
              rowKey={(row) => row.role}
              stickyHeader
              emphasizeHeader
              className="min-w-[920px]"
              rowClassName={(row) => (row.role === 'hr-admin' ? 'bg-muted/40' : undefined)}
            />
          </div>
        </PermissionTabShell>
      )}
    </PageContainer>
  );
}
