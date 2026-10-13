'use client';

// 권한 관리 (hr_admin) — 탭4: 사용자별 권한 / 권한 매트릭스 / 사이드바 메뉴 / 가시성 설정(시안).
// 저장 모델 3종이 섞여 있어 탭마다 명시한다:
//   사용자별 권한 = 행 단위 즉시 적용 / 매트릭스·사이드바 = '권한 저장' 필요(dirty) / 가시성 = 정책 시안(저장 미연동, 읽기 전용).
// 데이터: GET /users(실데이터) + matrix/nav(usePermissions) + visibility(정적 mock).
// 탭 본문은 UsersPermTab / MatrixSidebarTabs / VisibilityTab 로 분리(상태·핸들러는 여기).
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, ShieldAlert, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { type OrgCascadeValue } from '@/components/OrgCascadeFilter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isHrAdmin, NAV_ITEMS, NAV_GROUP_ORDER, type NavItem } from '@/lib/nav';
import {
  levelOf,
  LEVEL_BY_KEY,
  type FeatureKey,
  type PermLevel,
  type MatrixConfig,
  type NavConfig,
} from '@/lib/permConfig';
import { flattenOrg, deptPath, descendantDeptIds } from '@/lib/org';
import { getPositionLabel } from '@/lib/ui';
import { usePositions } from '@/hooks/usePositions';
import type { User } from '@/lib/types';
import { usePermissionsCommands } from '../hooks';
import { MatrixTab, SidebarTab } from './MatrixSidebarTabs';
import { UsersPermTab } from './UsersPermTab';
import { VisibilityTab } from './VisibilityTab';
import type { PermRow, SidebarPermissionRow } from './PermissionsParts';

// 사용자 → 권한 레벨 래퍼
const userLevel = (u: User): PermLevel => levelOf(u.role, u.visibilityScope);

const tabItems = [
  { key: 'users',      label: '사용자별 권한' },
  { key: 'matrix',     label: '권한 매트릭스' },
  { key: 'sidebar',    label: '사이드바 메뉴' },
  { key: 'visibility', label: '가시성 설정 (시안)' },
];

export function PermissionsView() {
  const { user } = useAuth();
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
  // 자기잠금 방지 — 자기 레벨의 핵심 관리 권한('시스템 설정')을 끄기 전 확인 모달.
  const [pendingSelfOff, setPendingSelfOff] = useState<{ level: PermLevel; feature: FeatureKey } | null>(null);
  const selfLevel: PermLevel | null = user ? levelOf(user.role, user.visibilityScope) : null;
  // Part/ 수정요청 P5 — 그룹→본부→팀 캐스케이드 필터(image 2.png). 정렬: 이름 ↔ 조직 경로 토글.
  const [orgFilter, setOrgFilter] = useState<OrgCascadeValue>({ groupId: '', divisionId: '', teamId: '' });
  const [sortByOrg, setSortByOrg] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setMatrixConfigState(serverMatrix);
    setNavVisibilityState(serverNav);
  }, [serverMatrix, serverNav, dirty]);

  // 저장 전 이탈(새로고침·창 닫기·외부 이동) 시 브라우저 확인 — dirty 유실 방지.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // 미저장 변경 폐기 — 서버 상태로 되돌린다.
  function discardChanges() {
    setMatrixConfigState(serverMatrix);
    setNavVisibilityState(serverNav);
    setDirty(false);
  }

  // 탭 전환은 상태를 잃지 않지만, 저장 버튼이 시야에서 사라져 잊기 쉽다 — 전환 시 상기.
  function handleTabChange(next: typeof tab) {
    if (dirty && next !== tab) {
      toast('저장하지 않은 권한 변경이 있어요 — 하단 저장 바에서 저장하거나 취소할 수 있어요.');
    }
    setTab(next);
  }

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

  // 캐스케이드 필터의 가장 구체적인 선택(팀 > 본부 > 그룹) 하위 전체 부서 id.
  const orgFilterNodeId = orgFilter.teamId || orgFilter.divisionId || orgFilter.groupId || null;
  const orgFilterDeptIds = useMemo(
    () => descendantDeptIds(chart ?? null, orgFilterNodeId),
    [chart, orgFilterNodeId],
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          if (filterLevel !== '전체' && userLevel(r.user) !== filterLevel) return false;
          if (orgFilterDeptIds && (!r.user.departmentId || !orgFilterDeptIds.has(r.user.departmentId))) return false;
          if (search) {
            const q = search.toLowerCase();
            if (!`${r.user.name} ${r.deptLabel}`.toLowerCase().includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) =>
          sortByOrg
            ? a.deptLabel.localeCompare(b.deptLabel, 'ko') || a.user.name.localeCompare(b.user.name, 'ko')
            : a.user.name.localeCompare(b.user.name, 'ko'),
        ),
    [rows, filterLevel, orgFilterDeptIds, search, sortByOrg],
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
      toast.success(`${u.name}님의 권한을 '${def.label}'(으)로 변경했어요.`);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '권한 변경에 실패했어요.', { duration: 8000 });
    } finally {
      setSavingId(null);
    }
  }

  function applyMatrixToggle(level: PermLevel, feature: FeatureKey) {
    setMatrixConfigState((prev) => ({ ...prev, [level]: { ...prev[level], [feature]: !prev[level][feature] } }));
    setDirty(true);
  }

  function toggleMatrix(level: PermLevel, feature: FeatureKey) {
    if (!canEditPerms) return;
    const turningOff = matrixConfig[level]?.[feature] !== false;
    if (turningOff && level === selfLevel && feature === '권한 부여·수정') {
      // HR(자기 레벨)의 '권한 부여·수정'을 끄면 모든 HR이 이 화면을 편집할 수 없게 됨(자기잠금).
      toast.error("내 레벨(HR)의 '권한 부여·수정'은 차단할 수 없어요 — 관리 권한을 가진 HR이 최소 1명 유지돼야 해요.", { duration: 8000 });
      return;
    }
    if (turningOff && level === selfLevel && feature === '시스템 설정') {
      setPendingSelfOff({ level, feature });
      return;
    }
    applyMatrixToggle(level, feature);
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
    // 최종 가드 — HR 레벨의 '권한 부여·수정'이 꺼진 설정은 저장 자체를 차단(자기잠금 방지).
    if (selfLevel && matrixConfig[selfLevel]?.['권한 부여·수정'] === false) {
      toast.error("HR의 '권한 부여·수정'이 차단된 설정은 저장할 수 없어요 — 저장하면 아무도 권한을 되돌릴 수 없어요.", { duration: 8000 });
      return;
    }
    setSaving(true);
    try {
      const saved = await savePermissionsConfig({ matrix: matrixConfig, navVisibility });
      setMatrixConfigState(saved.matrix);
      setNavVisibilityState(saved.navVisibility);
      setPermLocal(saved.matrix, saved.navVisibility);
      setDirty(false);
      toast.success('권한 설정을 저장했어요.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '권한 설정 저장에 실패했어요.', { duration: 8000 });
    } finally {
      setSaving(false);
    }
  }


  if (!user) return null;
  if (!isAdmin) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            <ShieldAlert className="inline size-4" aria-hidden /> 접근 불가
          </EmptyTitle>
          <EmptyDescription>권한 관리는 HR 관리자만 접근할 수 있어요.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">메인으로</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive" className="flex flex-col items-start gap-3">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <div>
          <AlertTitle>문제가 발생했어요</AlertTitle>
          <AlertDescription>사용자를 불러오지 못했어요.</AlertDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reload}>
          다시 시도
        </Button>
      </Alert>
    );
  }

  // 500명 하드캡 절단 감지 — 서버 total 이 로드분보다 크면 배지로 알린다.
  const serverTotal = usersData?.meta?.total ?? null;
  const loadedCount = usersData?.data?.length ?? 0;
  const truncated = serverTotal != null && serverTotal > loadedCount;

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="권한 관리"
        subtitle="조직·직급·직책 단위로 시스템 접근 권한과 데이터 가시성을 설정합니다."
        right={
          // dirty 면 어느 탭에 있어도 저장 버튼·경고를 유지한다(탭 전환으로 저장 수단이 사라지지 않게).
          (tab === 'matrix' || tab === 'sidebar' || dirty) && canEditPerms ? (
            <>
              {dirty && (
                <span className="text-11h font-semibold text-warning-700">
                  저장하지 않은 변경이 있어요
                </span>
              )}
              <Button loading={saving} disabled={!dirty || saving} onClick={() => void handleSavePerms()}>
                <Save aria-hidden />
                권한 저장
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(k) => handleTabChange(k as typeof tab)} className="w-full">
        <TabsList>
          {tabItems.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'users' && (
        <UsersPermTab
          canEdit={canEditPerms}
          currentUserId={user.id}
          rows={rows}
          filtered={filtered}
          loading={loading}
          savingId={savingId}
          search={search}
          onSearch={setSearch}
          flat={flat}
          orgFilter={orgFilter}
          onOrgFilter={setOrgFilter}
          filterLevel={filterLevel}
          onFilterLevel={setFilterLevel}
          sortByOrg={sortByOrg}
          onToggleSortByOrg={() => setSortByOrg((v) => !v)}
          serverTotal={serverTotal}
          loadedCount={loadedCount}
          truncated={truncated}
          onUpdateLevel={(u, level) => void updateLevel(u, level)}
          onResetFilters={() => {
            setSearch('');
            setFilterLevel('전체');
            setOrgFilter({ groupId: '', divisionId: '', teamId: '' });
          }}
        />
      )}

      {tab === 'matrix' && (
        <MatrixTab matrixConfig={matrixConfig} canEdit={canEditPerms} onToggle={toggleMatrix} />
      )}

      {tab === 'sidebar' && (
        <SidebarTab
          rows={sidebarRows}
          navVisibility={navVisibility}
          canEdit={canEditPerms}
          onToggleNav={toggleNav}
          isLevelAllSelected={isLevelAllSelected}
          onToggleLevelAll={toggleLevelAll}
          isCatAllSelected={isCatAllSelected}
          onToggleCatLevel={toggleCatLevel}
        />
      )}

      {tab === 'visibility' && <VisibilityTab />}

      {/* dirty 시 하단 고정 저장 바 — 어느 탭·스크롤 위치에서도 저장/취소 수단이 보이게. */}
      {dirty && canEditPerms && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-300 bg-card px-4 py-3 shadow-md">
          <span className="text-12h font-semibold text-warning-700">
            저장하지 않은 권한 변경이 있어요 — 저장 전에는 적용되지 않아요.
          </span>
          <span className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={saving} onClick={discardChanges}>
              <Undo2 aria-hidden />
              변경 취소
            </Button>
            <Button size="sm" loading={saving} disabled={saving} onClick={() => void handleSavePerms()}>
              <Save aria-hidden />
              권한 저장
            </Button>
          </span>
        </div>
      )}

      {/* 자기 권한 차단 확인 모달 — 자기 레벨의 핵심 관리 권한을 끌 때 경고 */}
      <AlertDialog open={!!pendingSelfOff} onOpenChange={(o) => !o && setPendingSelfOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>내 권한을 차단할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              &lsquo;{pendingSelfOff?.feature}&rsquo; 권한을 내 레벨({selfLevel ? LEVEL_BY_KEY[selfLevel].label : ''})에서
              차단하려고 해요. 저장하면 나를 포함한 같은 레벨 사용자 모두에게 적용되고, 해당 기능을 이 계정으로 더는 쓸 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingSelfOff) applyMatrixToggle(pendingSelfOff.level, pendingSelfOff.feature);
                setPendingSelfOff(null);
              }}
            >
              차단
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
