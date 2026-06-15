'use client';

import type { Grade } from '@/lib/types';
import type { YoyDistRow } from './YoyDistributionGroup';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  secondary: '#0054ca',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#797582',
  outlineVariant: '#cac4d2',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
} as const;

// GRADE_BADGE — 브리프 §4-1 기준 (S=purple, A=blue)
const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#3f2c80', color: '#fff' },
  A: { bg: '#0054ca', color: '#fff' },
  B: { bg: '#4CAF50', color: '#fff' },
  C: { bg: '#FF9800', color: '#fff' },
  D: { bg: '#F44336', color: '#fff' },
};

export interface DistRatioTableProps {
  rows: YoyDistRow[]; // 연도 오름차순
}

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

function ratioOf(row: YoyDistRow, g: Grade): number {
  if (row.ratios && row.ratios[g] != null) return row.ratios[g];
  return row.total > 0 ? (row.counts[g] / row.total) * 100 : 0;
}

const th: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: K.onSurfaceVariant,
  background: K.surfaceLow,
  borderBottom: `1px solid rgba(202,196,210,0.4)`,
  padding: '8px 12px',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  fontSize: 12.5,
  color: K.onSurfaceVariant,
  borderBottom: `1px solid rgba(202,196,210,0.2)`,
  padding: '8px 12px',
  whiteSpace: 'nowrap',
};

const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

// 등급 비율 테이블(결론 시트 재현). 셀 = 인원(비율%). 백엔드 값 표시만.
export function DistRatioTable({ rows }: DistRatioTableProps) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.year - b.year);

  return (
    <div className="w-full overflow-x-auto">
      <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>연도</th>
            <th style={{ ...th, textAlign: 'right' }}>총원</th>
            {GRADES.map((g) => (
              <th key={g} style={{ ...th, textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: GRADE_BADGE[g].bg,
                    color: GRADE_BADGE[g].color,
                    fontWeight: 700,
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {g}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isLatest = i === sorted.length - 1 && sorted.length > 1;
            const yearCell = (
              <td
                style={{
                  ...td,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: K.onSurface,
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {row.year}
                  {isLatest && (
                    <span
                      style={{
                        background: 'rgba(0,84,202,0.12)',
                        color: K.secondary,
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      최근
                    </span>
                  )}
                </span>
              </td>
            );
            return row.missing ? (
              <tr
                key={row.cycleId}
                style={{ background: K.white }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = K.surfaceLow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = K.white; }}
              >
                {yearCell}
                <td
                  colSpan={GRADES.length + 1}
                  style={{ ...td, textAlign: 'left', color: K.outline }}
                >
                  해당 연도 데이터 없음
                </td>
              </tr>
            ) : (
              <tr
                key={row.cycleId}
                style={{ background: K.white }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = K.surfaceLow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = K.white; }}
              >
                {yearCell}
                <td style={{ ...tdNum, color: K.onSurfaceVariant }}>
                  {row.total}명
                </td>
                {GRADES.map((g) => {
                  const pct = ratioOf(row, g);
                  return (
                    <td key={g} style={tdNum}>
                      <span style={{ color: K.onSurface }}>{row.counts[g]}</span>
                      <span style={{ marginLeft: 4, fontSize: 11, color: K.outline }}>
                        ({pct.toFixed(1)}%)
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
