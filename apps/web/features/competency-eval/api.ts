/**
 * competency-eval feature — 데이터 계층(역량평가서 시트·응답·종합의견).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 역량평가는 참고용(연봉·등급 미반영). 본인(self) + 1차/2차/최종 평가자(round1~3)가
 * 같은 시트에 열 단위로 응답한다(엑셀 역량평가서 재현).
 */
import {
  competencyControllerListQuestions,
  competencyControllerListResponses,
  competencyControllerBulkRespond,
  competencyControllerGetSheet,
  competencyControllerListTargets,
  competencyControllerSaveOpinion,
  type CompetencyQuestionDto,
  type CompetencyResponseDto,
  type CompetencyResponseItemDto,
  type CompetencySheetDto,
  type CompetencyTargetDto,
  type CompetencyOpinionDto,
  type CompetencyControllerListQuestionsTargetGroup,
} from '@growthx/contracts';

export type CompetencyQuestion = CompetencyQuestionDto;
export type CompetencyResponse = CompetencyResponseDto;
export type CompetencySheet = CompetencySheetDto;
export type CompetencyTarget = CompetencyTargetDto;
export type CompetencyOpinion = CompetencyOpinionDto;
export type CompetencyStage = 'self' | 'round1' | 'round2' | 'round3';
/**
 * 저장 페이로드 항목 — 백엔드가 grade 미지정(코멘트 단독 저장)을 허용하므로
 * grade 를 선택 필드로 로컬 확장(생성 계약 재생성 전까지의 브리지).
 */
export type CompetencyResponseItem = Omit<CompetencyResponseItemDto, 'grade'> & {
  grade?: CompetencyResponseItemDto['grade'];
};

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

/** 임시 저장 — submit=false, submittedAt 미기록. targetUserId 지정=평가자 열 작성. */
export async function bulkSaveCompetencyResponses(
  cycleId: string,
  responses: CompetencyResponseItem[],
  targetUserId?: string,
): Promise<CompetencyResponse[]> {
  const res = await competencyControllerBulkRespond({
    cycleId,
    targetUserId,
    submit: false,
    responses: responses as CompetencyResponseItemDto[],
  });
  const envelope = res.data;
  return envelope ? envelope.data ?? [] : [];
}

/** 최종 제출 — submit=true, submittedAt 기록. targetUserId 지정=평가자 열 작성. */
export async function bulkSubmitCompetencyResponses(
  cycleId: string,
  responses: CompetencyResponseItem[],
  targetUserId?: string,
): Promise<CompetencyResponse[]> {
  const res = await competencyControllerBulkRespond({
    cycleId,
    targetUserId,
    submit: true,
    responses: responses as CompetencyResponseItemDto[],
  });
  const envelope = res.data;
  return envelope ? envelope.data ?? [] : [];
}

/** 역량평가서(시트) — 문항+전 단계 응답+종합의견+평가선+환산 점수 일체. */
export async function fetchCompetencySheet(params: {
  cycleId: string;
  userId?: string;
}): Promise<CompetencySheet | null> {
  const res = await competencyControllerGetSheet(params);
  return res.data.data ?? null;
}

/** 내가 평가자로 배정된 역량평가 대상 목록(하향 평가 배정과 동일 평가선). */
export async function fetchCompetencyTargets(cycleId: string): Promise<CompetencyTarget[]> {
  const res = await competencyControllerListTargets({ cycleId });
  return res.data.data ?? [];
}

/** 종합의견 저장(1차/2차/최종 평가자 전용). 빈 문자열 = 삭제. */
export async function saveCompetencyOpinion(body: {
  cycleId: string;
  userId: string;
  comment: string;
}): Promise<CompetencyOpinion | null> {
  const res = await competencyControllerSaveOpinion(body);
  return res.data.data ?? null;
}
