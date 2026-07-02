/**
 * appeals feature — 데이터 계층.
 * 백엔드 Phase 3B-3 이후 확장 필드 반영:
 *   - Appeal: decisionType, newScore, newGrade, reviewStartedAt, respondedAt, decidedAt
 *   - AppealAttachment: 첨부파일
 *   - decide(): 5지 결정 타입 (uphold/score_adjust/grade_adjust/reevaluate/reject)
 *
 * @growthx/contracts 생성 클라이언트가 아직 새 필드를 포함하지 않으므로
 * 과도기 수동 래퍼(lib/api.ts)로 호출한다. 봉투 unwrap은 apiGet/apiGetList/apiPost 내부에서 처리.
 */
import { apiGet, apiGetList, apiPost, apiDelete, apiUpload, apiDownloadBlob } from '@/lib/api';
import type { Grade } from '@/lib/types';

// ── 타입 ────────────────────────────────────────────────────────────────────

export type AppealStatus = 'submitted' | 'under_review' | 'answered' | 'closed';

/** 5지 결정 타입 (백엔드 AppealDecisionType enum) */
export type AppealDecisionType =
  | 'uphold'
  | 'score_adjust'
  | 'grade_adjust'
  | 'reevaluate'
  | 'reject';

/** 백엔드 AppealDto — Phase 3B-3 확장 포함 */
export interface Appeal {
  id: string;
  resultId: string;
  userId: string;
  reason: string;
  status: AppealStatus;
  /** 부서장 1차 답변 (미답변 시 null) */
  response: string | null;
  respondedById: string | null;
  /** HR 최종 결정 사유 (미결정 시 null) */
  decision: string | null;
  decidedById: string | null;
  /** 5지 결정 타입 (Phase 3B-3, 미결정 시 null) */
  decisionType: AppealDecisionType | null;
  /** 점수 수정 시 새 점수 */
  newScore: number | null;
  /** 등급 수정 시 새 등급 */
  newGrade: Grade | null;
  /** 비정규화 — 신청자 이름 */
  userName: string | null;
  /** 비정규화 — 신청자 소속 부서명 */
  departmentName: string | null;
  /**
   * 비정규화 — 신청자 프로필 사진 URL.
   * 백엔드 AppealDto에 아직 없는 필드(optional로 방어) — 백엔드 enrich()가
   * user.avatarUrl을 포함하도록 확장되면 자동으로 채워짐. 없으면 이니셜로 폴백.
   */
  avatarUrl?: string | null;
  /** 비정규화 — 부서장 답변자/HR 결정자 실명(백엔드 enrich 확장 반영, optional 방어). */
  respondedByName?: string | null;
  decidedByName?: string | null;
  /** 비정규화 — 신청자 부서 ID·직급 코드(조직 필터용, optional). */
  departmentId?: string | null;
  position?: string | null;
  /** 접수 타임스탬프 */
  createdAt: string;
  updatedAt: string;
  /** 검토 시작 타임스탬프 (under_review 진입 시) */
  reviewStartedAt: string | null;
  /** 부서장 답변 완료 타임스탬프 */
  respondedAt: string | null;
  /** HR 최종결정 타임스탬프 */
  decidedAt: string | null;
}

/** 첨부파일 DTO */
export interface AppealAttachment {
  id: string;
  appealId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
}

/** HR 최종결정 요청 body */
export interface DecideAppealBody {
  decisionType: AppealDecisionType;
  reason: string;
  newScore?: number;
  newGrade?: Grade;
}

// ── API 함수 ──────────────────────────────────────────────────────────────────

/** 이의제기 목록 (권한 범위 전체 또는 userId 필터) */
export async function fetchAppeals(userId?: string): Promise<Appeal[]> {
  const result = await apiGetList<Appeal>('/appeals', userId ? { userId } : undefined);
  return result.data;
}

/** 단건 이의제기 조회 */
export async function fetchAppeal(id: string): Promise<Appeal> {
  return apiGet<Appeal>(`/appeals/${id}`);
}

/** 이의제기 신청 (결과 통보 후 7일 이내만 접수) */
export async function createAppeal(body: {
  resultId: string;
  reason: string;
}): Promise<void> {
  await apiPost<Appeal>('/appeals', body);
}

/** 부서장 1차 답변 */
export async function respondAppeal(id: string, response: string): Promise<void> {
  await apiPost<Appeal>(`/appeals/${id}/respond`, { response });
}

/**
 * HR 최종결정 — 5지 타입.
 * score_adjust/grade_adjust는 최종단계(calibration/closed) 사이클에서만 허용(백엔드가 400 VALIDATION_ERROR 반환).
 */
export async function decideAppeal(id: string, body: DecideAppealBody): Promise<void> {
  await apiPost<Appeal>(`/appeals/${id}/decide`, body);
}

// ── 첨부파일 API ─────────────────────────────────────────────────────────────

/** 첨부파일 목록 조회 */
export async function fetchAttachments(appealId: string): Promise<AppealAttachment[]> {
  const result = await apiGetList<AppealAttachment>(`/appeals/${appealId}/attachments`);
  return result.data;
}

/** 첨부파일 업로드 (multipart field: file) */
export async function uploadAttachment(
  appealId: string,
  file: File,
): Promise<AppealAttachment> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<AppealAttachment>(`/appeals/${appealId}/attachments`, form);
}

/** 첨부파일 다운로드 (Blob) */
export async function downloadAttachment(
  appealId: string,
  attachmentId: string,
): Promise<Blob> {
  return apiDownloadBlob(`/appeals/${appealId}/attachments/${attachmentId}/download`);
}

/** 첨부파일 삭제 */
export async function deleteAttachment(
  appealId: string,
  attachmentId: string,
): Promise<void> {
  await apiDelete(`/appeals/${appealId}/attachments/${attachmentId}`);
}
