/**
 * admin-audit feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값({ data, meta })만 넘긴다.
 */
import {
  auditLogsControllerList,
  type AuditLogsControllerListParams,
} from '@growthx/contracts';
import type { AuditLog } from '@/lib/types';

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  data: AuditLog[];
  meta: { page: number; pageSize: number; total: number };
}

export async function fetchAuditLogs(
  filter: AuditLogFilter = {},
): Promise<AuditLogPage> {
  const params: AuditLogsControllerListParams = {
    actorId: filter.actorId,
    action: filter.action,
    entity: filter.entity,
    entityId: filter.entityId,
    from: filter.from,
    to: filter.to,
    page: filter.page !== undefined ? String(filter.page) : undefined,
    pageSize: filter.pageSize !== undefined ? String(filter.pageSize) : undefined,
  };
  const res = await auditLogsControllerList(params);
  const body = res.data;
  return {
    // contracts AuditLogDto.before/after 는 자유형태 JSON → 화면 AuditLog 와 호환되게 캐스팅.
    data: (body.data ?? []) as unknown as AuditLog[],
    meta: {
      page: body.meta?.page ?? filter.page ?? 1,
      pageSize: body.meta?.pageSize ?? filter.pageSize ?? 0,
      total: body.meta?.total ?? 0,
    },
  };
}
