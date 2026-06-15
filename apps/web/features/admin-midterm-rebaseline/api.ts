/**
 * admin-midterm-rebaseline feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  midtermControllerListRebaselineRequests,
  midtermControllerGetRebaselineRequest,
  midtermControllerCreateRebaselineRequest,
  midtermControllerUpdateRebaselineRequest,
  midtermControllerReviewRebaselineRequest,
  midtermControllerRebaselineHistory,
  type RebaselineRequestViewDto,
  type RebaselineRequestDetailDto,
  type RebaselineHistoryEntryDto,
  type MidtermControllerListRebaselineRequestsParams,
  type MidtermControllerRebaselineHistoryParams,
  type CreateRebaselineRequestDto,
  type UpdateRebaselineRequestDto,
  type ReviewRebaselineRequestDto,
} from '@growthx/contracts';

export type RebaselineRequestView = RebaselineRequestViewDto;
export type RebaselineRequestDetail = RebaselineRequestDetailDto;
export type RebaselineHistoryEntry = RebaselineHistoryEntryDto;

/** 재조정 요청 목록(주기·구성원 단위). meta(페이지 정보)도 함께 반환. */
export async function fetchRebaselineRequests(
  params: MidtermControllerListRebaselineRequestsParams,
): Promise<{ items: RebaselineRequestView[]; total: number }> {
  const res = await midtermControllerListRebaselineRequests(params);
  const body = res.data; // {data: [], meta}
  return { items: body.data ?? [], total: body.meta?.total ?? body.data?.length ?? 0 };
}

/** 단건 상세(currentKpis·proposedChanges·weightValid 포함). */
export async function fetchRebaselineRequest(
  id: string,
): Promise<RebaselineRequestDetail> {
  const res = await midtermControllerGetRebaselineRequest(id);
  return res.data.data;
}

/** 재조정 요청 생성. */
export async function createRebaselineRequest(
  dto: CreateRebaselineRequestDto,
): Promise<void> {
  await midtermControllerCreateRebaselineRequest(dto);
}

/** 재조정 요청 수정(제출 전 보완). */
export async function updateRebaselineRequest(
  id: string,
  dto: UpdateRebaselineRequestDto,
): Promise<void> {
  await midtermControllerUpdateRebaselineRequest(id, dto);
}

/** 부서장 검토(승인·반려). */
export async function reviewRebaselineRequest(
  id: string,
  dto: ReviewRebaselineRequestDto,
): Promise<void> {
  await midtermControllerReviewRebaselineRequest(id, dto);
}

/** 승인된 재조정 변경 이력(스냅샷 단위). */
export async function fetchRebaselineHistory(
  params: MidtermControllerRebaselineHistoryParams,
): Promise<RebaselineHistoryEntry[]> {
  const res = await midtermControllerRebaselineHistory(params);
  return res.data.data ?? [];
}
