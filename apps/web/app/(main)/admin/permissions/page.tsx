'use client';

// 권한 관리 (hr_admin) — 디자인 PermMgmt.tsx 레이아웃을 실 API에 연동.
// 탭3: 사용자별 권한(실데이터 — GET /users, role 수정=PATCH /users/:id) /
//      권한 매트릭스(정적 안내) / 가시성 설정(정적 mock — 백엔드 없음).
// 디자인 PermLevel ↔ API Role 매핑:
//   전체관리자 → hr_admin / 그룹·본부관리자 → division_head / 팀관리자 → team_lead /
//   일반사용자 → employee. (그룹/본부 구분은 visibilityScope 로 표시.)
import { useMemo, useState } from 'react';
import {
  Search,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState } from '@/components/States';
import { isHrAdmin, NAV_ITEMS } from '@/lib/nav';
import {
  getMatrixConfig,
  setMatrixConfig as persistMatrixConfig,
  getNavConfig,
  setNavConfig as persistNavConfig,
  type FeatureKey,
} from '@/lib/permConfig';
import { flattenOrg, deptPath } from '@/lib/org';
import { positionLabel, SCOPE_LABEL } from '@/lib/ui';
import type { User, Role } from '@/lib/types';

/* ── 색상(디자인 inline 그대로) ── */
const T = {
  grey50: '#f9fafb',
  grey100: '#f2f4f6',
  grey200: '#e5e8eb',
  grey300: '#d1d6db',
  grey400: '#b0b8c1',
  grey500: '#8b95a1',
  grey600: '#6b7684',
  grey700: '#4e5968',
  grey800: '#333d4b',
  grey900: '#191f28',
  blue500: '#3182f6',
  green500: '#03b26c',
  orange500: '#f57800',
  red500: '#d22030',
};
const FONT = 'Pretendard, sans-serif';

// Role 칩 설정(디자인 permLevelCfg → 실제 4개 Role). 권한 라벨은 권한관리 전용 표기.
const roleCfg: Record<Role, { label: string; bg: string; color: string; desc: string }> = {
  hr_admin: { label: '전체관리자 (HR)', bg: T.grey900, color: '#fff', desc: '시스템 전체 + 권한 부여·수정' },
  division_head: { label: '그룹/본부관리자', bg: T.blue500, color: '#fff', desc: '소속 본부/그룹 열람·수정' },
  team_lead: { label: '팀관리자', bg: T.green500, color: '#fff', desc: '소속 팀 열람·수정' },
  employee: { label: '일반사용자', bg: T.grey700, color: '#fff', desc: '본인 데이터 열람·입력' },
};
const ROLE_ORDER: Role[] = ['hr_admin', 'division_head', 'team_lead', 'employee'];

// 권한 매트릭스(정적 안내 — Role 별 허용 기능).
const matrixCols: FeatureKey[] = [
  '평가결과 전체열람',
  'KPI 승인/반려',
  '등급풀 수정',
  '권한 부여·수정',
  '시스템 설정',
  '감사로그',
];
// 사이드바 메뉴 탭 헤더 라벨(Role 순서 = ROLE_ORDER).
const NAV_ROLE_LABELS: Record<Role, string> = {
  hr_admin: '전체관리자',
  division_head: '그룹/본부장',
  team_lead: '팀장',
  employee: '일반사용자',
};

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
  전체: T.grey900,
  그룹: '#9333EA',
  본부: T.blue500,
  팀: T.green500,
  본인: T.grey700,
};

interface PermRow {
  user: User;
  deptLabel: string;
  positionLabel: string;
}

export default function PermMgmtPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user && isHrAdmin(user.role);

  const [tab, setTab] = useState<'users' | 'matrix' | 'sidebar' | 'visibility'>('users');
  const [matrixConfig, setMatrixConfigState] = useState(() => getMatrixConfig());
  const [navVisibility, setNavVisibilityState] = useState(() => getNavConfig());
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<Role | '전체'>('전체');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [visRules, setVisRules] = useState(initialVisRules);
  const {
    data: usersData,
    loading,
    error,
    reload,
  } = useUsers({ pageSize: 500 }, { enabled: !!user });

  const { data: chart } = useOrgChart({ enabled: !!user });
  const flat = useMemo(() => flattenOrg(chart), [chart]);

  const rows = useMemo<PermRow[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => {
      const path = deptPath(u.departmentId, flat);
      return {
        user: u,
        deptLabel: path.join(' · ') || '소속 미지정',
        positionLabel: positionLabel[u.position] ?? u.position,
      };
    });
  }, [usersData, flat]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filterRole !== '전체' && r.user.role !== filterRole) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${r.user.name} ${r.deptLabel}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, filterRole, search],
  );

  async function updateRole(u: User, role: Role) {
    if (role === u.role) return;
    setSavingId(u.id);
    try {
      await userCommands.update(u.id, { role });
      toast.show({ variant: 'success', message: `${u.name}님의 권한을 변경했어요.` });
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

  function toggleMatrix(role: Role, feature: FeatureKey) {
    const next = {
      ...matrixConfig,
      [role]: { ...matrixConfig[role], [feature]: !matrixConfig[role][feature] },
    };
    setMatrixConfigState(next);
    persistMatrixConfig(next);
    toast.show({ variant: 'success', message: '권한이 변경됐어요.' });
  }

  function toggleNav(role: Role, key: string) {
    const next = {
      ...navVisibility,
      [role]: { ...navVisibility[role], [key]: !(navVisibility[role]?.[key] !== false) },
    };
    setNavVisibilityState(next);
    persistNavConfig(next);
    toast.show({ variant: 'success', message: '메뉴 가시성이 변경됐어요.' });
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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>권한 관리</h1>
        <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>
          조직·직급·직책 단위로 시스템 접근 권한과 데이터 가시성을 설정합니다.
        </p>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
        {/* 탭 */}
        <div className="flex" style={{ borderBottom: `1px solid ${T.grey200}` }}>
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 20px',
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 400,
                  color: active ? T.grey900 : T.grey600,
                  borderBottom: active ? `2px solid ${T.grey900}` : '2px solid transparent',
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
                style={{ border: `1px solid ${T.grey200}`, padding: '8px 12px', background: '#fff', minWidth: 200 }}
              >
                <Search size={13} color={T.grey500} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름·부서 검색"
                  className="outline-none"
                  style={{ fontSize: 12.5, background: 'transparent', color: T.grey900, border: 'none' }}
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['전체', ...ROLE_ORDER] as const).map((l) => {
                  const active = filterRole === l;
                  const cfg = l !== '전체' ? roleCfg[l] : null;
                  return (
                    <button
                      key={l}
                      onClick={() => setFilterRole(l as Role | '전체')}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11.5,
                        fontWeight: 500,
                        background: active ? (cfg ? cfg.bg : T.grey900) : '#fff',
                        color: active ? '#fff' : T.grey700,
                        border: `1px solid ${active ? (cfg ? cfg.bg : T.grey900) : T.grey200}`,
                      }}
                    >
                      {l === '전체' ? '전체' : roleCfg[l].label}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: T.grey500, marginLeft: 'auto' }}>
                {filtered.length}명
              </span>
            </div>

            <div style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 150px 90px',
                  padding: '10px 16px',
                  borderBottom: `1px solid ${T.grey200}`,
                  background: T.grey50,
                }}
              >
                {['이름/부서', '직위', '권한 레벨', '가시 범위'].map((h) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
                    {h}
                  </div>
                ))}
              </div>
              {loading && rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
                  불러오는 중…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: T.grey500, fontSize: 13 }}>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filtered.map((r) => {
                  const u = r.user;
                  const cfg = roleCfg[u.role];
                  const isSaving = savingId === u.id;
                  return (
                    <div
                      key={u.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 150px 90px',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: `1px solid ${T.grey200}`,
                        opacity: u.isActive ? 1 : 0.5,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: T.grey500 }}>{r.deptLabel}</div>
                      </div>
                      <div style={{ fontSize: 12, color: T.grey700 }}>{r.positionLabel}</div>
                      {/* 권한 레벨 — 인라인 select(색=권한색, 수정 버튼 없음) */}
                      <div>
                        <select
                          value={u.role}
                          disabled={isSaving}
                          onChange={(e) => void updateRole(u, e.target.value as Role)}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: cfg.bg,
                            color: cfg.color,
                            border: 'none',
                            padding: '3px 8px',
                            cursor: isSaving ? 'wait' : 'pointer',
                            outline: 'none',
                            maxWidth: '100%',
                          }}
                          title="권한 레벨을 클릭해 바로 변경"
                        >
                          {ROLE_ORDER.map((l) => (
                            <option key={l} value={l} style={{ background: '#fff', color: T.grey900 }}>
                              {roleCfg[l].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* 가시 범위(실데이터 — 읽기) */}
                      <div>
                        <span
                          style={{ fontSize: 11, fontWeight: 600, color: T.grey700, background: T.grey100, padding: '2px 8px' }}
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
            <div style={{ fontSize: 12, color: T.grey600 }}>
              권한 레벨별 허용 기능을 설정합니다. 셀을 클릭해 허용/차단을 전환하면 즉시 저장됩니다.
            </div>
            <div style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)`,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${T.grey200}`,
                  background: T.grey50,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>권한 레벨</div>
                {matrixCols.map((c) => (
                  <div key={c} style={{ fontSize: 11, fontWeight: 600, color: T.grey600, textAlign: 'center' }}>
                    {c}
                  </div>
                ))}
              </div>
              {ROLE_ORDER.map((role, li) => {
                const cfg = roleCfg[role];
                const perms = matrixConfig[role];
                return (
                  <div
                    key={role}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `200px repeat(${matrixCols.length}, 1fr)`,
                      alignItems: 'center',
                      padding: '10px 16px',
                      borderBottom: `1px solid ${T.grey200}`,
                      background: li === 0 ? T.grey50 : 'transparent',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, padding: '3px 10px' }}>
                        {cfg.label}
                      </span>
                      <div style={{ fontSize: 10.5, color: T.grey500, marginTop: 4 }}>{cfg.desc}</div>
                    </div>
                    {matrixCols.map((col) => (
                      <div key={col} className="flex justify-center">
                        <button
                          onClick={() => toggleMatrix(role, col)}
                          title={perms[col] ? '차단으로 변경' : '허용으로 변경'}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
                        >
                          {perms[col] ? (
                            <CheckCircle2 size={16} color={T.green500} />
                          ) : (
                            <div style={{ width: 16, height: 16, border: `1.5px solid ${T.grey300}` }} />
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
            <p style={{ fontSize: 12, color: T.grey600 }}>
              역할별로 사이드바에 표시할 메뉴를 설정합니다. 변경 즉시 저장됩니다.
            </p>
            <div style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
              {/* 헤더 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px repeat(4, 1fr)',
                  background: T.grey50,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${T.grey200}`,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>메뉴</div>
                {ROLE_ORDER.map((role) => (
                  <div
                    key={role}
                    style={{ fontSize: 11, fontWeight: 600, color: T.grey600, textAlign: 'center' }}
                  >
                    {NAV_ROLE_LABELS[role]}
                  </div>
                ))}
              </div>
              {/* 행 */}
              {NAV_ITEMS.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px repeat(4, 1fr)',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${T.grey100}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: T.grey900 }}>{item.label}</div>
                    {item.group && <div style={{ fontSize: 10.5, color: T.grey400 }}>{item.group}</div>}
                  </div>
                  {ROLE_ORDER.map((role) => {
                    // 시스템은 막지 않는다 — 모든 메뉴를 모든 역할에 대해 관리자가 자유롭게 토글.
                    const visible = navVisibility[role]?.[item.key] !== false;
                    return (
                      <div key={role} style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => toggleNav(role, item.key)}
                          title={visible ? '숨김으로 변경' : '표시로 변경'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 0,
                          }}
                        >
                          {visible ? (
                            <CheckCircle2 size={16} color={T.green500} />
                          ) : (
                            <div style={{ width: 16, height: 16, border: `1.5px solid ${T.grey300}` }} />
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
            {/* 범위 카드(가로 1줄) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {(['전체', '그룹', '본부', '팀', '본인'] as VisScope[]).map((s) => {
                const c = scopeColor[s];
                const desc: Record<VisScope, string> = {
                  전체: '인사총무팀·대표\n전 조직 열람',
                  그룹: '그룹 대표\n소속 그룹 전체',
                  본부: '본부장\n소속 본부만',
                  팀: '팀장\n소속 팀만',
                  본인: '팀원\n본인만',
                };
                return (
                  <div key={s} style={{ border: `1px solid ${T.grey200}`, borderTop: `3px solid ${c}` }}>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{s}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.grey600,
                          marginTop: 4,
                          lineHeight: 1.6,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {desc[s]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 경쟁 구조 안내(inline 배너) */}
            <div
              className="flex items-start gap-2"
              style={{ padding: '8px 12px', border: `1px solid ${T.grey200}`, borderLeft: `3px solid ${T.red500}`, background: '#fff' }}
            >
              <Lock size={13} color={T.red500} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: T.grey700, lineHeight: 1.6 }}>
                <strong style={{ color: T.red500 }}>경쟁 구조 보호</strong> — 본부끼리·팀끼리는 서로의 데이터를 열람할 수
                없습니다. 민감정보는 자기 범위 내에서만 공개됩니다.
              </span>
            </div>

            {/* 민감정보 매트릭스 */}
            <div style={{ border: `1px solid ${T.grey200}`, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.grey200}`, background: T.grey50 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}>민감정보 접근 권한</div>
                <div style={{ fontSize: 11.5, color: T.grey600, marginTop: 1 }}>
                  Eye 아이콘 클릭으로 접근 허용/차단을 수동으로 조정합니다. (정책 시안 — 저장 미연동)
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `220px 80px repeat(${sensitiveFields.length}, 1fr)`,
                  padding: '10px 16px',
                  borderBottom: `1px solid ${T.grey200}`,
                  background: T.grey50,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>직급/직책</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>범위</div>
                {sensitiveFields.map((f) => (
                  <div key={f} style={{ fontSize: 11, fontWeight: 600, color: T.grey600, textAlign: 'center' }}>
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
                      borderBottom: `1px solid ${T.grey200}`,
                      background: isAdminRule ? T.grey50 : 'transparent',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isAdminRule ? 700 : 500, color: T.grey900 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}>{r.note}</div>
                    </div>
                    <div>
                      <span
                        style={{ fontSize: 11, fontWeight: 700, background: scopeColor[r.scope], color: '#fff', padding: '2px 8px' }}
                      >
                        {r.scope}
                      </span>
                    </div>
                    {sensitiveFields.map((field) => {
                      const allowed = !!r.sensitive[field];
                      return (
                        <div key={field} className="flex justify-center">
                          <button
                            onClick={() => !isAdminRule && toggleVis(r.role, field)}
                            title={isAdminRule ? '관리자 고정' : allowed ? '차단으로 변경' : '허용으로 변경'}
                            style={{ cursor: isAdminRule ? 'default' : 'pointer' }}
                          >
                            {isAdminRule ? (
                              <Eye size={16} color={T.blue500} />
                            ) : allowed ? (
                              <Eye size={16} color={T.green500} />
                            ) : (
                              <EyeOff size={16} color={T.grey400} />
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
    </div>
  );
}
