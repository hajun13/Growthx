'use client';

// FIN(calibration/closed) 보완 조치 참고 패널 — component-spec-midterm §8.
// 최종 결과 화면 하단 참고 패널. "참고용 · 등급 미반영" 톤. 이행률은 표시만(등급 미반영).
import { Card } from './Card';
import { ActionItemRow } from './ActionItemRow';
import { EmptyState } from './States';
import { actionItemStatusLabel } from '@/lib/ui';
import { T } from '@/lib/palette';
import type { ActionItem, ActionItemStatus } from '@/lib/types';

export interface MidtermActionPanelProps {
  items: ActionItem[];
  // 본인 결과면 빈 상태도 노출, 타인이면 items 0 일 때 패널 자체 숨김.
  showWhenEmpty?: boolean;
}

const ORDER: ActionItemStatus[] = ['done', 'in_progress', 'planned', 'canceled'];

export function MidtermActionPanel({ items, showWhenEmpty }: MidtermActionPanelProps) {
  if (items.length === 0 && !showWhenEmpty) return null;

  const counts: Record<ActionItemStatus, number> = {
    planned: 0,
    in_progress: 0,
    done: 0,
    canceled: 0,
  };
  for (const it of items) counts[it.status] += 1;

  const summaryLine = ORDER.map((s) => `${actionItemStatusLabel[s]} ${counts[s]}`).join(
    ' · ',
  );

  return (
    <Card
      title="중간 보완 조치 이행 현황"
      action={
        <span
          className="font-medium"
          style={{ background: T.grey100, color: T.grey600, fontSize: 11, padding: '2px 8px' }}
          aria-label="참고용, 등급에 반영되지 않음"
        >
          참고용 · 등급 미반영
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <EmptyState title="6월 중간 점검에서 등록된 보완 조치가 없어요." />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {items.map((it) => (
                <ActionItemRow key={it.id} item={it} mode="readonly" />
              ))}
            </div>
            <p style={{ fontSize: 12, color: T.grey600 }}>
              {summaryLine} <span style={{ color: T.grey400 }}>(총 {items.length}건)</span>
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
