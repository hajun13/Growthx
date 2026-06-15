'use client';

/**
 * admin-cycle feature — 커맨드 훅(평가 운영 주기 CRUD).
 * 생성 클라이언트(@growthx/contracts) 기반 api.ts 를 감싼다. 기존 cycleCommands 시그니처 보존 —
 * View 는 데이터 소스만 이 모듈로 바꾸고 동작/RBAC/라우트는 그대로 유지한다.
 *
 * 비고: 주기 목록(list)은 (main) 레이아웃에 마운트된 CurrentCycleProvider(useCycles)가
 * 전역 공유하므로 페이지는 그 컨텍스트를 그대로 소비한다. 여기서는 변이 커맨드만 노출한다.
 */
import type { CycleStatus } from '@/lib/types';
import { createCycle, updateCycle, updateCycleStatus, removeCycle } from './api';

export const cycleCommands = {
  create: (body: {
    name: string;
    year: number;
    startDate: string;
    endDate: string;
    hireCutoffDate?: string | null;
  }) => createCycle(body),
  update: (
    id: string,
    body: { name?: string; startDate?: string; endDate?: string; year?: number; hireCutoffDate?: string | null },
  ) => updateCycle(id, body),
  updateStatus: (id: string, status: CycleStatus) =>
    updateCycleStatus(id, status),
  // 주기 삭제. 완료(closed) 주기는 백엔드가 거부.
  remove: (id: string) => removeCycle(id),
};
