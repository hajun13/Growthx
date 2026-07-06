'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@growthx/contracts';
import { fetchResultDetail } from './api';
import type { EvaluationResultDetail } from '@/lib/types';

export interface ResultDetailState {
  data: EvaluationResultDetail | null;
  loading: boolean;
  /** 생성 클라이언트가 throw 한 ApiError 를 그대로 보존 — View 가 404(미공개)/403(권한)을 구분. */
  error: ApiError | null;
  reload: () => void;
}

/**
 * 내 결과 상세 로드. 생성 클라이언트(@growthx/contracts) 기반.
 * useAsync 를 쓰지 않는 이유: useAsync 는 @/lib/api 의 ApiError 로만 instanceof 판별 후
 * 그 외는 NETWORK_ERROR(status 0)로 재포장 → contracts ApiError 의 404/403 상태가 소실된다.
 * 여기선 raw ApiError 를 그대로 보존해 결과 미공개(404) graceful degrade 를 유지한다.
 */
export function useMyResultDetail(
  userId: string | null,
  cycleId: string | null,
  options: { enabled?: boolean } = {},
): ResultDetailState {
  const enabled = (options.enabled ?? true) && !!userId && !!cycleId;
  const [data, setData] = useState<EvaluationResultDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !cycleId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // 파라미터(주기) 변경 시 이전 주기 데이터를 즉시 비운다 — 404(미공개) 주기에서
    // 이전 주기 등급이 새 주기 라벨 아래 표시되는 것을 방지. 늦게 도착한 이전 응답은
    // cancelled 가드가 차단한다.
    setData(null);
    fetchResultDetail(userId, cycleId)
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (cancelled || !mounted.current) return;
        setData(null);
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(0, {
                code: 'NETWORK_ERROR',
                message: '네트워크 오류가 발생했어요.',
              }),
        );
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, cycleId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}
