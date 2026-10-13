'use client';

// 편집 가능한 미리보기 그리드 — 엑셀 셀 붙여넣기(여러 셀·행) 지원.
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DesignLabel } from '@/components/DesignLabel';
import { kpiCategoryLabel, kpiGroupLabel } from '@/lib/ui';
import type { KpiImportRow, KpiCategory, Grade } from '@/lib/types';
import {
  ALL_CATEGORIES,
  GRADES,
  PASTE_FIELDS,
  applyPasteCell,
  blankRow,
  emptyCriteria,
  groupOfCategory,
} from './importModel';

// ── 정성/정량 세그먼트 토글 ──
function QualToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="정성/정량 구분" className="flex w-21">
      {[false, true].map((isQual) => {
        const on = value === isQual;
        return (
          <Button
            key={String(isQual)}
            variant={on ? 'default' : 'outline'}
            size="xs"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(isQual)}
            className="flex-1"
          >
            {isQual ? '정성' : '정량'}
          </Button>
        );
      })}
    </div>
  );
}

export function EditableGrid({ rows, onChange, readOnly }: { rows: KpiImportRow[]; onChange: (rows: KpiImportRow[]) => void; readOnly?: boolean }) {
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
      const base = r.gradingCriteria ?? emptyCriteria();
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

  return (
    <div className="mt-3 border border-border rounded-lg overflow-hidden">
      {/* 그리드 헤더 */}
      <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2.5 bg-muted border-b border-border">
        <h4 className="text-12h font-semibold text-foreground">미리보기 편집 — {rows.length}개 지표</h4>
        {!readOnly && (
          <span className="text-11 text-muted-foreground">
            엑셀에서 셀을 복사해 칸에 붙여넣을 수 있어요(여러 셀·행 가능 · 순서: CSF→KPI→2026목표→측정방식→가중치→등급 S~D)
          </span>
        )}
        <DesignLabel tone={qualHigh ? 'amber' : 'gray'} title="정성 KPI 가중치 합(권장 30% 이하)">
          정성 비중 {qualWeight}%
        </DesignLabel>
        <DesignLabel tone={weightOff ? 'amber' : 'gray'} className="ml-auto">
          가중치 합 {weightSum}%{weightOff ? ' (100% 아님)' : ''}
        </DesignLabel>
      </div>

      <div className="overflow-x-auto">
        <Table className="border-collapse" onPaste={handlePaste}>
          <TableHeader>
            <TableRow plain>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-32.5">분류</TableHead>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-45">전략목표(CSF)</TableHead>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-50">KPI</TableHead>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-42.5">2026 목표</TableHead>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-37.5">측정방식</TableHead>
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-23">구분</TableHead>
              <TableHead textAlign="right" className="h-8 text-10 uppercase tracking-widest min-w-16">가중치</TableHead>
              {GRADES.map((g) => (
                <TableHead key={g} className="h-8 text-10 uppercase tracking-widest min-w-30">등급 {g}</TableHead>
              ))}
              <TableHead className="h-8 text-10 uppercase tracking-widest min-w-9" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const emptyTitle = row.title.trim().length === 0;
              const flagged = emptyTitle || !row.valid || !!row.message;
              return (
                <TableRow key={i} plain flag={flagged ? 'warning' : 'none'}>
                  <TableCell dense>
                    <Select value={row.category} disabled={readOnly} onValueChange={(v) => patchRow(i, { category: v as KpiCategory })}>
                      <SelectTrigger size="sm" aria-label="분류" className="text-11h font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{kpiCategoryLabel[c]}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <div className="text-10 text-muted-foreground mt-0.5">{kpiGroupLabel[row.group]}</div>
                    {row.source === 'ai' && (
                      <span className="inline-flex items-center rounded-sm bg-info-100 px-1 py-0.5 text-10 font-medium text-info-700 mt-0.5">
                        AI 추론
                      </span>
                    )}
                    {row.message && !emptyTitle && (
                      <div className="text-10 text-warning-700 mt-0.5">{row.message}</div>
                    )}
                  </TableCell>
                  <TableCell dense>
                    <Input data-row={i} data-field={0} value={row.csf ?? ''} disabled={readOnly} placeholder="전략목표" onChange={(e) => patchRow(i, { csf: e.target.value === '' ? null : e.target.value })} className="h-7 text-11h" />
                  </TableCell>
                  <TableCell dense>
                    {/* 제목 비어 있으면 앰버 링 — Input 은 aria-invalid(빨강)만 가지므로 래퍼로 표시 */}
                    <div className={emptyTitle ? 'rounded-md ring-1 ring-warning-500' : undefined}>
                      <Input
                        data-row={i} data-field={1} value={row.title} disabled={readOnly} placeholder="KPI 명(필수)"
                        onChange={(e) => patchRow(i, { title: e.target.value })}
                        className="h-7 text-11h"
                      />
                    </div>
                    {emptyTitle && <div className="text-10 text-warning-700 mt-0.5">비어 있는 행은 적재되지 않아요</div>}
                  </TableCell>
                  <TableCell dense>
                    <Input data-row={i} data-field={2} value={row.targetText ?? ''} disabled={readOnly} placeholder="2026 목표" onChange={(e) => patchRow(i, { targetText: e.target.value === '' ? null : e.target.value })} className="h-7 text-11h" />
                  </TableCell>
                  <TableCell dense>
                    <Input data-row={i} data-field={3} value={row.measureMethod ?? ''} disabled={readOnly} placeholder="측정방식" onChange={(e) => patchRow(i, { measureMethod: e.target.value === '' ? null : e.target.value })} className="h-7 text-11h" />
                  </TableCell>
                  <TableCell dense>
                    <QualToggle value={row.isQualitative} disabled={readOnly} onChange={(v) => patchRow(i, { isQualitative: v })} />
                  </TableCell>
                  <TableCell dense textAlign="right">
                    <Input
                      data-row={i} data-field={4} type="number" min={0} max={100}
                      value={row.weight ?? ''} disabled={readOnly}
                      onChange={(e) => { const v = e.target.value; patchRow(i, { weight: v === '' ? null : Math.trunc(Number(v)) }); }}
                      className="h-7 w-14 text-11h text-right"
                    />
                  </TableCell>
                  {GRADES.map((g) => (
                    <TableCell dense key={g}>
                      <Input data-row={i} data-field={5 + GRADES.indexOf(g)} value={row.gradingCriteria?.[g] ?? ''} disabled={readOnly} placeholder={`등급 ${g}`} onChange={(e) => patchCriteria(i, g, e.target.value)} className="h-7 text-11h" />
                    </TableCell>
                  ))}
                  <TableCell dense textAlign="center">
                    <Button variant="tab" size="icon-xs" disabled={readOnly} onClick={() => removeRow(i)} aria-label="행 삭제">
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!readOnly && (
        <div className="border-t border-border px-3.5 py-2 bg-card">
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus className="size-3.5" />
            행 추가
          </Button>
        </div>
      )}
    </div>
  );
}
