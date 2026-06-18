'use client';

// 개인별 KPI 엑셀 일괄 임포트(관리자 전용) — admin-kpi-import 수직 슬라이스의 화면.
// 흐름(kpi-import-contract.md §5):
//   1) 다중 .xlsx 드래그&드롭 → 파일 목록(행).
//   2) 행마다: 파일명 / 대상자 선택(검색형 콤보) / 미리보기 / 상태.
//   3) 미리보기 = previewKpi(file) → 파싱 KPI 표 + 가중치합/오류.
//   4) 파일별 [적재] 또는 [전체 적재] = commitKpi(JSON) (draft 생성).
//   5) 결과 요약(파일별 imported/오류/경고) + 검토 경로 안내.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  Eye,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Plus,
  Send,
  Circle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { InfoBanner } from '@/components/InfoBanner';
import { Modal } from '@/components/Modal';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { UserCombobox } from '@/components/UserCombobox';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { kpiCategoryLabel, kpiGroupLabel, cycleStatusText } from '@/lib/ui';
import type {
  User,
  KpiImportRow,
  KpiImportCommitRow,
  KpiCategory,
  KpiGroup,
  Grade,
} from '@/lib/types';
import { useKpiImport } from '../hooks';
import type { KpiImportPreview, KpiImportResult, KpiImportCommitRequest } from '../api';

const MAX_MB = 5;
const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 카테고리↔그룹 매핑.
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};
const ALL_CATEGORIES: KpiCategory[] = ['revenue', 'construction', 'orders', 'collaboration', 'development'];
function groupOfCategory(category: KpiCategory): KpiGroup {
  return CATEGORY_BY_GROUP.performance_core.includes(category) ? 'performance_core' : 'collaboration_growth';
}

const EMPTY_CRITERIA = { S: null, A: null, B: null, C: null, D: null };

function blankRow(): KpiImportRow {
  return {
    category: 'revenue', group: 'performance_core', csf: null, title: '',
    targetText: null, measureMethod: null, weight: null, isQualitative: false,
    gradingCriteria: { ...EMPTY_CRITERIA }, valid: false, message: null,
  };
}

const PASTE_FIELDS = ['csf', 'title', 'targetText', 'measureMethod', 'weight', 'S', 'A', 'B', 'C', 'D'] as const;

function applyPasteCell(row: KpiImportRow, field: string, raw: string): KpiImportRow {
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
      const base = row.gradingCriteria ?? { ...EMPTY_CRITERIA };
      return { ...row, gradingCriteria: { ...base, [field]: v === '' ? null : v } };
    }
    default: return row;
  }
}

type RowStatus = 'idle' | 'previewing' | 'previewed' | 'importing' | 'imported' | 'submitting' | 'submitted' | 'error';
interface FileEntry {
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

function guessUserId(fileName: string, users: User[]): string | null {
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

// ── 상태 배지 (로컬 전용 상태 표현 — DS StatusBadge와 별개 도메인) ──
function ImportStatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { label: string; cls: string; Icon?: React.ElementType }> = {
    idle:       { label: '대기', cls: 'bg-muted text-muted-foreground' },
    previewing: { label: '미리보기 중', cls: 'bg-info-50 text-info-700', Icon: Loader2 },
    previewed:  { label: '확인됨', cls: 'bg-muted text-muted-foreground', Icon: CheckCircle2 },
    importing:  { label: '적재 중', cls: 'bg-primary/10 text-primary', Icon: Loader2 },
    imported:   { label: '적재 완료', cls: 'bg-success-50 text-success-700', Icon: CheckCircle2 },
    submitting: { label: '제출 중', cls: 'bg-primary/10 text-primary', Icon: Loader2 },
    submitted:  { label: '제출 완료', cls: 'bg-success-50 text-success-700', Icon: CheckCircle2 },
    error:      { label: '오류', cls: 'bg-danger-50 text-danger-700', Icon: AlertTriangle },
  };
  const s = map[status];
  const spin = status === 'previewing' || status === 'importing' || status === 'submitting';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
      {s.Icon && <s.Icon size={12} className={spin ? 'animate-spin' : undefined} aria-hidden />}
      {s.label}
    </span>
  );
}

// ── 정성/정량 세그먼트 토글 (그리드 셀 내부 — 레이아웃 상 raw 유지, DS 토큰 클래스 사용) ──
function QualToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="정성/정량 구분" className={`flex w-[84px] rounded border border-border overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      {[false, true].map((isQual) => {
        const on = value === isQual;
        return (
          <button
            key={String(isQual)}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(isQual)}
            className={`flex-1 text-[10.5px] font-bold py-1 text-center transition-colors border-0 outline-none disabled:cursor-not-allowed ${on ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
          >
            {isQual ? '정성' : '정량'}
          </button>
        );
      })}
    </div>
  );
}

// ── 편집 가능한 미리보기 그리드 ──
function EditableGrid({ rows, onChange, readOnly }: { rows: KpiImportRow[]; onChange: (rows: KpiImportRow[]) => void; readOnly?: boolean }) {
  const filled = rows.filter((r) => r.title.trim().length > 0);
  const weightSum = filled.reduce((s, r) => s + (r.weight ?? 0), 0);
  const qualWeight = filled.filter((r) => r.isQualitative).reduce((s, r) => s + (r.weight ?? 0), 0);
  const weightOff = weightSum !== 100;
  const qualHigh = qualWeight > 30;

  function patchRow(idx: number, patch: Partial<KpiImportRow>) {
    onChange(rows.map((r, i) => {
      if (i !== idx) return r;
      const merged = { ...r, ...patch };
      if (patch.category) merged.group = groupOfCategory(patch.category);
      return merged;
    }));
  }
  function patchCriteria(idx: number, grade: Grade, value: string) {
    onChange(rows.map((r, i) => {
      if (i !== idx) return r;
      const base = r.gradingCriteria ?? { ...EMPTY_CRITERIA };
      return { ...r, gradingCriteria: { ...base, [grade]: value === '' ? null : value } };
    }));
  }
  function addRow() { onChange([...rows, blankRow()]); }
  function removeRow(idx: number) { onChange(rows.filter((_, i) => i !== idx)); }

  function handlePaste(e: React.ClipboardEvent<HTMLTableElement>) {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    const rowAttr = target.getAttribute('data-row');
    const fieldAttr = target.getAttribute('data-field');
    if (rowAttr === null || fieldAttr === null) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const startRow = Number(rowAttr);
    const startField = Number(fieldAttr);
    const matrix = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((line) => line.split('\t'));
    const next = rows.slice();
    for (let r = 0; r < matrix.length; r++) {
      const targetIdx = startRow + r;
      while (next.length <= targetIdx) next.push(blankRow());
      let updated = next[targetIdx];
      const cells = matrix[r];
      for (let c = 0; c < cells.length; c++) {
        const field = PASTE_FIELDS[startField + c];
        if (!field) continue;
        updated = applyPasteCell(updated, field, cells[c]);
      }
      next[targetIdx] = updated;
    }
    onChange(next);
  }

  // 그리드 셀 스타일 — 인라인 style 제거 불가(복잡한 수치 기반 레이아웃이므로 최소화)
  const cellInputCls = 'w-full text-[11.5px] text-foreground border border-border bg-card rounded px-1.5 py-1 outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 disabled:opacity-60 disabled:cursor-not-allowed';
  const cellSelectCls = `${cellInputCls} font-semibold cursor-pointer`;

  return (
    <div className="mt-3 border border-border rounded-lg overflow-hidden">
      {/* 그리드 헤더 */}
      <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2.5 bg-muted border-b border-border">
        <h4 className="text-[12.5px] font-semibold text-foreground">미리보기 편집 — {rows.length}개 지표</h4>
        {!readOnly && (
          <span className="text-[11px] text-muted-foreground">
            엑셀에서 셀을 복사해 칸에 붙여넣을 수 있어요(여러 셀·행 가능 · 순서: CSF→KPI→2026목표→측정방식→가중치→등급 S~D)
          </span>
        )}
        <span
          className={`text-[11.5px] font-semibold px-2 py-0.5 rounded ${qualHigh ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
          title="정성 KPI 가중치 합(권장 30% 이하)"
        >
          정성 비중 {qualWeight}%
        </span>
        <span className={`ml-auto text-[11.5px] font-semibold px-2 py-0.5 rounded ${weightOff ? 'bg-warning-50 text-warning-700' : 'bg-muted text-muted-foreground'}`}>
          가중치 합 {weightSum}%{weightOff ? ' (100% 아님)' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px]" onPaste={handlePaste}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b border-border">
              {[
                { label: '분류', w: 130 }, { label: '전략목표(CSF)', w: 180 },
                { label: 'KPI', w: 200 }, { label: '2026 목표', w: 170 },
                { label: '측정방식', w: 150 }, { label: '구분', w: 92 },
                { label: '가중치', w: 64, right: true },
                ...GRADES.map((g) => ({ label: `등급 ${g}`, w: 120 })),
                { label: '', w: 36 },
              ].map(({ label, w, right }, i) => (
                <th
                  key={i}
                  className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2.5 py-2 ${right ? 'text-right' : 'text-left'}`}
                  style={{ minWidth: w }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const emptyTitle = row.title.trim().length === 0;
              return (
                <tr key={i} className={`border-b border-border ${emptyTitle ? 'bg-warning-50' : 'bg-card'}`}>
                  <td className="px-2 py-1.5 align-top">
                    <select value={row.category} disabled={readOnly} onChange={(e) => patchRow(i, { category: e.target.value as KpiCategory })} className={cellSelectCls}>
                      {ALL_CATEGORIES.map((c) => (<option key={c} value={c}>{kpiCategoryLabel[c]}</option>))}
                    </select>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{kpiGroupLabel[row.group]}</div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input data-row={i} data-field={0} value={row.csf ?? ''} disabled={readOnly} placeholder="전략목표" onChange={(e) => patchRow(i, { csf: e.target.value === '' ? null : e.target.value })} className={cellInputCls} />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      data-row={i} data-field={1} value={row.title} disabled={readOnly} placeholder="KPI 명(필수)"
                      onChange={(e) => patchRow(i, { title: e.target.value })}
                      className={`${cellInputCls} ${emptyTitle ? 'border-warning-500' : ''}`}
                    />
                    {emptyTitle && <div className="text-[10px] text-warning-700 mt-0.5">비어 있는 행은 적재되지 않아요</div>}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input data-row={i} data-field={2} value={row.targetText ?? ''} disabled={readOnly} placeholder="2026 목표" onChange={(e) => patchRow(i, { targetText: e.target.value === '' ? null : e.target.value })} className={cellInputCls} />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input data-row={i} data-field={3} value={row.measureMethod ?? ''} disabled={readOnly} placeholder="측정방식" onChange={(e) => patchRow(i, { measureMethod: e.target.value === '' ? null : e.target.value })} className={cellInputCls} />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <QualToggle value={row.isQualitative} disabled={readOnly} onChange={(v) => patchRow(i, { isQualitative: v })} />
                  </td>
                  <td className="px-2 py-1.5 align-top text-right">
                    <input
                      data-row={i} data-field={4} type="number" min={0} max={100}
                      value={row.weight ?? ''} disabled={readOnly}
                      onChange={(e) => { const v = e.target.value; patchRow(i, { weight: v === '' ? null : Math.trunc(Number(v)) }); }}
                      className={`${cellInputCls} w-14 text-right`}
                    />
                  </td>
                  {GRADES.map((g) => (
                    <td key={g} className="px-2 py-1.5 align-top">
                      <input data-row={i} data-field={5 + GRADES.indexOf(g)} value={row.gradingCriteria?.[g] ?? ''} disabled={readOnly} placeholder={`등급 ${g}`} onChange={(e) => patchCriteria(i, g, e.target.value)} className={cellInputCls} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 align-top text-center">
                    <button type="button" disabled={readOnly} onClick={() => removeRow(i)} aria-label="행 삭제" className="p-0.5 text-muted-foreground hover:text-danger-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="border-t border-border px-3.5 py-2 bg-card">
          <Button variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={addRow}>
            행 추가
          </Button>
        </div>
      )}
    </div>
  );
}

// ── 적재 결과 카드 ──
function ResultCard({ entry }: { entry: FileEntry }) {
  const r = entry.result;
  if (!r) return null;
  return (
    <div className={`mt-3 border rounded-lg px-4 py-3 ${r.ok ? 'border-success-500/40 bg-success-50' : 'border-warning-500/40 bg-warning-50'}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`text-[12.5px] font-bold ${r.ok ? 'text-success-700' : 'text-warning-700'}`}>
          {r.imported}개 지표를 {entry.status === 'submitted' ? '적재·제출했어요 (submitted)' : '적재했어요 (draft)'}
        </span>
        {r.deletedDrafts > 0 && <span className="text-[11.5px] text-muted-foreground">기존 draft {r.deletedDrafts}개 교체</span>}
        <span className="text-[11.5px] text-muted-foreground tabular-nums">가중치 합 {r.weightSum}%</span>
        <Link href="/kpi/review" className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline">
          KPI 검토로 이동 <ArrowRight size={12} aria-hidden />
        </Link>
      </div>
      {r.warnings.length > 0 && (
        <ul className="mt-1.5 pl-4 list-disc">
          {r.warnings.map((w, i) => (<li key={i} className="text-[11.5px] text-warning-700">{w}</li>))}
        </ul>
      )}
      {r.errors.length > 0 && (
        <ul className="mt-1.5 pl-4 list-disc">
          {r.errors.map((e, i) => (<li key={`${e.row}-${i}`} className="text-[11.5px] text-danger-700">{e.row}행: {e.message}</li>))}
        </ul>
      )}
    </div>
  );
}

// ── 메인 뷰 ──────────────────────────────────────────────────────
export function AdminKpiImportView() {
  const { user } = useAuth();
  const toast = useToast();
  const { preview, commit, submit } = useKpiImport();
  const allowed = !!user && isHrAdmin(user.role);

  const { current, loading: cycleLoading } = useCurrentCycle();
  const cycleId = current?.id ?? null;

  const { data: usersData, loading: usersLoading } = useUsers({ pageSize: 500 }, { enabled: allowed });
  const users = useMemo<User[]>(() => (usersData?.data ?? []).filter((u) => u.isActive), [usersData]);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [reparseTarget, setReparseTarget] = useState<FileEntry | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: FileEntry[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast.show({ variant: 'danger', message: `${file.name}: .xlsx 파일만 올릴 수 있어요.` });
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.show({ variant: 'danger', message: `${file.name}: 최대 ${MAX_MB}MB까지 올릴 수 있어요.` });
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file, userId: guessUserId(file.name, users), suggestedId: guessUserId(file.name, users),
        status: 'idle', preview: null, editedRows: null, result: null, errorMessage: null,
      });
    }
    if (next.length > 0) setEntries((prev) => [...prev, ...next]);
  }

  function patchEntry(key: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function patchEditedRows(key: string, rows: KpiImportRow[]) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, editedRows: rows } : e)));
  }
  function removeEntry(key: string) { setEntries((prev) => prev.filter((e) => e.key !== key)); }

  async function doPreview(entry: FileEntry): Promise<KpiImportRow[] | null> {
    patchEntry(entry.key, { status: 'previewing', errorMessage: null });
    try {
      const result = await preview(entry.file);
      const editedRows: KpiImportRow[] = result.rows.map((r) => ({
        category: r.category as KpiCategory, group: r.group as KpiGroup,
        csf: r.csf, title: r.title, targetText: r.targetText, measureMethod: r.measureMethod,
        weight: r.weight, isQualitative: r.isQualitative,
        gradingCriteria: r.gradingCriteria
          ? { S: r.gradingCriteria.S ?? null, A: r.gradingCriteria.A ?? null, B: r.gradingCriteria.B ?? null, C: r.gradingCriteria.C ?? null, D: r.gradingCriteria.D ?? null }
          : null,
        valid: r.valid, message: r.message,
      }));
      patchEntry(entry.key, { status: 'previewed', preview: result, editedRows });
      return editedRows;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '미리보기에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.show({ variant: 'danger', message: msg });
      return null;
    }
  }

  function toCommitRows(rows: KpiImportRow[]): KpiImportCommitRow[] {
    return rows.filter((r) => r.title.trim().length > 0).map((r) => ({
      category: r.category, group: r.group, csf: r.csf, title: r.title.trim(),
      targetText: r.targetText, measureMethod: r.measureMethod,
      weight: Math.max(0, Math.min(100, Math.trunc(r.weight ?? 0))),
      isQualitative: r.isQualitative, gradingCriteria: r.gradingCriteria,
    }));
  }

  async function doImport(entry: FileEntry): Promise<boolean> {
    if (!entry.userId) {
      toast.show({ variant: 'danger', message: `${entry.file.name}: 대상자를 먼저 선택해 주세요.` });
      return false;
    }
    let rows = entry.editedRows;
    if (!rows) {
      rows = await doPreview(entry);
      if (!rows) return false;
    }
    const commitRows = toCommitRows(rows);
    if (commitRows.length === 0) {
      patchEntry(entry.key, { status: 'error', errorMessage: 'KPI 명이 채워진 행이 없어요.' });
      toast.show({ variant: 'danger', message: `${entry.file.name}: 적재할 행이 없어요.` });
      return false;
    }
    patchEntry(entry.key, { status: 'importing', errorMessage: null });
    try {
      const body: KpiImportCommitRequest = { userId: entry.userId, cycleId: cycleId ?? undefined, fileName: entry.file.name, rows: commitRows };
      const result = await commit(body);
      patchEntry(entry.key, { status: 'imported', result });
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '적재에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.show({ variant: 'danger', message: msg });
      return false;
    }
  }

  const [bulkBusy, setBulkBusy] = useState(false);
  async function importAll() {
    const targets = entries.filter((e) => e.userId && e.status !== 'imported' && e.status !== 'importing');
    if (targets.length === 0) {
      toast.show({ variant: 'info', message: '적재할 파일이 없어요. 대상자를 선택했는지 확인해 주세요.' });
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const e of targets) { const success = await doImport(e); if (success) ok += 1; }
    setBulkBusy(false);
    toast.show({ variant: ok === targets.length ? 'success' : 'info', message: `${ok}/${targets.length}개 파일을 적재했어요.` });
  }

  async function doSubmit(entry: FileEntry) {
    if (!entry.userId) return;
    patchEntry(entry.key, { status: 'submitting', errorMessage: null });
    try {
      const res = await submit({ userId: entry.userId, cycleId: cycleId ?? undefined });
      patchEntry(entry.key, { status: 'submitted' });
      toast.show({ variant: 'success', message: `${res.submitted}개 KPI를 제출했어요.` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '제출에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.show({ variant: 'danger', message: msg });
    }
  }

  if (!allowed) return <Forbidden message="KPI 일괄 등록은 HR만 접근할 수 있어요." />;
  if (cycleLoading) return <Skeleton className="h-64 w-full" />;

  const selectedCount = entries.filter((e) => e.userId).length;
  const importedCount = entries.filter((e) => e.status === 'imported' || e.status === 'submitted').length;

  const importStep = (() => {
    if (importedCount > 0) return 3;
    if (entries.some((e) => e.status === 'previewed' || e.status === 'importing')) return 2;
    if (entries.length > 0) return 1;
    return 0;
  })();

  const IMPORT_STEPS = [
    { label: '파일 업로드', desc: '.xlsx 드래그&드롭' },
    { label: '대상자 매칭', desc: '파일별 사원 선택' },
    { label: '미리보기 · 검토', desc: '내용 확인 후 편집' },
    { label: '적재 완료', desc: 'draft KPI 생성' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="KPI 일괄 등록"
        subtitle="회사 표준 KPI 엑셀 양식(1인 1파일)을 올려 개인별 KPI를 한 번에 등록합니다."
      />

      {/* 활성 사이클 안내 */}
      {current ? (
        <InfoBanner tone="info">
          적재 대상 평가 주기는 <b>{current.name}</b>({cycleStatusText(current.status)})예요.
          시트에는 이름이 없으니 파일마다 대상자를 직접 선택해 주세요.{' '}
          <b>미리보기에서 정성/정량과 내용을 검토·수정한 뒤 적재하세요. 빠진 항목은 직접 채우거나 행을 추가할 수 있어요.</b>{' '}
          적재된 KPI는 <b>draft(임시저장)</b> 상태로 생성되며, 같은 대상자·주기로 다시 올리면 기존 draft를
          교체해요(제출·승인된 KPI는 보존). 적재 후 나타나는 <b>[제출]</b> 버튼으로 바로 제출할 수 있어요(가중치 합 100% 필요).
        </InfoBanner>
      ) : (
        <InfoBanner tone="warning" title="활성 평가 주기가 없어요">
          평가 운영에서 평가 주기를 먼저 만들고 활성화한 뒤 KPI를 등록해 주세요.
        </InfoBanner>
      )}

      {/* 임포트 단계 진행 표시 */}
      <Card title="임포트 진행 단계">
        <div className="flex items-center gap-0">
          {IMPORT_STEPS.map((step, idx) => {
            const done = importStep > idx;
            const active = importStep === idx;
            return (
              <div key={idx} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 80, flexShrink: 0 }}>
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${done ? 'bg-info-50' : active ? 'bg-primary/10' : 'bg-muted'}`}>
                    {done
                      ? <CheckCircle2 size={20} className="text-info-700" />
                      : active
                        ? <Loader2 size={20} className="text-primary animate-spin" />
                        : <Circle size={20} className="text-muted-foreground" />
                    }
                  </div>
                  <span className={`text-xs text-center ${done ? 'font-bold text-info-700' : active ? 'font-bold text-primary' : 'font-medium text-muted-foreground'}`}>
                    {step.label}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground text-center">{step.desc}</span>
                </div>
                {idx < IMPORT_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 mb-9 ${done ? 'bg-info-500' : 'bg-border'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 드롭존(다중) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-lg py-10 px-5 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'}`}
      >
        <UploadCloud size={36} className={dragOver ? 'text-primary' : 'text-muted-foreground'} aria-hidden />
        <p className={`text-sm font-semibold ${dragOver ? 'text-primary' : 'text-muted-foreground'}`}>
          {dragOver ? '여기에 놓으세요!' : '여러 개의 .xlsx 파일을 끌어다 놓거나'}
        </p>
        <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary bg-card border border-primary/30 rounded-md px-4 py-2 cursor-pointer hover:bg-primary/5 transition-colors">
          파일 선택
          <input type="file" accept=".xlsx" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <p className="text-[11.5px] text-muted-foreground">.xlsx · 파일당 최대 {MAX_MB}MB · 다중 선택 가능</p>
      </div>

      {/* 파일 목록 */}
      {entries.length > 0 && (
        <Card title={`파일 ${entries.length}개`} action={
          <div className="flex items-center gap-2.5">
            <span className="text-[11.5px] text-muted-foreground">대상자 선택 {selectedCount} · 적재 완료 {importedCount}</span>
            <Button
              variant="primary"
              size="sm"
              loading={bulkBusy}
              disabled={selectedCount === 0 || !!cycleLoading}
              leftIcon={<Upload size={14} />}
              onClick={() => void importAll()}
            >
              {bulkBusy ? '적재 중…' : '전체 적재'}
            </Button>
          </div>
        }>
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.key} className="py-3.5 first:pt-0 last:pb-0">
                {/* 행 헤더 */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="text-[12.5px] font-semibold text-foreground flex-1 min-w-0 truncate"
                    title={entry.file.name}
                  >
                    {entry.file.name}
                  </span>

                  <UserCombobox
                    users={users}
                    value={entry.userId}
                    suggestedId={entry.suggestedId}
                    disabled={usersLoading || entry.status === 'importing'}
                    onChange={(id) => patchEntry(entry.key, { userId: id })}
                  />

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={entry.status === 'previewing' || entry.status === 'importing' || entry.status === 'submitting'}
                    leftIcon={<Eye size={13} />}
                    onClick={() => {
                      if (entry.editedRows) setReparseTarget(entry);
                      else void doPreview(entry);
                    }}
                  >
                    {entry.editedRows ? '다시 불러오기' : '미리보기'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!entry.userId || entry.status === 'importing'}
                    leftIcon={<Upload size={13} />}
                    onClick={() => void doImport(entry)}
                  >
                    적재
                  </Button>

                  {entry.status === 'imported' && (
                    <Button variant="primary" size="sm" leftIcon={<Send size={13} />} onClick={() => void doSubmit(entry)}>
                      제출
                    </Button>
                  )}

                  <ImportStatusBadge status={entry.status} />

                  <button
                    type="button"
                    onClick={() => removeEntry(entry.key)}
                    disabled={entry.status === 'importing'}
                    aria-label="파일 제거"
                    className="p-1 text-muted-foreground hover:text-danger-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>

                {entry.errorMessage && (
                  <p className="text-[11.5px] text-danger-700 mt-1.5">{entry.errorMessage}</p>
                )}

                {/* 편집 가능한 미리보기 그리드 */}
                {entry.editedRows && entry.status !== 'imported' && entry.status !== 'submitting' && entry.status !== 'submitted' && (
                  <EditableGrid
                    rows={entry.editedRows}
                    onChange={(rows) => patchEditedRows(entry.key, rows)}
                    readOnly={entry.status === 'importing'}
                  />
                )}

                <ResultCard entry={entry} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 재파싱 손실 경고 모달 */}
      <Modal
        open={reparseTarget !== null}
        onClose={() => setReparseTarget(null)}
        title="파일에서 다시 불러올까요?"
        primaryAction={{
          label: '다시 불러오기',
          variant: 'danger',
          onClick: () => {
            const t = reparseTarget;
            setReparseTarget(null);
            if (t) void doPreview(t);
          },
        }}
        secondaryAction={{ label: '취소', onClick: () => setReparseTarget(null) }}
      >
        엑셀에서 다시 불러오면 이 파일에 편집·적재한 내용이 사라지고 원본 값으로 돌아가요. 계속할까요?
      </Modal>
    </PageContainer>
  );
}
