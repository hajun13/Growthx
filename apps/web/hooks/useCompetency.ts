'use client';

// M3 Item 6: 역량 평가 문항 관리(관리자 CRUD) + 응답(임직원 일괄 제출).
// API(requirements-m3.md):
//   GET/POST /competency-questions, PATCH/DELETE /competency-questions/:id
//   GET /competency-responses?cycleId=&userId=, POST /competency-responses/bulk
// 연봉 미반영(참고 데이터) — 화면에 명시 배너.

import {
  apiGetList,
  apiPost,
  apiPatch,
  apiDelete,
} from '@/lib/api';
import type {
  CompetencyQuestion,
  CompetencyQuestionInput,
  CompetencyQuestionPatch,
  CompetencyResponse,
  CompetencyResponseInput,
  Grade,
} from '@/lib/types';
import { useAsync } from './useAsync';

// 질문 목록(관리자 CRUD·임직원 응답 공용). order 오름차순(백엔드).
export function useCompetencyQuestions(
  cycleId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<CompetencyQuestion>('/competency-questions', {
        cycleId: cycleId ?? undefined,
      }),
    [cycleId],
    { enabled: !!cycleId && (options.enabled ?? true) },
  );
}

// 본인(또는 대상자) 응답 목록 — 라디오 초기값 바인딩용.
export function useCompetencyResponses(
  params: { cycleId?: string; userId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  return useAsync(
    () =>
      apiGetList<CompetencyResponse>('/competency-responses', {
        cycleId: params.cycleId,
        userId: params.userId,
      }),
    [params.cycleId, params.userId],
    {
      enabled:
        !!params.cycleId && !!params.userId && (options.enabled ?? true),
    },
  );
}

export const competencyQuestionCommands = {
  create: (body: CompetencyQuestionInput) =>
    apiPost<CompetencyQuestion>('/competency-questions', body),
  update: (id: string, body: CompetencyQuestionPatch) =>
    apiPatch<CompetencyQuestion>(`/competency-questions/${id}`, body),
  remove: (id: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/competency-questions/${id}`),
};

export const competencyResponseCommands = {
  // 임시 저장 — submit=false, submittedAt 미기록.
  bulkSave: (cycleId: string, responses: CompetencyResponseInput[]) =>
    apiPost<CompetencyResponse[]>('/competency-responses/bulk', {
      cycleId,
      responses,
      submit: false,
    }),
  // 최종 제출 — submit=true, submittedAt 기록.
  bulkSubmit: (cycleId: string, responses: CompetencyResponseInput[]) =>
    apiPost<CompetencyResponse[]>('/competency-responses/bulk', {
      cycleId,
      responses,
      submit: true,
    }),
};

// 점수(1~5) ↔ 등급(D~S) 매핑.
// 역량평가 UI 는 1~5 점 버튼을 쓰지만 백엔드는 Grade enum(S/A/B/C/D) 으로 저장한다.
export const scoreToGrade = (score: number): Grade => {
  const map: Record<number, Grade> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
  return map[score] ?? 'B';
};
export const gradeToScore = (grade: string): number => {
  const map: Record<string, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
  return map[grade] ?? 0;
};
