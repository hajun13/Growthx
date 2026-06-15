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
  competencyControllerListCategories,
  competencyControllerCreateCategory,
  competencyControllerUpdateCategory,
  competencyControllerDeleteCategory,
  competencyControllerCopyFromCycle,
  type CompetencyQuestionDto,
  type CreateCompetencyQuestionDto,
  type UpdateCompetencyQuestionDto,
  type CompetencyCategoryDto,
  type CreateCompetencyCategoryDto,
  type UpdateCompetencyCategoryDto,
  type CopyFromCycleDto,
} from '@growthx/contracts';

export type CompetencyQuestion = CompetencyQuestionDto;
export type CompetencyQuestionInput = CreateCompetencyQuestionDto;
export type CompetencyQuestionPatch = UpdateCompetencyQuestionDto;
export type CompetencyCategory = CompetencyCategoryDto;

// ── 카테고리 ──

/** 카테고리 목록 */
export async function fetchCompetencyCategories(): Promise<CompetencyCategory[]> {
  const res = await competencyControllerListCategories();
  return res.data.data ?? [];
}

export async function createCompetencyCategory(body: CreateCompetencyCategoryDto): Promise<void> {
  await competencyControllerCreateCategory(body);
}

export async function updateCompetencyCategory(id: string, body: UpdateCompetencyCategoryDto): Promise<void> {
  await competencyControllerUpdateCategory(id, body);
}

export async function removeCompetencyCategory(id: string): Promise<void> {
  await competencyControllerDeleteCategory(id);
}

/** 이전 사이클에서 문항 복사 */
export async function copyQuestionsFromCycle(body: CopyFromCycleDto): Promise<void> {
  await competencyControllerCopyFromCycle(body);
}

// ── 문항 ──

/** 문항 목록 — cycleId 선택적, targetGroup 선택적 */
export async function fetchCompetencyQuestions(
  params: { cycleId?: string; targetGroup?: string } = {},
): Promise<CompetencyQuestion[]> {
  const res = await competencyControllerListQuestions(params);
  return res.data.data ?? [];
}

export async function createCompetencyQuestion(body: CompetencyQuestionInput): Promise<void> {
  await competencyControllerCreateQuestion(body);
}

export async function updateCompetencyQuestion(id: string, body: CompetencyQuestionPatch): Promise<void> {
  await competencyControllerUpdateQuestion(id, body);
}

export async function removeCompetencyQuestion(id: string): Promise<void> {
  await competencyControllerRemoveQuestion(id);
}
