/**
 * admin-compensation feature — 데이터 계층(보상 현황).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data 가 HTTP 본문(봉투).
 * 팀 시뮬레이션은 본문이 { data: [...], meta } 이므로 실제 행은 res.data.data.
 */
import {
  compensationsControllerSimulationTeam,
  compensationsControllerUpsertAdjustment,
  type CompensationSimulationDto,
  type UpsertCompensationAdjustmentDto,
  type CompensationAdjustmentDto,
} from '@growthx/contracts';
import { apiPost } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';

export type CompensationSimulation = CompensationSimulationDto;
export type { UpsertCompensationAdjustmentDto, CompensationAdjustmentDto };

export type CompensationIndexRowStatus = 'matched' | 'missing' | 'ambiguous';

export interface CompensationIndexRow {
  rowNo: number;
  status: CompensationIndexRowStatus;
  message: string | null;
  userId: string | null;
  matchedName: string | null;
  groupName: string | null;
  divisionName: string | null;
  teamName: string | null;
  duty: string | null;
  positionLabel: string | null;
  positionCode: string | null;
  name: string;
  displayName: string | null;
  hireDate: string | null;
  careerBaseMonths: number | null;
  priorCareerMonths: number | null;
  careerPosition: string | null;
  serviceYears: number | null;
  considerationExclusion: string | null;
  previousSalary: number | null;
  currentSalaryExclTransfer: number | null;
  currentSalary: number | null;
  adjustmentAmount: number | null;
  promotionPositionLabel: string | null;
  promotionPositionCode: string | null;
  incentiveAmount: number | null;
  note: string | null;
}

export interface CompensationIndexPreview {
  rows: CompensationIndexRow[];
  summary: {
    total: number;
    matched: number;
    missing: number;
    ambiguous: number;
  };
}

export interface CompensationIndexImportResult extends CompensationIndexPreview {
  imported: number;
  skipped: number;
}

/** 팀 전체 보상 시뮬레이션(관리자) 행 목록. */
export async function fetchTeamCompensationSimulation(
  cycleId: string,
  departmentId?: string,
): Promise<CompensationSimulation[]> {
  const res = await compensationsControllerSimulationTeam({
    cycleId,
    departmentId,
  });
  return res.data.data ?? [];
}

/** 보상 조정값 upsert (hr_admin 전용). 4개 필드 전체를 한 번에 보낸다(클로버 방지). */
export async function upsertCompensationAdjustment(
  dto: UpsertCompensationAdjustmentDto,
): Promise<CompensationAdjustmentDto> {
  const res = await compensationsControllerUpsertAdjustment(dto);
  return res.data.data;
}

export async function previewCompensationIndex(
  file: File,
): Promise<CompensationIndexPreview> {
  return uploadExcel<CompensationIndexPreview>('/excel/preview/compensation-index', file);
}

export async function importCompensationIndex(
  cycleId: string,
  rows: CompensationIndexRow[],
  sourceName?: string,
): Promise<CompensationIndexImportResult> {
  return apiPost<CompensationIndexImportResult>('/excel/import/compensation-index', {
    cycleId,
    rows,
    sourceName,
  });
}
