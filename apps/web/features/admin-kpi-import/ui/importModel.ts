// KPI 임포트 화면의 순수 모델 — 상수·타입·행 변환·대상자 추정. (UI 없음)
import type { User, KpiImportRow, KpiCategory, KpiGroup, Grade } from '@/lib/types';
import type { KpiImportPreview, KpiImportResult } from '../api';

export const MAX_MB = 5;
export const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 카테고리↔그룹 매핑.
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};
export const ALL_CATEGORIES: KpiCategory[] = ['revenue', 'construction', 'orders', 'collaboration', 'development'];
export function groupOfCategory(category: KpiCategory): KpiGroup {
  return CATEGORY_BY_GROUP.performance_core.includes(category) ? 'performance_core' : 'collaboration_growth';
}

const EMPTY_CRITERIA = { S: null, A: null, B: null, C: null, D: null };
export function emptyCriteria() {
  return { ...EMPTY_CRITERIA };
}

export function blankRow(): KpiImportRow {
  return {
    category: 'revenue', group: 'performance_core', csf: null, title: '',
    targetText: null, measureMethod: null, weight: null, isQualitative: false,
    gradingCriteria: emptyCriteria(), valid: false, message: null, source: 'parser',
  };
}

export const PASTE_FIELDS = ['csf', 'title', 'targetText', 'measureMethod', 'weight', 'S', 'A', 'B', 'C', 'D'] as const;

export function applyPasteCell(row: KpiImportRow, field: string, raw: string): KpiImportRow {
  const v = raw.trim();
  switch (field) {
    case 'csf': return { ...row, csf: v || null };
    case 'title': return { ...row, title: v };
    case 'targetText': return { ...row, targetText: v || null };
    case 'measureMethod': return { ...row, measureMethod: v || null };
    case 'weight': {
      if (v === '') return { ...row, weight: null };
      const n = Math.trunc(Number(v.replace(/[^0-9.-]/g, '')));
      return Number.isNaN(n) ? row : { ...row, weight: Math.max(0, Math.min(100, n)) };
    }
    case 'S': case 'A': case 'B': case 'C': case 'D': {
      const base = row.gradingCriteria ?? emptyCriteria();
      return { ...row, gradingCriteria: { ...base, [field]: v === '' ? null : v } };
    }
    default: return row;
  }
}

export type RowStatus = 'idle' | 'previewing' | 'previewed' | 'importing' | 'imported' | 'submitting' | 'submitted' | 'error';
export interface FileEntry {
  key: string;
  file: File;
  userId: string | null;
  suggestedId: string | null;
  status: RowStatus;
  preview: KpiImportPreview | null;
  editedRows: KpiImportRow[] | null;
  result: KpiImportResult | null;
  errorMessage: string | null;
}

/** 미리보기 결과에 검토가 필요한 신호(무효 행·행 메시지·파싱 경고/오류)가 있는지. */
export function entryNeedsReview(entry: Pick<FileEntry, 'preview' | 'editedRows'>): boolean {
  const parseIssues =
    (entry.preview?.warnings?.length ?? 0) > 0 || (entry.preview?.errors?.length ?? 0) > 0;
  const rowIssues = (entry.editedRows ?? []).some(
    (r) => r.title.trim().length > 0 && (!r.valid || !!r.message),
  );
  return parseIssues || rowIssues;
}

export function guessUserId(fileName: string, users: User[]): string | null {
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/\([^)]*\)/g, ' ').replace(/[_\-]/g, ' ').replace(/\d+/g, ' ');
  for (const u of users) { if (u.name && cleaned.includes(u.name)) return u.id; }
  const POS_SUFFIX = ['대표이사', '본부장', '팀장', '책임', '선임', '프로', '사원', '님'];
  for (const u of users) {
    if (!u.name) continue;
    for (const suf of POS_SUFFIX) { if (cleaned.includes(u.name + suf)) return u.id; }
  }
  return null;
}
