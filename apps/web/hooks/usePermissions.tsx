'use client';

// 권한 설정(매트릭스 + 사이드바 nav 가시성)을 서버에서 1회 패치해 전역 공유.
//   GET /permissions/config → { matrix, navVisibility } (인증된 모든 사용자)
// 로딩/실패/SSR(비인증) 시 DEFAULT_* 로 폴백한다(무회귀). 강제 의미론은 restrict-only —
// hasFeature 는 매트릭스가 명시적으로 false 일 때만 차단하고, 그 외(기본/누락)는 허용한다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_MATRIX,
  DEFAULT_NAV_VISIBILITY,
  fetchPermissionsConfig,
  levelOf,
  type FeatureKey,
  type MatrixConfig,
  type NavConfig,
  type PermLevel,
} from '@/lib/permConfig';
import type { Role, VisibilityScope } from '@/lib/types';

export interface PermissionsValue {
  matrix: MatrixConfig;
  navVisibility: NavConfig;
  loading: boolean;
  // 서버 설정을 다시 패치(권한 관리 화면에서 저장 후 호출).
  reload: () => void;
  // 권한 관리 화면이 PUT 성공 후 즉시 전역 캐시를 갱신할 때 사용.
  setLocal: (matrix: MatrixConfig, navVisibility: NavConfig) => void;
  // 현재 로그인 사용자 레벨 기준 — 기능 허용 여부(restrict-only: false 일 때만 차단).
  hasFeature: (key: FeatureKey) => boolean;
  // 임의 (role, scope) 레벨의 기능 허용 여부.
  levelHasFeature: (level: PermLevel, key: FeatureKey) => boolean;
  // 현재 사용자 레벨 기준 — 사이드바 메뉴 노출 여부.
  isNavVisible: (navKey: string) => boolean;
}

const defaultState = {
  matrix: DEFAULT_MATRIX,
  navVisibility: DEFAULT_NAV_VISIBILITY,
  loading: true,
};

const PermissionsContext = createContext<{
  matrix: MatrixConfig;
  navVisibility: NavConfig;
  loading: boolean;
  reload: () => void;
  setLocal: (matrix: MatrixConfig, navVisibility: NavConfig) => void;
} | null>(null);

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<MatrixConfig>(DEFAULT_MATRIX);
  const [navVisibility, setNav] = useState<NavConfig>(DEFAULT_NAV_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 인증된 사용자에 한해 1회(+reload) 패치. 비인증/실패 시 DEFAULT_* 유지.
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPermissionsConfig()
      .then((cfg) => {
        if (cancelled || !mounted.current) return;
        setMatrix(cfg.matrix);
        setNav(cfg.navVisibility);
      })
      .catch(() => {
        // 실패 시 폴백 유지(무회귀) — 콘솔만.
        if (cancelled || !mounted.current) return;
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setLocal = useCallback(
    (m: MatrixConfig, n: NavConfig) => {
      setMatrix(m);
      setNav(n);
    },
    [],
  );

  const value = useMemo(
    () => ({ matrix, navVisibility, loading, reload, setLocal }),
    [matrix, navVisibility, loading, reload, setLocal],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

// restrict-only — 매트릭스가 명시적으로 false 일 때만 차단(그 외 허용).
// 단, 권한 데이터가 아직 결정 불가한 상태(매트릭스 로딩 중 / role·scope 미확정)에서는
// fail-closed 로 false 를 반환한다 — 로딩~응답 사이에 쓰기 버튼이 잠깐 열리는 것을 막는다.
function computeHasFeature(
  matrix: MatrixConfig,
  role: Role | undefined,
  scope: VisibilityScope | undefined,
  loading: boolean,
  key: FeatureKey,
): boolean {
  if (loading) return false; // 매트릭스 fetch 미완료 — 결정 불가 → 거부.
  if (!role || !scope) return false; // role/scope 미확정 → 거부.
  const level = levelOf(role, scope);
  return matrix[level]?.[key] !== false;
}

export function usePermissions(): PermissionsValue {
  const ctx = useContext(PermissionsContext);
  const { user } = useAuth();

  // Provider 밖(예: 인증 셸 외부)에서도 안전하게 동작 — DEFAULT_* 폴백.
  const matrix = ctx?.matrix ?? defaultState.matrix;
  const navVisibility = ctx?.navVisibility ?? defaultState.navVisibility;
  const loading = ctx?.loading ?? defaultState.loading;

  const hasFeature = useCallback(
    (key: FeatureKey) =>
      computeHasFeature(matrix, user?.role, user?.visibilityScope, loading, key),
    [matrix, user?.role, user?.visibilityScope, loading],
  );

  const levelHasFeature = useCallback(
    (level: PermLevel, key: FeatureKey) => matrix[level]?.[key] !== false,
    [matrix],
  );

  const isNavVisible = useCallback(
    (navKey: string) => {
      if (!user) return true;
      const level = levelOf(user.role, user.visibilityScope);
      return navVisibility[level]?.[navKey] !== false;
    },
    [navVisibility, user],
  );

  return {
    matrix,
    navVisibility,
    loading,
    reload: ctx?.reload ?? (() => undefined),
    setLocal: ctx?.setLocal ?? (() => undefined),
    hasFeature,
    levelHasFeature,
    isNavVisible,
  };
}
