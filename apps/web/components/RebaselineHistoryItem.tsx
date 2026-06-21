'use client';

// ④-4 RebaselineHistoryItem — 재조정 1회(=스냅샷 1개). 사유·변경자·시각 + diff.
// 계약 §7: 전용 history 엔드포인트가 changed(diff)·reason·createdBy·createdAt 를 직접 반환.
//   → 제네릭 KpiSnapshot diff 지연 로드 불필요(entry.changed 를 그대로 렌더).
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { T } from '@/lib/palette';
import { RebaselineDiffRow } from './RebaselineDiffRow';
import type { RebaselineHistoryEntry, MeasureType } from '@/lib/types';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface RebaselineHistoryItemProps {
  entry: RebaselineHistoryEntry;
  defaultOpen?: boolean;
  // KPI 별 측정방식(목표값 단위 표기용). 없으면 plain 숫자.
  measureTypeByKpiId?: Record<string, MeasureType>;
}

export function RebaselineHistoryItem({
  entry,
  defaultOpen,
  measureTypeByKpiId,
}: RebaselineHistoryItemProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const changed = entry.changed ?? [];
  // MINOR-1: 실행자 표시명은 백엔드가 해석한 createdByName 을 직접 사용
  // (기존: 피평가자 후보 맵으로 userId 해석 → 실행자가 후보 밖이면 raw userId 노출).
  const actor = entry.createdByName || entry.createdBy || '(알 수 없음)';

  return (
    <div style={{ border: '1px solid rgba(204,204,212,0.5)', borderRadius: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
        style={{ background: T.grey50, borderBottom: open ? `1px solid ${T.grey200}` : 'none' }}
      >
        <span aria-hidden className="mt-0.5">
          {open ? (
            <ChevronDown size={14} color={T.grey500} />
          ) : (
            <ChevronRight size={14} color={T.grey500} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              aria-hidden
              style={{ width: 6, height: 6, background: T.blue500, display: 'inline-block' }}
            />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}>
              {fmtDateTime(entry.createdAt)}
            </span>
            <span style={{ fontSize: 11.5, color: T.grey600 }}>· {actor}</span>
            <span
              className="ml-auto"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: T.grey600,
                background: T.grey100,
                padding: '1px 6px',
              }}
            >
              되돌릴 수 없음
            </span>
          </span>
          <span
            className="mt-1 block whitespace-pre-wrap"
            style={{ fontSize: 12, color: entry.reason ? T.grey700 : T.grey400, lineHeight: 1.5 }}
          >
            사유: {entry.reason ? `"${entry.reason}"` : '(사유 미기록)'}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-3 py-2">
          {changed.length === 0 ? (
            <p style={{ fontSize: 12, color: T.grey500 }}>변경 항목 없음</p>
          ) : (
            changed.map((c) => (
              <RebaselineDiffRow
                key={c.kpiId}
                title={c.title}
                fields={c.fields}
                measureType={measureTypeByKpiId?.[c.kpiId]}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
