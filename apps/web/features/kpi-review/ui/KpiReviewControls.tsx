'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kpiCategoryLabel } from '@/lib/ui';

export type KpiSortMode = 'weight' | 'default';

// ── 카테고리 필터 탭 + 정렬 (시안 image 5) ──────────────────────────
export function CategoryFilterBar({
  catFilter,
  onCatFilter,
  total,
  catChips,
  allCollapsed,
  onToggleAll,
  sortMode,
  onSortMode,
}: {
  catFilter: string;
  onCatFilter: (cat: string) => void;
  total: number;
  catChips: { cat: string; n: number }[];
  allCollapsed: boolean;
  onToggleAll: () => void;
  sortMode: KpiSortMode;
  onSortMode: (m: KpiSortMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={catFilter === 'all' ? 'default' : 'outline'}
        onClick={() => onCatFilter('all')}
      >
        전체 ({total})
      </Button>
      {catChips.map(({ cat, n }) => (
        <Button
          key={cat}
          size="sm"
          variant={catFilter === cat ? 'default' : 'outline'}
          onClick={() => onCatFilter(cat)}
        >
          {kpiCategoryLabel[cat as keyof typeof kpiCategoryLabel] ?? cat} ({n})
        </Button>
      ))}
      <Button size="sm" variant="outline" className="ml-auto" onClick={onToggleAll}>
        {allCollapsed ? '모두 펼치기' : '모두 접기'}
      </Button>
      <Select value={sortMode} onValueChange={(v) => onSortMode(v as KpiSortMode)}>
        <SelectTrigger size="sm" aria-label="정렬 기준" className="w-28 text-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="weight">가중치 순</SelectItem>
          <SelectItem value="default">등록 순</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── 일괄 승인 확인 ───────────────────────────────────────────────────
export function BulkApproveDialog({
  open,
  count,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="sm" layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>내 차례 항목을 일괄 승인할까요?</DialogTitle>
        </DialogHeader>
        <p className="min-h-0 overflow-y-auto text-13 leading-relaxed text-muted-foreground">
          지금 내 승인 차례인 <b className="text-foreground">{count}건</b>을 순서대로 승인해요.
          마지막 단계 항목은 곧바로 확정되고, 반려·수정요청이 필요한 항목이 있다면 취소 후 개별 처리해 주세요.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button loading={busy} onClick={onConfirm}>
            {count}건 일괄 승인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
