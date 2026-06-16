'use client';

// 권한 관리 (hr_admin) — 탭4: 사용자별 권한 / 권한 매트릭스 / 사이드바 메뉴 / 가시성 설정.
// 데이터: GET /users(실데이터) + matrix/nav(usePermissions) + visibility(정적 mock).
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState, EmptyState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Tabs } from '@/components/Tabs';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { DataTable } from '@/components/DataTable';
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
import { getPositionLabel, SCOPE_LABEL } from '@/lib/ui';
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
  전체: 'bg-primary text-primary-foreground',
  그룹: 'bg-purple-700 text-white',
  본부: 'bg-primary text-primary-foreground',
  팀:   'bg-info-500 text-white',
  본인: 'bg-muted text-muted-foreground',
};

interface PermRow {
  user: User;
  deptLabel: string;
  positionLabel: string;
}

// ── 권한 레벨 배지 ──────────────────────────────────────────────
function LevelBadge({ level }: { level: PermLevel }) {
  const cfg = LEVEL_BY_KEY[level];
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[12px] font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
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

  const userTableCols = [
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

  return (
    <PageContainer>
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

      <Card padding="sm">
        <div className="border-b border-border px-4">
          <Tabs
            items={[
              { key: 'users',      label: '사용자별 권한' },
              { key: 'matrix',     label: '권한 매트릭스' },
              { key: 'sidebar',    label: '사이드바 메뉴' },
              { key: 'visibility', label: '가시성 설정' },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </div>

        {/* ── 사용자별 권한 ── */}
        {tab === 'users' && (
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="이름·부서 검색"
                className="w-56"
              />
              <FilterChipBar
                options={filterOptions}
                value={filterLevel}
                onChange={(v) => setFilterLevel(v as PermLevel | '전체')}
              />
              <span className="text-[12px] text-muted-foreground ml-auto">{filtered.length}명</span>
            </div>

            {loading && rows.length === 0 ? (
              <Skeleton className="h-48 w-full" />
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
        )}

        {/* ── 권한 매트릭스 ── */}
        {tab === 'matrix' && (
          <div className="p-4 flex flex-col gap-3">
            <InfoBanner tone={canEditPerms ? 'info' : 'tip'}>
              {canEditPerms
                ? "셀을 클릭해 허용/차단을 전환한 뒤 우측 상단 '권한 저장'을 누르세요."
                : "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다."}
            </InfoBanner>

            <div
              className="rounded-lg border border-border overflow-hidden"
              style={{ pointerEvents: canEditPerms ? undefined : 'none', opacity: canEditPerms ? 1 : 0.65 }}
            >
              <div
                className="grid bg-muted px-4 py-2.5 border-b border-border"
                style={{ gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)` }}
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  권한 레벨
                </span>
                {matrixCols.map((c) => (
                  <span key={c} className="text-[11px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
                    {c}
                  </span>
                ))}
              </div>
              {LEVEL_DEFS.map((cfg, li) => {
                const level = cfg.key;
                const perms = matrixConfig[level];
                return (
                  <div
                    key={level}
                    className={`grid items-center px-4 py-2.5 border-b border-border ${li === 0 ? 'bg-muted/50' : 'bg-card'}`}
                    style={{ gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)` }}
                  >
                    <div>
                      <LevelBadge level={level} />
                      <div className="text-[10.5px] text-muted-foreground mt-1">{cfg.desc}</div>
                    </div>
                    {matrixCols.map((col) => (
                      <div key={col} className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleMatrix(level, col)}
                          title={perms[col] ? '차단으로 변경' : '허용으로 변경'}
                          className="p-0.5 rounded focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {perms[col] ? (
                            <CheckCircle2 size={16} aria-hidden className="text-info-500" />
                          ) : (
                            <span className="block w-4 h-4 rounded border-2 border-border" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 사이드바 메뉴 ── */}
        {tab === 'sidebar' && (
          <div className="p-4 flex flex-col gap-3">
            <InfoBanner tone={canEditPerms ? 'info' : 'tip'}>
              {canEditPerms
                ? "열 상단 버튼으로 레벨 전체를, 카테고리 버튼으로 해당 그룹만 일괄 조정할 수 있습니다."
                : "읽기 전용입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다."}
            </InfoBanner>

            <div
              className="rounded-lg border border-border overflow-hidden"
              style={{ pointerEvents: canEditPerms ? undefined : 'none', opacity: canEditPerms ? 1 : 0.65 }}
            >
              {/* 헤더 */}
              <div
                className="grid bg-muted px-4 py-2.5 border-b border-border"
                style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">메뉴</span>
                {LEVEL_DEFS.map((d) => {
                  const allSel = isLevelAllSelected(d.key);
                  return (
                    <div key={d.key} className="flex flex-col items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {d.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLevelAll(d.key)}
                        className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors whitespace-nowrap ${
                          allSel
                            ? 'border-danger-500 text-danger-500 bg-danger-50'
                            : 'border-primary text-primary bg-purple-50'
                        }`}
                      >
                        {allSel ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {sidebarGroups.map(({ group, items }) => (
                <div key={group ?? '__top__'}>
                  {group && (
                    <div
                      className="grid items-center px-4 py-2 bg-purple-50/50 border-t border-b border-border"
                      style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
                    >
                      <div>
                        <span className="text-[11.5px] font-bold text-primary">{group}</span>
                        <span className="text-[10.5px] text-muted-foreground ml-1.5">{items.length}개</span>
                      </div>
                      {LEVEL_DEFS.map((d) => {
                        const catAllSel = isCatAllSelected(d.key, items);
                        return (
                          <div key={d.key} className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => toggleCatLevel(d.key, items)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                catAllSel
                                  ? 'border-danger-500 text-danger-500 bg-danger-50'
                                  : 'border-primary text-primary bg-purple-50'
                              }`}
                            >
                              {catAllSel ? '해제' : '전체'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="grid items-center px-4 py-2 border-b border-border/60"
                      style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
                    >
                      <span
                        className="text-[12.5px] font-medium text-foreground"
                        style={{ paddingLeft: group ? 10 : 0 }}
                      >
                        {item.label}
                      </span>
                      {LEVEL_DEFS.map((d) => {
                        const visible = navVisibility[d.key]?.[item.key] !== false;
                        return (
                          <div key={d.key} className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => toggleNav(d.key, item.key)}
                              className="p-0.5 rounded focus-visible:ring-2 focus-visible:ring-primary/30"
                              title={visible ? '숨김으로 변경' : '표시로 변경'}
                            >
                              {visible ? (
                                <CheckCircle2 size={16} aria-hidden className="text-info-500" />
                              ) : (
                                <span className="block w-4 h-4 rounded border-2 border-border" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 가시성 설정(정적 mock) ── */}
        {tab === 'visibility' && (
          <div className="p-4 flex flex-col gap-4">
            {/* 범위 카드 */}
            <div>
              <h4 className="text-[13px] font-bold text-foreground mb-1">열람 범위 (본인 외 타인 기준)</h4>
              <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
                아래 범위는 <strong>본인을 제외한 타인</strong>의 데이터를 어디까지 볼 수 있는지를 뜻합니다.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((s) => {
                  const desc: Record<VisScope, string> = {
                    전체: '인사총무팀·대표\n본인 외 전 조직',
                    그룹: '그룹 대표\n본인 외 소속 그룹 전체',
                    본부: '본부장\n본인 외 소속 본부만',
                    팀: '팀장\n본인 외 소속 팀만',
                    본인: '팀원\n타인 열람 없음',
                  };
                  return (
                    <div key={s} className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className={`h-1 ${scopeBadgeCls[s].split(' ')[0]}`} />
                      <div className="p-3">
                        <div className={`text-[13px] font-bold mb-1 ${s === '본인' ? 'text-muted-foreground' : 'text-primary'}`}>
                          {s}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                          {desc[s]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <InfoBanner tone="info">
              <div className="flex items-start gap-2">
                <Eye size={13} aria-hidden className="shrink-0 mt-0.5" />
                <span>
                  <strong>본인 데이터는 항상 열람</strong> — 모든 구성원은 직급·범위와 무관하게
                  자신의 평가의견·등급·KPI점수·실적을 언제나 볼 수 있습니다.
                </span>
              </div>
            </InfoBanner>

            <InfoBanner tone="warning">
              <div className="flex items-start gap-2">
                <Lock size={13} aria-hidden className="shrink-0 mt-0.5" />
                <span>
                  <strong>경쟁 구조 보호</strong> — 본부끼리·팀끼리는 서로의 데이터를 열람할 수 없습니다.
                  타인의 민감정보는 자기 범위 내에서만 공개됩니다.
                </span>
              </div>
            </InfoBanner>

            {/* 민감정보 매트릭스 */}
            <Card title="타인 민감정보 열람 권한 (범위 내 한정)" padding="sm">
              <p className="text-[11.5px] text-muted-foreground mb-3">
                Eye 아이콘 클릭으로 허용/차단을 조정합니다. (정책 시안 — 저장 미연동)
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <div
                  className="grid bg-muted px-4 py-2.5 border-b border-border"
                  style={{ gridTemplateColumns: `220px 80px repeat(${sensitiveFields.length}, 1fr)` }}
                >
                  {['직급/직책', '범위', ...sensitiveFields].map((h) => (
                    <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide text-center first:text-left">
                      {h}
                    </span>
                  ))}
                </div>
                {visRules.map((r) => {
                  const isAdminRule = r.role === 'hr-admin';
                  return (
                    <div
                      key={r.role}
                      className={`grid items-center px-4 py-2.5 border-b border-border ${isAdminRule ? 'bg-muted/50' : 'bg-card'}`}
                      style={{ gridTemplateColumns: `220px 80px repeat(${sensitiveFields.length}, 1fr)` }}
                    >
                      <div>
                        <div className={`text-[13px] ${isAdminRule ? 'font-bold' : 'font-medium'} text-foreground`}>
                          {r.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.note}</div>
                      </div>
                      <div>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold ${scopeBadgeCls[r.scope]}`}>
                          {r.scope}
                        </span>
                      </div>
                      {sensitiveFields.map((field) => {
                        if (r.scope === '본인') {
                          return (
                            <div key={field} className="flex justify-center text-[13px] text-muted-foreground/60" title="본인 외 열람 대상 없음">
                              —
                            </div>
                          );
                        }
                        const isAllowed = !!r.sensitive[field];
                        return (
                          <div key={field} className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => !isAdminRule && toggleVis(r.role, field)}
                              title={isAdminRule ? '관리자 고정' : isAllowed ? '차단으로 변경' : '허용으로 변경'}
                              className={isAdminRule ? 'cursor-default' : 'cursor-pointer'}
                            >
                              {isAdminRule ? (
                                <Eye size={16} aria-hidden className="text-primary" />
                              ) : isAllowed ? (
                                <Eye size={16} aria-hidden className="text-info-500" />
                              ) : (
                                <EyeOff size={16} aria-hidden className="text-muted-foreground/50" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
