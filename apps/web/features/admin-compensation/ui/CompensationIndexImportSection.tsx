'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FilterChipBar } from '@/components/FilterChipBar';
import { useUsers } from '@/hooks/useUsers';
import type { User } from '@/lib/types';
import { ApiError } from '@/lib/api';
import {
  importCompensationIndex,
  previewCompensationIndex,
  type CompensationIndexPreview,
  type CompensationIndexRow,
  type CompensationIndexRowStatus,
} from '../api';
import { IndexPreviewTable } from './IndexPreviewTable';

type Props = {
  cycleId: string | undefined;
  /** 조회 사이클 연도 — 표 헤더 연도 라벨 파생(하드코딩 방지). */
  cycleYear?: number | null;
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

export function CompensationIndexImportSection({ cycleId, cycleYear, canEdit, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompensationIndexPreview | null>(null);
  const [rows, setRows] = useState<CompensationIndexRow[]>([]);
  const [filter, setFilter] = useState<'all' | CompensationIndexRowStatus>('all');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  // 업로드 시점에 동명이인이었던 행 — 매칭 후에도 콤보박스를 유지해 되돌리기 가능.
  const [ambiguousRowNos, setAmbiguousRowNos] = useState<Set<number>>(new Set());

  // 동명이인 행 수동 매칭용 활성 사용자 목록.
  const { data: usersData } = useUsers({ pageSize: 500 }, { enabled: canEdit });
  const users = useMemo<User[]>(() => (usersData?.data ?? []).filter((u) => u.isActive), [usersData]);

  // 헤더 연도 라벨 — 사이클 연도에서 파생(예: 2026 사이클 → 24년/25년, 기존 하드코딩과 동일한 상대 연도).
  const y2 = cycleYear != null ? String(cycleYear - 2).slice(-2) : '24';
  const y1 = cycleYear != null ? String(cycleYear - 1).slice(-2) : '25';

  const filteredRows = useMemo(
    () => rows.filter((r) => filter === 'all' || r.status === filter),
    [filter, rows],
  );
  // 요약은 항상 현재 행 기준 재계산 — 수동 매칭(동명이인→매칭)이 즉시 반영되게.
  const summary = {
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
  // 스피너는 실제 처리 중(파일 읽기·반영)에만 — 사용자 입력 대기 단계는 정적 아이콘.
  const processing = loading || importing;

  function patch(rowNo: number, patchRow: Partial<CompensationIndexRow>) {
    setRows((prev) => prev.map((r) => (r.rowNo === rowNo ? { ...r, ...patchRow } : r)));
  }

  /** 동명이인 행 수동 매칭 — 선택 시 matched 로, 해제 시 다시 ambiguous 로. */
  function matchAmbiguous(rowNo: number, userId: string | null) {
    const matched = userId ? users.find((u) => u.id === userId) ?? null : null;
    patch(rowNo, {
      userId,
      matchedName: matched?.name ?? null,
      status: userId ? 'matched' : 'ambiguous',
      message: userId ? null : '동명이인 — 대상자를 직접 선택해 주세요.',
    });
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
      toast.error('.xlsx 파일만 업로드할 수 있고, 파일당 최대 5MB까지 가능합니다.', { duration: 8000 });
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
      setAmbiguousRowNos(new Set(mergedRows.filter((r) => r.status === 'ambiguous').map((r) => r.rowNo)));
      setFilter('all');
      toast.success(`Index ${nextPreview.summary.total}행을 읽었어요.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '엑셀을 읽지 못했어요.', { duration: 8000 });
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
      setAmbiguousRowNos(new Set(result.rows.filter((r) => r.status === 'ambiguous').map((r) => r.rowNo)));
      await onImported();
      toast.success(`${result.imported}행을 보상 데이터에 반영했어요.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '일괄 반영에 실패했어요.', { duration: 8000 });
    } finally {
      setImporting(false);
    }
  }

  if (!canEdit) return null;

  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <Card>
        <div className="border-b border-border">
          <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
            <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">임포트 진행 단계</CardTitle>
          </CardHeader>
        </div>
        <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-0">
          {IMPORT_STEPS.map((step, idx) => {
            const done = importStep > idx;
            const active = importStep === idx;
            return (
              <div key={idx} className="flex flex-1 items-center">
                <div className="flex min-w-20 shrink-0 flex-col items-center gap-1.5">
                  {/* 스피너는 실제 처리 중에만 — 사용자 대기(active) 단계는 정적 아이콘 */}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${done ? 'bg-info-50' : active ? 'bg-primary/5' : 'bg-muted'}`}>
                    {done ? (
                      <CheckCircle2 size={20} className="text-info-700" aria-hidden />
                    ) : active && processing ? (
                      <Loader2 size={20} className="animate-spin text-primary" aria-hidden />
                    ) : active ? (
                      <Circle size={20} className="text-primary" aria-hidden />
                    ) : (
                      <Circle size={20} className="text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <span className={`text-center text-xs ${done ? 'font-bold text-info-700' : active ? 'font-bold text-primary' : 'font-medium text-muted-foreground'}`}>
                    {step.label}
                  </span>
                  <span className="text-center text-10h text-muted-foreground">{step.desc}</span>
                </div>
                {idx < IMPORT_STEPS.length - 1 && (
                  <div className={`mx-2 mb-9 h-0.5 flex-1 ${done ? 'bg-info-500' : 'bg-border'}`} />
                )}
              </div>
            );
          })}
        </div>
        </CardContent>
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
        {/* 바깥 드롭존(role=button)의 onClick 과 중첩 — 버블링을 끊어 파일 대화상자 이중 오픈 방지 */}
        <Button
          asChild
          variant="outline"
          size="sm"
        >
          <label
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <FileSpreadsheet aria-hidden />
            {loading ? '읽는 중...' : '파일 선택'}
            <Input
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
        </Button>
        <p className="text-11h text-muted-foreground">.xlsx · 파일당 최대 {MAX_MB}MB · 다중 선택 가능</p>
      </div>

      {rows.length > 0 && (
        <Card>
          <div className="border-b border-border">
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
              <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">연봉갱신 Index 일괄 등록</CardTitle>
              <Button
                size="sm"
                disabled={!cycleId || rows.length === 0}
                loading={importing}
                onClick={() => void handleImport()}
              >
                {!importing && <UploadCloud aria-hidden />}
                매칭 행 반영
              </Button>
            </CardHeader>
          </div>
          <CardContent className="p-4 md:p-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{fileName ?? '업로드된 파일 없음'}</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> 매칭 {summary.matched}명</span>
                <span className="inline-flex items-center gap-1"><AlertTriangle size={13} /> 미등록 {summary.missing}명</span>
                <span>동명이인 {summary.ambiguous}명</span>
              </div>

              <FilterChipBar options={STATUS_OPTIONS} value={filter} onChange={(v) => setFilter(v as typeof filter)} />
              <IndexPreviewTable
                rows={filteredRows}
                ambiguousRowNos={ambiguousRowNos}
                users={users}
                y1={y1}
                y2={y2}
                onPatch={patch}
                onMatchAmbiguous={matchAmbiguous}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
