/**
 * competency-eval feature — 데이터 계층(역량평가 문항·응답).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 역량평가는 참고용(연봉·등급 미반영). 본 화면은 문항 조회 + 본인 응답 조회/일괄 저장·제출만 사용.
 */
import {
  competencyControllerListQuestions,
  competencyControllerListResponses,
  competencyControllerBulkRespond,
  type CompetencyQuestionDto,
  type CompetencyResponseDto,
  type CompetencyResponseItemDto,
  type CompetencyControllerListQuestionsTargetGroup,
} from '@growthx/contracts';

export type CompetencyQuestion = CompetencyQuestionDto;
export type CompetencyResponse = CompetencyResponseDto;
export type CompetencyResponseItem = CompetencyResponseItemDto;

/** 주기별 역량평가 문항 목록(order 오름차순, 백엔드 정렬). targetGroup 필터 지원. */
export async function fetchCompetencyQuestions(
  cycleId: string,
  targetGroup?: string,
): Promise<CompetencyQuestion[]> {
  const res = await competencyControllerListQuestions({
    cycleId,
    targetGroup: targetGroup as
      | CompetencyControllerListQuestionsTargetGroup
      | undefined,
  });
  return res.data.data ?? [];
}

/** 본인(또는 대상자) 응답 목록 — 점수 드래프트 초기값 바인딩용. */
export async function fetchCompetencyResponses(params: {
  cycleId: string;
  userId?: string;
}): Promise<CompetencyResponse[]> {
  const res = await competencyControllerListResponses(params);
  return res.data.data ?? [];
}

/** 임시 저장 — submit=false, submittedAt 미기록. */
export async function bulkSaveCompetencyResponses(
  cycleId: string,
  responses: CompetencyResponseItem[],
): Promise<CompetencyResponse[]> {
  const res = await competencyControllerBulkRespond({ cycleId, submit: false, responses });
  const envelope = res.data;
  return envelope ? envelope.data ?? [] : [];
}

/** 최종 제출 — submit=true, submittedAt 기록. */
export async function bulkSubmitCompetencyResponses(
  cycleId: string,
  responses: CompetencyResponseItem[],
): Promise<CompetencyResponse[]> {
  const res = await competencyControllerBulkRespond({ cycleId, submit: true, responses });
  const envelope = res.data;
  return envelope ? envelope.data ?? [] : [];
}
