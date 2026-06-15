/**
 * admin-cycle feature — 데이터 계층(평가 운영 주기 CRUD).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 도메인 타입(EvaluationCycle/CycleStatus)만 넘긴다 — 기존 cycleCommands 시그니처 보존.
 */
import {
  cyclesControllerList,
  cyclesControllerGet,
  cyclesControllerCreate,
  cyclesControllerUpdate,
  cyclesControllerUpdateStatus,
  cyclesControllerRemove,
} from '@growthx/contracts';
import type { EvaluationCycle, CycleStatus } from '@/lib/types';

// 생성 DTO 의 status/cycleType 은 orval 에서 loose({ [k]: unknown })로 나와
// 경계에서 도메인 타입(EvaluationCycle/CycleStatus)으로 좁힌다. 데이터 의미 불변.

// 계약상 cycles 목록 쿼리는 year 만 노출(status 필터 없음). 목록은 전역 CurrentCycleProvider 가
// 소비하므로 페이지는 이 함수를 직접 쓰지 않지만, 슬라이스 완결성을 위해 계약대로 노출한다.
export async function fetchCycles(params?: {
  year?: number;
}): Promise<EvaluationCycle[]> {
  const res = await cyclesControllerList(
    params?.year !== undefined ? { year: String(params.year) } : undefined,
  );
  return (res.data.data ?? []) as unknown as EvaluationCycle[];
}

export async function fetchCycle(id: string): Promise<EvaluationCycle> {
  const res = await cyclesControllerGet(id);
  return res.data.data as unknown as EvaluationCycle;
}

export async function createCycle(body: {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}): Promise<EvaluationCycle> {
  const res = await cyclesControllerCreate(body);
  // 생성 응답은 200/201 union(201 variant 의 data 는 void 로 타입화) — 런타임은 봉투 {data} 를
  // 반환하므로 봉투를 통해 unwrap 한다.
  return (res.data as { data: unknown }).data as EvaluationCycle;
}

export async function updateCycle(
  id: string,
  body: { name?: string; startDate?: string; endDate?: string; year?: number },
): Promise<EvaluationCycle> {
  const res = await cyclesControllerUpdate(id, body);
  return res.data.data as unknown as EvaluationCycle;
}

export async function updateCycleStatus(
  id: string,
  status: CycleStatus,
): Promise<EvaluationCycle> {
  const res = await cyclesControllerUpdateStatus(id, {
    status: status as unknown as Record<string, unknown>,
  });
  return res.data.data as unknown as EvaluationCycle;
}

export async function removeCycle(
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  const res = await cyclesControllerRemove(id);
  return res.data.data as unknown as { id: string; deleted: boolean };
}
