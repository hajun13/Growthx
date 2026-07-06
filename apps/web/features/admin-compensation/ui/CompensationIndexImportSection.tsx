'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DesignLabel } from '@/components/DesignLabel';
import { FilterChipBar } from '@/components/FilterChipBar';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import {
  importCompensationIndex,
  previewCompensationIndex,
  type CompensationIndexPreview,
  type CompensationIndexRow,
  type CompensationIndexRowStatus,
} from '../api';

type Props = {
  cycleId: string | undefined;
  canEdit: boolean;
  onImported: () => Promise<void>;
};

const STATUS_OPTIONS: { value: 'all' | CompensationIndexRowStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'matched', label: '매칭' },
  { value: 'missing', label: '미등록' },
  { value: 'ambiguous', label: '동명이인' },
];

const MAX_MB = 5;

const IMPORT_STEPS = [
  { label: '파일 업로드', desc: '.xlsx 드래그&드롭' },
  { label: '대상자 매칭', desc: 'Index 이름 기준 매칭' },
  { label: '미리보기 · 검토', desc: '내용 확인 후 편집' },
  { label: '적재 완료', desc: '보상 데이터 반영' },
] as const;

function toNum(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function money(value: number | null): string {
  return value == null ? '' : String(value);
}

export function CompensationIndexImportSection({ cycleId, canEdit, onImported }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompensationIndexPreview | null>(null);
  const [rows, setRows] = useState<CompensationIndexRow[]>([]);
  const [filter, setFilter] = useState<'all' | CompensationIndexRowStatus>('all');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const filteredRows = useMemo(
    () => rows.filter((r) => filter === 'all' || r.status === filter),
    [filter, rows],
  );
  const summary = preview?.summary ?? {
    total: rows.length,
    matched: rows.filter((r) => r.status === 'matched').length,
    missing: rows.filter((r) => r.status === 'missing').length,
    ambiguous: rows.filter((r) => r.status === 'ambiguous').length,
  };
  const imported = preview != null && 'imported' in preview ? Number(preview.imported) : 0;
  const importStep = (() => {
    if (imported > 0) return 3;
    if (rows.length > 0) return 2;
    if (loading) return 1;
    return 0;
  })();

  function patch(rowNo: number, patchRow: Partial<CompensationIndexRow>) {
    setRows((prev) => prev.map((r) => (r.rowNo === rowNo ? { ...r, ...patchRow } : r)));
  }

  async function handleFiles(fileList: FileList | File[] | undefined | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const invalid = files.find((file) => {
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
      const isSmallEnough = file.size <= MAX_MB * 1024 * 1024;
      return !isXlsx || !isSmallEnough;
    });
    if (invalid) {
      toast.show({ variant: 'danger', message: '.xlsx 파일만 업로드할 수 있고, 파일당 최대 5MB까지 가능합니다.' });
      return;
    }

    setLoading(true);
    try {
      const previews = await Promise.all(files.map((file) => previewCompensationIndex(file)));
      let rowOffset = 0;
      const mergedRows = previews.flatMap((data) => {
        const next = data.rows.map((row) => ({ ...row, rowNo: row.rowNo + rowOffset }));
        rowOffset += 10000;
        return next;
      });
      const nextPreview: CompensationIndexPreview = {
        rows: mergedRows,
        summary: {
          total: mergedRows.length,
          matched: mergedRows.filter((r) => r.status === 'matched').length,
          missing: mergedRows.filter((r) => r.status === 'missing').length,
          ambiguous: mergedRows.filter((r) => r.status === 'ambiguous').length,
        },
      };
      setFileName(files.map((file) => file.name).join(', '));
      setPreview(nextPreview);
      setRows(mergedRows);
      setFilter('all');
      toast.show({ variant: 'success', message: `Index ${nextPreview.summary.total}행을 읽었어요.` });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '엑셀을 읽지 못했어요.' });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleImport() {
    if (!cycleId) return;
    setImporting(true);
    try {
      const result = await importCompensationIndex(cycleId, rows, fileName ?? undefined);
      setPreview(result);
      setRows(result.rows);
      await onImported();
      toast.show({ variant: 'success', message: `${result.imported}행을 보상 데이터에 반영했어요.` });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '일괄 반영에 실패했어요.' });
    } finally {
      setImporting(false);
    }
  }

  if (!canEdit) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <Card title="임포트 진행 단계">
        <div className="flex items-center gap-0">
          {IMPORT_STEPS.map((step, idx) => {
            const done = importStep > idx;
            const active = importStep === idx;
            return (
              <div key={idx} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 80, flexShrink: 0 }}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${done ? 'bg-info-50' : active ? 'bg-primary/5' : 'bg-muted'}`}>
                    {done ? (
                      <CheckCircle2 size={20} className="text-info-700" aria-hidden />
                    ) : active ? (
                      <Loader2 size={20} className="animate-spin text-primary" aria-hidden />
                    ) : (
                      <Circle size={20} className="text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <span className={`text-center text-xs ${done ? 'font-bold text-info-700' : active ? 'font-bold text-primary' : 'font-medium text-muted-foreground'}`}>
                    {step.label}
                  </span>
                  <span className="text-center text-[10.5px] text-muted-foreground">{step.desc}</span>
                </div>
                {idx < IMPORT_STEPS.length - 1 && (
                  <div className={`mx-2 mb-9 h-0.5 flex-1 ${done ? 'bg-info-500' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-5 py-10 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'}`}
      >
        <UploadCloud size={36} className={dragging ? 'text-primary' : 'text-muted-foreground'} aria-hidden />
        <p className={`text-sm font-semibold ${dragging ? 'text-primary' : 'text-muted-foreground'}`}>
          {dragging ? '여기에 놓으세요!' : '여러 개의 .xlsx 파일을 끌어다 놓거나'}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-primary/30 bg-card px-4 py-2 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/5">
          <FileSpreadsheet size={14} aria-hidden />
          {loading ? '읽는 중...' : '파일 선택'}
          <input
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <p className="text-[11.5px] text-muted-foreground">.xlsx · 파일당 최대 {MAX_MB}MB · 다중 선택 가능</p>
      </div>

      {rows.length > 0 && (
        <Card
          title="연봉갱신 Index 일괄 등록"
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UploadCloud size={14} aria-hidden />}
              disabled={!cycleId || rows.length === 0}
              loading={importing}
              onClick={() => void handleImport()}
            >
              매칭 행 반영
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{fileName ?? '업로드된 파일 없음'}</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> 매칭 {summary.matched}명</span>
              <span className="inline-flex items-center gap-1"><AlertTriangle size={13} /> 미등록 {summary.missing}명</span>
              <span>동명이인 {summary.ambiguous}명</span>
            </div>

            <FilterChipBar options={STATUS_OPTIONS} value={filter} onChange={(v) => setFilter(v as typeof filter)} />
            <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[1120px] border-collapse text-[11.5px]">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    {['상태', '이름', '그룹', '본부', '팀', '입사일', '24년 연봉', '25년 이전제외A', '25년 이전포함B', '조정분', '승격', '인센티브', 'Note'].map((h) => (
                      <th key={h} className="whitespace-nowrap border-b border-border px-2 py-2 text-left font-semibold text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.rowNo} className="border-b border-border/70">
                      <td className="px-2 py-1.5">
                        <DesignLabel
                          tone={row.status === 'matched' ? 'green' : row.status === 'missing' ? 'amber' : 'red'}
                        >
                          {row.status === 'matched' ? '매칭' : row.status === 'missing' ? '미등록' : '동명이인'}
                        </DesignLabel>
                      </td>
                      <td className="px-2 py-1.5 font-semibold">{row.name}</td>
                      <td className="px-2 py-1.5">{row.groupName ?? '-'}</td>
                      <td className="px-2 py-1.5">{row.divisionName ?? '-'}</td>
                      <td className="px-2 py-1.5">{row.teamName ?? '-'}</td>
                      <td className="px-2 py-1.5">
                        <input className="w-28 rounded border border-border px-1.5 py-1" value={row.hireDate ?? ''} onChange={(e) => patch(row.rowNo, { hireDate: e.target.value || null })} />
                      </td>
                      <td className="px-2 py-1.5"><input className="w-28 rounded border border-border px-1.5 py-1 text-right" value={money(row.previousSalary)} onChange={(e) => patch(row.rowNo, { previousSalary: toNum(e.target.value) })} /></td>
                      <td className="px-2 py-1.5"><input className="w-28 rounded border border-border px-1.5 py-1 text-right" value={money(row.currentSalaryExclTransfer)} onChange={(e) => patch(row.rowNo, { currentSalaryExclTransfer: toNum(e.target.value) })} /></td>
                      <td className="px-2 py-1.5"><input className="w-28 rounded border border-border px-1.5 py-1 text-right" value={money(row.currentSalary)} onChange={(e) => patch(row.rowNo, { currentSalary: toNum(e.target.value) })} /></td>
                      <td className="px-2 py-1.5"><input className="w-24 rounded border border-border px-1.5 py-1 text-right" value={money(row.adjustmentAmount)} onChange={(e) => patch(row.rowNo, { adjustmentAmount: toNum(e.target.value) })} /></td>
                      <td className="px-2 py-1.5"><input className="w-24 rounded border border-border px-1.5 py-1" value={row.promotionPositionLabel ?? ''} onChange={(e) => patch(row.rowNo, { promotionPositionLabel: e.target.value || null, promotionPositionCode: e.target.value || null })} /></td>
                      <td className="px-2 py-1.5"><input className="w-28 rounded border border-border px-1.5 py-1 text-right" value={money(row.incentiveAmount)} onChange={(e) => patch(row.rowNo, { incentiveAmount: toNum(e.target.value) })} /></td>
                      <td className="px-2 py-1.5"><input className="w-48 rounded border border-border px-1.5 py-1" value={row.note ?? ''} onChange={(e) => patch(row.rowNo, { note: e.target.value || null })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
