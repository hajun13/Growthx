/**
 * admin-competency-items feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  competencyControllerListQuestions,
  competencyControllerCreateQuestion,
  competencyControllerUpdateQuestion,
  competencyControllerRemoveQuestion,
  type CompetencyQuestionDto,
  type CreateCompetencyQuestionDto,
  type UpdateCompetencyQuestionDto,
} from '@growthx/contracts';

export type CompetencyQuestion = CompetencyQuestionDto;
export type CompetencyQuestionInput = CreateCompetencyQuestionDto;
export type CompetencyQuestionPatch = UpdateCompetencyQuestionDto;

/** 문항 목록 — order 오름차순(백엔드). */
export async function fetchCompetencyQuestions(
  cycleId: string,
): Promise<CompetencyQuestion[]> {
  const res = await competencyControllerListQuestions({ cycleId });
  return res.data.data ?? [];
}

// create/update 결과값은 화면에서 쓰지 않고(저장 후 reload), 생성 클라이언트의 201 응답 타입이
// data: void 라 단건 unwrap이 불가 → void 로 두어 호출부와 정합.
export async function createCompetencyQuestion(
  body: CompetencyQuestionInput,
): Promise<void> {
  await competencyControllerCreateQuestion(body);
}

export async function updateCompetencyQuestion(
  id: string,
  body: CompetencyQuestionPatch,
): Promise<void> {
  await competencyControllerUpdateQuestion(id, body);
}

export async function removeCompetencyQuestion(id: string): Promise<void> {
  await competencyControllerRemoveQuestion(id);
}
