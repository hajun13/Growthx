/**
 * eval-dept-head feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 도메인 값(@/lib/types)만 넘긴다. 생성 DTO 는 도메인 타입과 구조적으로 동일하므로
 * unwrap 경계에서 한 번만 도메인 타입으로 좁힌다(데이터 의미 불변).
 *
 * 주의: request-revision/reject/history 는 contracts codegen 미발행 엔드포인트.
 * 과도기 규율에 따라 customFetch 로 직접 호출하고 봉투를 unwrap 한다.
 */
import {
  evaluationsControllerList,
  evaluationsControllerGet,
  evaluationsControllerListEvidence,
  evaluationsControllerCreate,
  evaluationsControllerPatch,
  evaluationsControllerComment,
  evaluationsControllerSubmit,
  evaluationsControllerFinalize,
  type PatchEvaluationDto,
} from '@growthx/contracts';
import { apiPost, apiGetList } from '@/lib/api';
import type {
  Evaluation,
  EvaluationDetail,
  EvaluationEvidence,
  EvaluationReviewHistory,
  Comment,
  EvalType,
  EvalStatus,
} from '@/lib/types';

export interface ListEvaluationsParams {
  cycleId?: string;
  evaluatorId?: string;
  evaluateeId?: string;
  /** 생성 클라이언트는 type/status 필터를 받지 않으므로 클라이언트 측에서 거른다. */
  type?: EvalType;
  status?: EvalStatus;
}

/** 평가 목록 — 생성 클라이언트가 지원하지 않는 type/status 는 클라이언트에서 후필터. */
export async function fetchEvaluations(
  params: ListEvaluationsParams,
): Promise<Evaluation[]> {
  const res = await evaluationsControllerList({
    cycleId: params.cycleId,
    evaluatorId: params.evaluatorId,
    evaluateeId: params.evaluateeId,
  });
  let rows = (res.data.data ?? []) as unknown as Evaluation[];
  if (params.type) rows = rows.filter((r) => r.type === params.type);
  if (params.status) rows = rows.filter((r) => r.status === params.status);
  return rows;
}

/** 평가 상세(kpiScores + comments 포함). */
export async function fetchEvaluationDetail(
  id: string,
): Promise<EvaluationDetail> {
  const res = await evaluationsControllerGet(id);
  return res.data.data as unknown as EvaluationDetail;
}

/**
 * 평가의 증빙 메타데이터 전체. 본인평가 화면에서 kpiId별로 묶어 표시.
 * 백엔드 GET :id/evidence 의 kpiId 는 optional(미전달 시 전체 반환)이지만
 * 생성 타입은 required 로 추론됐다 → undefined 전달 시 URL 빌더가 쿼리를 생략하므로
 * 원래 동작(전체 조회)을 그대로 보존한다. (regen 금지 범위라 캐스트로 우회.)
 */
export async function fetchEvaluationEvidence(
  id: string,
): Promise<EvaluationEvidence[]> {
  const res = await evaluationsControllerListEvidence(id, {
    kpiId: undefined,
  } as never);
  return (res.data.data ?? []) as unknown as EvaluationEvidence[];
}

export const deptHeadCommands = {
  // downward 는 round 필수(1·2차=가까운 상급 장 순, 3=최종 그룹장).
  create: async (body: {
    cycleId: string;
    evaluateeId: string;
    type: EvalType;
    round?: number;
  }): Promise<void> => {
    await evaluationsControllerCreate(body as never);
  },
  patch: async (
    id: string,
    body: PatchEvaluationDto,
  ): Promise<EvaluationDetail> => {
    const res = await evaluationsControllerPatch(id, body);
    return res.data.data as unknown as EvaluationDetail;
  },
  addComment: async (
    id: string,
    body: { quarter: number; content: string },
  ): Promise<Comment> => {
    const res = await evaluationsControllerComment(id, body);
    return res.data?.data as unknown as Comment;
  },
  submit: async (id: string): Promise<void> => {
    await evaluationsControllerSubmit(id);
  },
  finalize: async (id: string): Promise<void> => {
    await evaluationsControllerFinalize(id);
  },
  // ── 반려·수정요청 (codegen 미발행 → lib/api.ts 패턴) ──
  requestRevision: async (
    id: string,
    body: { reason: string },
  ): Promise<Evaluation> =>
    apiPost<Evaluation>(`/evaluations/${id}/request-revision`, body),
  reject: async (
    id: string,
    body: { reason: string },
  ): Promise<Evaluation> =>
    apiPost<Evaluation>(`/evaluations/${id}/reject`, body),
};

/**
 * 평가 검토 이력 목록 — GET /evaluations/:id/history.
 * 응답 봉투: { data: EvaluationReviewHistory[], meta }
 */
export async function fetchEvaluationHistory(
  id: string,
): Promise<EvaluationReviewHistory[]> {
  const { data } = await apiGetList<EvaluationReviewHistory>(
    `/evaluations/${id}/history`,
  );
  return data;
}
