'use client';

import {
  previewKpi,
  commitKpi,
  submitImportedKpi,
  type KpiImportPreview,
  type KpiImportResult,
  type KpiImportSubmitResult,
  type KpiImportCommitRequest,
  type KpiImportSubmitRequest,
} from './api';

/**
 * KPI 일괄 임포트 커맨드 훅 — 생성 클라이언트(@growthx/contracts) 기반.
 * 화면 상태(파일 목록·편집 그리드)는 View 가 보유하고, 여기선 순수 호출만 노출한다.
 */
export function useKpiImport() {
  return {
    preview: (file: File): Promise<KpiImportPreview> => previewKpi(file),
    commit: (body: KpiImportCommitRequest): Promise<KpiImportResult> =>
      commitKpi(body),
    submit: (
      body: KpiImportSubmitRequest,
    ): Promise<KpiImportSubmitResult> => submitImportedKpi(body),
  };
}
