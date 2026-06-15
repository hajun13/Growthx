/**
 * admin-kpi-import feature — 데이터 계층(개인별 KPI 엑셀 일괄 임포트).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * ⚠ 미리보기(preview)는 multipart 파일 업로드 — orval 커스텀 mutator(customFetch)가
 * Content-Type 을 application/json 으로 고정해 멀티파트 boundary 를 깨뜨린다(생성 함수도
 * 파일 인자를 받지 않음). 따라서 미리보기는 admin-cycle YoY 임포트와 동일하게 `uploadExcel`
 * (멀티파트 전용 헬퍼 — 봉투 unwrap 포함)을 쓰되, 경로는 생성 클라이언트의 URL 헬퍼로
 * 단일화하고 응답 타입은 생성 DTO 로 고정한다. JSON 엔드포인트(commit·submit)는 생성 클라이언트.
 */
import {
  excelControllerCommitKpi,
  excelControllerSubmitImportedKpi,
  getExcelControllerPreviewKpiUrl,
  type KpiImportPreviewDto,
  type KpiImportCommitDto,
  type KpiImportResultDto,
  type KpiImportSubmitDto,
  type KpiImportSubmitResultDto,
} from '@growthx/contracts';
import { uploadExcel } from '@/lib/excel';
import type { KpiImportCommitRequest, KpiImportSubmitRequest } from '@/lib/types';

// 응답 타입은 생성 DTO 로 고정(SSOT). 요청 타입은 앱 도메인 형태(@/lib/types)를 그대로 쓰고
// 생성 DTO(enum 이 {[k]:unknown} 로 발행됨)로의 변환은 이 계층에서 한 번 캐스팅한다.
export type KpiImportPreview = KpiImportPreviewDto;
export type KpiImportResult = KpiImportResultDto;
export type KpiImportSubmitResult = KpiImportSubmitResultDto;
export type { KpiImportCommitRequest, KpiImportSubmitRequest } from '@/lib/types';

// 생성 클라이언트가 발행하는 경로(/api/v1 포함). uploadExcel 은 /api/v1 를 자체 prefix 하므로
// 여기선 prefix 를 제거한 경로만 넘긴다(중복 방지).
const PREVIEW_PATH = getExcelControllerPreviewKpiUrl().replace(/^\/api\/v1/, '');

/** 개인별 KPI 양식 미리보기(적재 안 함) — 멀티파트 파일 업로드. */
export async function previewKpi(file: File): Promise<KpiImportPreview> {
  return uploadExcel<KpiImportPreview>(PREVIEW_PATH, file);
}

/** 편집된 행을 commit(JSON)으로 적재(draft 생성). */
export async function commitKpi(
  body: KpiImportCommitRequest,
): Promise<KpiImportResult> {
  const res = await excelControllerCommitKpi(body as unknown as KpiImportCommitDto);
  // 봉투 unwrap — 성공 응답(200)은 { data: KpiImportResultDto }.
  return (res.data as { data: KpiImportResult }).data;
}

/** 적재된 draft KPI 제출(2단계). */
export async function submitImportedKpi(
  body: KpiImportSubmitRequest,
): Promise<KpiImportSubmitResult> {
  const res = await excelControllerSubmitImportedKpi(body as KpiImportSubmitDto);
  return (res.data as { data: KpiImportSubmitResult }).data;
}
