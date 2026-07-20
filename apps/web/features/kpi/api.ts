/**
 * kpi feature — 데이터 계층(KPI 작성).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 생성 DTO 는 일부 JSON 필드(gradingCriteria·grading)를 loose 한 타입으로 내보내므로,
 * 화면·헬퍼 컴포넌트가 쓰는 정밀 lib/types 도메인 타입으로 한 번 좁혀서 넘긴다
 * (런타임 JSON 동일 — 정적 타입만 정밀화, 동작 보존).
 */
import {
  kpisControllerList,
  kpisControllerListReviews,
  kpisControllerGet,
  kpisControllerCreate,
  kpisControllerUpdate,
  kpisControllerRemove,
  kpisControllerSubmit,
  kpisControllerApprove,
  kpisControllerReject,
  kpisControllerConfirm,
  kpisControllerLink,
} from '@growthx/contracts';
import type {
  Kpi,
  KpiReview,
  CreateKpiRequest,
  UpdateKpiRequest,
} from '@/lib/types';

// ── 조회 ─────────────────────────────────────────────────────────

/** KPI 목록(현재 주기·대상 사용자). list params 는 cycleId·userId 만 지원. */
export async function fetchKpis(
  cycleId: string,
  userId: string,
): Promise<Kpi[]> {
  const res = await kpisControllerList({ cycleId, userId });
  return (res.data.data ?? []) as unknown as Kpi[];
}

/** 특정 상태의 KPI 목록 — 제출 시 draft 재조회처럼 클라이언트에서 status 필터. */
export async function fetchKpisByStatus(
  cycleId: string,
  userId: string,
  status: Kpi['status'],
): Promise<Kpi[]> {
  const list = await fetchKpis(cycleId, userId);
  return list.filter((k) => k.status === status);
}

/** KPI 검토 의견 이력(cycleId·userId 또는 kpiId 단위, 최신순). */
export async function fetchKpiReviews(params: {
  cycleId?: string;
  userId?: string;
  kpiId?: string;
}): Promise<KpiReview[]> {
  const res = await kpisControllerListReviews(params);
  return (res.data.data ?? []) as unknown as KpiReview[];
}

/** 단건 KPI. */
export async function fetchKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerGet(id);
  return res.data.data as unknown as Kpi;
}

// ── 명령(쓰기) — 생성 클라이언트 호출 후 봉투 unwrap ───────────────
// POST 엔드포인트의 생성 응답 타입은 union(200 {data} | 201 void)이라 res.data 가 void 를 포함한다.
// 런타임은 항상 {data} 봉투를 반환하므로 unknown 경유로 좁힌다(동작 보존).
function unwrapData<T>(envelope: unknown): T {
  return (envelope as { data: T }).data;
}

// `as never` 는 앱 타입이 틀려서가 아니라 코드젠 결함을 우회하는 것이다:
// orval 이 category enum 을 추론하지 못해 CreateKpiDtoCategory 를
// `{ [key: string]: unknown }` 으로 생성한다(어떤 문자열도 만족 불가).
// 근본 해결은 apps/api 의 KPI DTO 에 @ApiProperty({ enum: ... }) 를 달고
// 계약을 재생성하는 것. 그전까지는 lib/types.ts 의 CreateKpiRequest/
// UpdateKpiRequest 가 유일한 타입 방어선이므로 그쪽을 정확히 유지해야 한다.
export async function createKpi(body: CreateKpiRequest): Promise<Kpi> {
  const res = await kpisControllerCreate(body as never);
  return unwrapData<Kpi>(res.data);
}

export async function updateKpi(
  id: string,
  body: UpdateKpiRequest,
): Promise<Kpi> {
  const res = await kpisControllerUpdate(id, body as never);
  return unwrapData<Kpi>(res.data);
}

export async function removeKpi(
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  const res = await kpisControllerRemove(id);
  return unwrapData<{ id: string; deleted: boolean }>(res.data);
}

export async function submitKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerSubmit(id);
  return unwrapData<Kpi>(res.data);
}

export async function approveKpi(id: string, comment?: string): Promise<Kpi> {
  const res = await kpisControllerApprove(
    id,
    (comment ? { comment } : {}) as never,
  );
  return unwrapData<Kpi>(res.data);
}

export async function rejectKpi(
  id: string,
  reason: string,
  comment?: string,
): Promise<Kpi> {
  const res = await kpisControllerReject(
    id,
    (comment ? { reason, comment } : { reason }) as never,
  );
  return unwrapData<Kpi>(res.data);
}

export async function confirmKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerConfirm(id);
  return unwrapData<Kpi>(res.data);
}

export async function linkKpi(id: string, parentKpiId: string): Promise<Kpi> {
  const res = await kpisControllerLink(id, { parentKpiId } as never);
  return unwrapData<Kpi>(res.data);
}

/** 기존 page 로직이 쓰던 kpiCommands 와 동일한 형태의 커맨드 묶음(생성 클라이언트 기반). */
export const kpiCommands = {
  create: createKpi,
  update: updateKpi,
  remove: removeKpi,
  submit: submitKpi,
  approve: approveKpi,
  reject: rejectKpi,
  confirm: confirmKpi,
  link: linkKpi,
};
