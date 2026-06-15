/**
 * kpi-review feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 생성 DTO(KpiDto/KpiReviewDto)는 enum 필드가 느슨한 타입({[key:string]:unknown})이라,
 * 도메인 헬퍼(kpiCategoryLabel·KpiGradingDisplay 등)와 호환되는 로컬 도메인 타입으로 캐스트해 반환한다.
 * (구조는 동일 — 필드명·nullable 일치, 캐스트는 enum 정밀도 회복용)
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

// ── 조회 ────────────────────────────────────────────────────────
export async function fetchKpis(params: {
  cycleId?: string;
  userId?: string;
}): Promise<Kpi[]> {
  const res = await kpisControllerList(params);
  return (res.data.data ?? []) as unknown as Kpi[];
}

export async function fetchKpiReviews(params: {
  cycleId?: string;
  userId?: string;
  kpiId?: string;
}): Promise<KpiReview[]> {
  const res = await kpisControllerListReviews(params);
  return (res.data.data ?? []) as unknown as KpiReview[];
}

export async function fetchKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerGet(id);
  return res.data.data as unknown as Kpi;
}

// ── 명령(쓰기) — 봉투 unwrap 후 도메인 값 반환 ───────────────────
export async function createKpi(body: CreateKpiRequest): Promise<Kpi> {
  const res = await kpisControllerCreate(body as never);
  return (res.data as { data: unknown }).data as Kpi;
}

export async function updateKpi(
  id: string,
  body: UpdateKpiRequest,
): Promise<Kpi> {
  const res = await kpisControllerUpdate(id, body as never);
  return res.data.data as unknown as Kpi;
}

export async function removeKpi(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await kpisControllerRemove(id);
  return res.data.data as unknown as { id: string; deleted: boolean };
}

export async function submitKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerSubmit(id);
  return (res.data as { data: unknown }).data as Kpi;
}

// 계약 §8 approve: { comment? } → 검토 의견을 Review(strength)로 영속화.
export async function approveKpi(id: string, comment?: string): Promise<Kpi> {
  const res = await kpisControllerApprove(id, comment ? { comment } : {});
  return (res.data as { data: unknown }).data as Kpi;
}

// 계약 §8 reject: { reason(필수), comment? } → reject reason + Review(improvement).
export async function rejectKpi(
  id: string,
  reason: string,
  comment?: string,
): Promise<Kpi> {
  const res = await kpisControllerReject(
    id,
    comment ? { reason, comment } : { reason },
  );
  return (res.data as { data: unknown }).data as Kpi;
}

export async function confirmKpi(id: string): Promise<Kpi> {
  const res = await kpisControllerConfirm(id);
  return (res.data as { data: unknown }).data as Kpi;
}

export async function linkKpi(id: string, parentKpiId: string): Promise<Kpi> {
  const res = await kpisControllerLink(id, { parentKpiId });
  return (res.data as { data: unknown }).data as Kpi;
}

/** 검토 화면에서 쓰는 명령 묶음 — 기존 kpiCommands 와 동일 시그니처(시각/동작 보존). */
export const kpiReviewCommands = {
  create: createKpi,
  update: updateKpi,
  remove: removeKpi,
  submit: submitKpi,
  approve: approveKpi,
  reject: rejectKpi,
  confirm: confirmKpi,
  link: linkKpi,
};
