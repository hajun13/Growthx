'use client';

// 권한 관리 (hr_admin) — 디자인 PermMgmt.tsx 레이아웃을 실 API에 연동.
// 데이터 소스: @growthx/contracts 생성 클라이언트(permissionsController*) — feature api/hooks 경유.
// 탭4: 사용자별 권한(실데이터 — GET /users, role 수정=PATCH /users/:id) /
//      권한 매트릭스 / 사이드바 메뉴 / 가시성 설정(정적 mock — 백엔드 없음).
// 권한 레벨(부여) = Role + visibilityScope. 조직 그룹→본부→팀에 맞춰 5단계로 분리:
//   전체관리자→hr_admin·company / 그룹 대표→division_head·group / 본부장→division_head·division /
//   팀장→team_lead·team / 일반사용자→employee·self. (그룹대표/본부장은 같은 Role, scope 로 구분)
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { isHrAdmin, NAV_ITEMS } from '@/lib/nav';
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

// 권한 레벨(PermLevel) SSOT 는 @/lib/permConfig 에서 가져온다.
// 사용자 → 권한 레벨(편의 래퍼).
const userLevel = (u: User): PermLevel => levelOf(u.role, u.visibilityScope);

// 권한 매트릭스 열(허용 기능).
const matrixCols: FeatureKey[] = [
  '평가결과 전체열람',
  'KPI 승인/반려',
  '등급풀 수정',
  '권한 부여·수정',
  '시스템 설정',
  '감사로그',
];

/* ── 가시성 설정(정적 mock — 백엔드 없음) ── */
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
  {
    role: 'hr-admin',
    title: '인사총무팀 (관리자)',
    scope: '전체',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true },
    note: '전 조직 전체 열람·수정 가능',
  },
  {
    role: 'ceo',
    title: '대표이사',
    scope: '전체',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false },
    note: '그룹 전체 집계 열람',
  },
  {
    role: 'group-head',
    title: '그룹 대표',
    scope: '그룹',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: false },
    note: '소속 그룹 전체 열람',
  },
  {
    role: 'dept-head',
    title: '본부장',
    scope: '본부',
    sensitive: { 매출: true, 등급: true, KPI점수: true, 평가의견: true },
    note: '소속 본부만 열람, 타 본부 차단',
  },
  {
    role: 'team-lead',
    title: '팀장',
    scope: '팀',
    sensitive: { 매출: false, 등급: true, KPI점수: true, 평가의견: true },
    note: '소속 팀만 열람, 매출 집계 제한',
  },
  {
    role: 'member',
    title: '팀원',
    scope: '본인',
    sensitive: { 매출: false, 등급: false, KPI점수: true, 평가의견: false },
    note: '본인 데이터만 열람 가능',
  },
];
const scopeColor: Record<VisScope, string> = {
  전체: '#3f2c80',
  그룹: '#564599',
  본부: '#0054ca',
  팀: '#0e9aa0',
  본인: '#484551',
};

interface PermRow {
  user: User;
  deptLabel: string;
  positionLabel: string;
}

export function PermissionsView() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user && isHrAdmin(user.role);

  // 권한 설정은 서버에서 로드(usePermissions). 편집은 로컬 드래프트에 모으고 저장 시 PUT(feature api).
  const {
    matrix: serverMatrix,
    navVisibility: serverNav,
    setLocal: setPermLocal,
    hasFeature,
  } = usePermissions();
  const { save: savePermissionsConfig } = usePermissionsCommands();
  // 저장은 hr_admin + '권한 부여·수정' 기능이 있을 때만.
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

  // 서버 설정 도착/갱신 시 드래프트 동기화(사용자가 편집 중이면 덮어쓰지 않음).
  useEffect(() => {
    if (dirty) return;
    setMatrixConfigState(serverMatrix);
    setNavVisibilityState(serverNav);
  }, [serverMatrix, serverNav, dirty]);
  const {
    data: usersData,
    loading,
    error,
    reload,
  } = useUsers({ pageSize: 500 }, { enabled: !!user });

  const { data: chart } = useOrgChart({ enabled: !!user });
  const flat = useMemo(() => flattenOrg(chart), [chart]);
  // 직급 라벨: 관리형 레지스트리(PositionDef) 우선 → 정적 폴백. 커스텀 직급(사장 등) 자동 반영.
  const { data: positionsData } = usePositions(
    { includeInactive: true },
    { enabled: !!user },
  );
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const rows = useMemo<PermRow[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => {
      const path = deptPath(u.departmentId, flat);
      return {
        user: u,
        deptLabel: path.join(' · ') || '소속 미지정',
        positionLabel: getPositionLabel(u.position, positions),
      };
    });
  }, [usersData, flat, positions]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          if (filterLevel !== '전체' && userLevel(r.user) !== filterLevel) return false;
          if (search) {
            const q = search.toLowerCase();
            const hay = `${r.user.name} ${r.deptLabel}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        // 이름 가나다순(한글 로케일 정렬).
        .sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko')),
    [rows, filterLevel, search],
  );

  async function updateLevel(u: User, level: PermLevel) {
    const def = LEVEL_BY_KEY[level];
    if (def.role === u.role && def.scope === u.visibilityScope) return;
    setSavingId(u.id);
    try {
      // 권한 레벨 = role + visibilityScope 동시 변경(그룹 대표/본부장 구분).
      await userCommands.update(u.id, { role: def.role, visibilityScope: def.scope });
      toast.show({ variant: 'success', message: `${u.name}님의 권한을 '${def.label}'(으)로 변경했어요.` });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '권한 변경에 실패했어요.',
      });
    } finally {
      setSavingId(null);
    }
  }

  function toggleMatrix(level: PermLevel, feature: FeatureKey) {
    if (!canEditPerms) return;
    setMatrixConfigState((prev) => ({
      ...prev,
      [level]: { ...prev[level], [feature]: !prev[level][feature] },
    }));
    setDirty(true);
  }

  function toggleNav(level: PermLevel, key: string) {
    if (!canEditPerms) return;
    setNavVisibilityState((prev) => ({
      ...prev,
      [level]: { ...prev[level], [key]: !(prev[level]?.[key] !== false) },
    }));
    setDirty(true);
  }

  async function handleSavePerms() {
    if (!canEditPerms || saving) return;
    setSaving(true);
    try {
      const saved = await savePermissionsConfig({
        matrix: matrixConfig,
        navVisibility,
      });
      // 저장 결과(서버 정규화값)로 드래프트·전역 캐시 동기화.
      setMatrixConfigState(saved.matrix);
      setNavVisibilityState(saved.navVisibility);
      setPermLocal(saved.matrix, saved.navVisibility);
      setDirty(false);
      toast.show({ variant: 'success', message: '권한 설정을 저장했어요.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '권한 설정 저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleVis(roleId: string, field: SensitiveField) {
    setVisRules((prev) =>
      prev.map((r) =>
        r.role === roleId
          ? { ...r, sensitive: { ...r.sensitive, [field]: !r.sensitive[field] } }
          : r,
      ),
    );
  }

  if (!user) return null;
  if (!isAdmin) {
    return <Forbidden message="권한 관리는 HR 관리자만 접근할 수 있어요." />;
  }
  if (error) {
    return <ErrorState onRetry={reload} message="사용자를 불러오지 못했어요." />;
  }

  const tabs = [
    { id: 'users' as const, label: '사용자별 권한' },
    { id: 'matrix' as const, label: '권한 매트릭스' },
    { id: 'sidebar' as const, label: '사이드바 메뉴' },
    { id: 'visibility' as const, label: '가시성 설정' },
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
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#7d5700' }}>
                  저장하지 않은 변경이 있어요
                </span>
              )}
              <button
                onClick={() => void handleSavePerms()}
                disabled={!dirty || saving}
                className="flex items-center gap-1.5"
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  border: 'none',
                  background: !dirty || saving ? 'rgba(202,196,210,0.6)' : '#3f2c80',
                  cursor: !dirty || saving ? 'not-allowed' : 'pointer',
                  boxShadow: !dirty || saving ? 'none' : '0 2px 8px rgba(63,44,128,0.2)',
                }}
              >
                <Save size={14} /> {saving ? '저장 중…' : '권한 저장'}
              </button>
            </>
          ) : undefined
        }
      />

      <div style={{
        background: '#fff',
        border: '1px solid rgba(202,196,210,0.5)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
      }}>
        {/* 탭 */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(202,196,210,0.3)' }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 20px',
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 400,
                  color: active ? '#0054ca' : '#797582',
                  borderBottom: active ? '2px solid #0054ca' : '2px solid transparent',
                  marginBottom: -1,
                  background: 'transparent',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── 사용자별 권한 (인라인 직접 편집) ── */}
        {tab === 'users' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="flex items-center gap-2"
                style={{
                  border: '1px solid rgba(202,196,210,0.7)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  background: '#fff',
                  minWidth: 220,
                }}
              >
                <Search size={13} color="#797582" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름·부서 검색"
                  className="outline-none"
                  style={{ fontSize: 12.5, background: 'transparent', color: '#191c1f', border: 'none' }}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['전체', ...LEVEL_KEYS] as const).map((l) => {
                  const active = filterLevel === l;
                  const cfg = l !== '전체' ? LEVEL_BY_KEY[l] : null;
                  return (
                    <button
                      key={l}
                      onClick={() => setFilterLevel(l as PermLevel | '전체')}
                      style={{
                        padding: '6px 13px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        background: active ? (cfg ? cfg.bg : '#3f2c80') : '#fff',
                        color: active ? '#fff' : '#484551',
                        border: `1px solid ${active ? (cfg ? cfg.bg : '#3f2c80') : 'rgba(202,196,210,0.7)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {l === '전체' ? '전체' : LEVEL_BY_KEY[l].label}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: '#797582', marginLeft: 'auto' }}>
                {filtered.length}명
              </span>
            </div>

            <div style={{
              border: '1px solid rgba(202,196,210,0.5)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 150px 90px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(202,196,210,0.3)',
                  background: '#f2f3f7',
                }}
              >
                {['이름/부서', '직위', '권한 레벨', '가시 범위'].map((h) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#605d67', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {h}
                  </div>
                ))}
              </div>
              {loading && rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#797582', fontSize: 13 }}>
                  불러오는 중…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#797582', fontSize: 13 }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filtered.map((r) => {
                  const u = r.user;
                  const cfg = LEVEL_BY_KEY[userLevel(u)];
                  const isSaving = savingId === u.id;
                  return (
                    <div
                      key={u.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 150px 90px',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: '1px solid rgba(202,196,210,0.2)',
                        opacity: u.isActive ? 1 : 0.5,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f9fd'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: '#797582' }}>{r.deptLabel}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#484551' }}>{r.positionLabel}</div>
                      {/* 권한 레벨 — 인라인 select(색=권한색, 수정 버튼 없음) */}
                      <div>
                        <select
                          value={userLevel(u)}
                          disabled={isSaving}
                          onChange={(e) => void updateLevel(u, e.target.value as PermLevel)}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: cfg.bg,
                            color: cfg.color,
                            border: 'none',
                            borderRadius: 6,
                            padding: '3px 8px',
                            cursor: isSaving ? 'wait' : 'pointer',
                            outline: 'none',
                            maxWidth: '100%',
                          }}
                          title="권한 레벨을 클릭해 바로 변경 (역할+가시 범위)"
                        >
                          {LEVEL_DEFS.map((d) => (
                            <option key={d.key} value={d.key} style={{ background: '#fff', color: '#191c1f' }}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* 가시 범위(실데이터 — 읽기) */}
                      <div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#484551',
                            background: 'rgba(202,196,210,0.25)',
                            padding: '2px 8px',
                            borderRadius: 5,
                          }}
                        >
                          {SCOPE_LABEL[u.visibilityScope]}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── 권한 매트릭스(정적 안내) ── */}
        {tab === 'matrix' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: '#605d67', lineHeight: 1.6 }}>
              {canEditPerms
                ? "권한 레벨별 허용 기능을 설정합니다. 셀을 클릭해 허용/차단을 전환한 뒤 우측 상단 '권한 저장'을 눌러 적용하세요."
                : "권한 레벨별 허용 기능 설정입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다(읽기 전용)."}
            </div>
            <div style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)`,
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(202,196,210,0.3)',
                  background: '#f2f3f7',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#605d67' }}>권한 레벨</div>
                {matrixCols.map((c) => (
                  <div key={c} style={{ fontSize: 11, fontWeight: 600, color: '#605d67', textAlign: 'center' }}>
                    {c}
                  </div>
                ))}
              </div>
              {LEVEL_DEFS.map((cfg, li) => {
                const level = cfg.key;
                const perms = matrixConfig[level];
                return (
                  <div
                    key={level}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)`,
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: '1px solid rgba(202,196,210,0.2)',
                      background: li === 0 ? '#f8f9fd' : 'transparent',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 6 }}>
                        {cfg.label}
                      </span>
                      <div style={{ fontSize: 10.5, color: '#797582', marginTop: 4 }}>{cfg.desc}</div>
                    </div>
                    {matrixCols.map((col) => (
                      <div key={col} className="flex justify-center">
                        <button
                          onClick={() => toggleMatrix(level, col)}
                          disabled={!canEditPerms}
                          title={
                            !canEditPerms
                              ? '읽기 전용 (권한 부여·수정 권한 필요)'
                              : perms[col]
                                ? '차단으로 변경'
                                : '허용으로 변경'
                          }
                          style={{ background: 'none', border: 'none', padding: 0, cursor: canEditPerms ? 'pointer' : 'not-allowed', lineHeight: 0 }}
                        >
                          {perms[col] ? (
                            <CheckCircle2 size={16} color="#0e9aa0" />
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid rgba(202,196,210,0.8)' }} />
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

        {/* ── 사이드바 메뉴 권한(역할별 nav 가시성) ── */}
        {tab === 'sidebar' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12.5, color: '#605d67', lineHeight: 1.6 }}>
              {canEditPerms
                ? "권한 레벨별로 사이드바에 표시할 메뉴를 설정합니다. 변경 후 우측 상단 '권한 저장'을 눌러 적용하세요."
                : "권한 레벨별 사이드바 메뉴 설정입니다. 변경하려면 '권한 부여·수정' 권한이 필요합니다(읽기 전용)."}
            </p>
            <div style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, overflow: 'hidden' }}>
              {/* 헤더 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px repeat(5, 1fr)',
                  background: '#f2f3f7',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(202,196,210,0.3)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#605d67' }}>메뉴</div>
                {LEVEL_DEFS.map((d) => (
                  <div
                    key={d.key}
                    style={{ fontSize: 11, fontWeight: 600, color: '#605d67', textAlign: 'center' }}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
              {/* 행 */}
              {NAV_ITEMS.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '180px repeat(5, 1fr)',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: '1px solid rgba(202,196,210,0.15)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#191c1f' }}>{item.label}</div>
                    {item.group && <div style={{ fontSize: 10.5, color: '#9490a0' }}>{item.group}</div>}
                  </div>
                  {LEVEL_DEFS.map((d) => {
                    const visible = navVisibility[d.key]?.[item.key] !== false;
                    return (
                      <div key={d.key} style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => toggleNav(d.key, item.key)}
                          disabled={!canEditPerms}
                          title={
                            !canEditPerms
                              ? '읽기 전용 (권한 부여·수정 권한 필요)'
                              : visible
                                ? '숨김으로 변경'
                                : '표시로 변경'
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: canEditPerms ? 'pointer' : 'not-allowed',
                            padding: 0,
                            lineHeight: 0,
                          }}
                        >
                          {visible ? (
                            <CheckCircle2 size={16} color="#0e9aa0" />
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid rgba(202,196,210,0.8)' }} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 가시성 설정(정적 mock) ── */}
        {tab === 'visibility' && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#191c1f' }}>열람 범위 (본인 외 타인 기준)</div>
              <div style={{ fontSize: 12, color: '#605d67', marginTop: 4, lineHeight: 1.6 }}>
                아래 범위는 <strong>본인을 제외한 타인</strong>의 데이터를 어디까지 볼 수 있는지를 뜻합니다.
                본인의 평가의견·등급·KPI점수·실적은 범위와 무관하게 <strong>항상 본인이 열람</strong>할 수 있습니다.
              </div>
            </div>
            {/* 범위 카드(가로 1줄) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((s) => {
                const c = scopeColor[s];
                const desc: Record<VisScope, string> = {
                  전체: '인사총무팀·대표\n본인 외 전 조직',
                  그룹: '그룹 대표\n본인 외 소속 그룹 전체',
                  본부: '본부장\n본인 외 소속 본부만 (타 본부 차단)',
                  팀: '팀장\n본인 외 소속 팀만 (타 팀 차단)',
                  본인: '팀원\n타인 열람 없음 (본인만)',
                };
                return (
                  <div
                    key={s}
                    style={{
                      border: '1px solid rgba(202,196,210,0.5)',
                      borderTop: `3px solid ${c}`,
                      borderRadius: '0 0 12px 12px',
                      background: '#fff',
                    }}
                  >
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{s}</div>
                      <div style={{ fontSize: 11, color: '#605d67', marginTop: 4, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {desc[s]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 본인 데이터 항상 열람 원칙 */}
            <div
              className="flex items-start gap-2"
              style={{
                padding: '10px 14px',
                border: '1px solid rgba(14,154,160,0.3)',
                borderLeft: '3px solid #0e9aa0',
                borderRadius: 8,
                background: 'rgba(14,154,160,0.05)',
              }}
            >
              <Eye size={13} color="#0e9aa0" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#484551', lineHeight: 1.6 }}>
                <strong style={{ color: '#0e9aa0' }}>본인 데이터는 항상 열람</strong> — 모든 구성원은 직급·범위와 무관하게
                <strong> 자신의 평가의견·등급·KPI점수·실적</strong>을 언제나 볼 수 있습니다.
              </span>
            </div>

            {/* 경쟁 구조 안내 */}
            <div
              className="flex items-start gap-2"
              style={{
                padding: '10px 14px',
                border: '1px solid rgba(186,26,26,0.25)',
                borderLeft: '3px solid #ba1a1a',
                borderRadius: 8,
                background: 'rgba(186,26,26,0.04)',
              }}
            >
              <Lock size={13} color="#ba1a1a" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#484551', lineHeight: 1.6 }}>
                <strong style={{ color: '#ba1a1a' }}>경쟁 구조 보호</strong> — 본부끼리·팀끼리는 서로의(타인) 데이터를 열람할 수
                없습니다. 타인의 민감정보는 자기 범위 내에서만 공개됩니다.
              </span>
            </div>

            {/* 민감정보 매트릭스 */}
            <div style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(202,196,210,0.3)', background: '#f2f3f7' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#191c1f' }}>타인 민감정보 열람 권한 (범위 내 한정)</div>
                <div style={{ fontSize: 11.5, color: '#605d67', marginTop: 2, lineHeight: 1.5 }}>
                  Eye 아이콘 클릭으로 허용/차단을 조정합니다. (정책 시안 — 저장 미연동)
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `220px 80px repeat(${sensitiveFields.length}, 1fr)`,
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(202,196,210,0.3)',
                  background: '#f2f3f7',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: '#605d67' }}>직급/직책</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#605d67' }}>범위</div>
                {sensitiveFields.map((f) => (
                  <div key={f} style={{ fontSize: 11, fontWeight: 600, color: '#605d67', textAlign: 'center' }}>
                    {f}
                  </div>
                ))}
              </div>
              {visRules.map((r) => {
                const isAdminRule = r.role === 'hr-admin';
                return (
                  <div
                    key={r.role}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `220px 80px repeat(${sensitiveFields.length}, 1fr)`,
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: '1px solid rgba(202,196,210,0.2)',
                      background: isAdminRule ? '#f8f9fd' : 'transparent',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isAdminRule ? 700 : 500, color: '#191c1f' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: '#797582', marginTop: 1 }}>{r.note}</div>
                    </div>
                    <div>
                      <span
                        style={{ fontSize: 11, fontWeight: 700, background: scopeColor[r.scope], color: '#fff', padding: '2px 8px', borderRadius: 5 }}
                      >
                        {r.scope}
                      </span>
                    </div>
                    {sensitiveFields.map((field) => {
                      if (r.scope === '본인') {
                        return (
                          <div
                            key={field}
                            className="flex justify-center"
                            style={{ fontSize: 13, color: '#9490a0' }}
                            title="본인 외 열람 대상 없음 · 본인 데이터는 항상 열람"
                          >
                            —
                          </div>
                        );
                      }
                      const allowed = !!r.sensitive[field];
                      return (
                        <div key={field} className="flex justify-center">
                          <button
                            onClick={() => !isAdminRule && toggleVis(r.role, field)}
                            title={isAdminRule ? '관리자 고정' : allowed ? '차단으로 변경' : '허용으로 변경'}
                            style={{ cursor: isAdminRule ? 'default' : 'pointer' }}
                          >
                            {isAdminRule ? (
                              <Eye size={16} color="#0054ca" />
                            ) : allowed ? (
                              <Eye size={16} color="#0e9aa0" />
                            ) : (
                              <EyeOff size={16} color="#9490a0" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
