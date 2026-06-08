'use client';

// ④-3 RebaselineDiffRow — diff 한 줄(before → after).
// 변경=primary 계열(after primary-600, before neutral-500). 등급색 grade-* 와 의도적 분리.
// 계약(§7) RebaselineKpiChange.fields(RebaselineFieldChange[]) 를 사람이 읽는 라벨/값으로 표시.
import { T } from '@/lib/toss';
import { fmtAmount, fmtPercent } from '@/lib/ui';
import type {
  RebaselineFieldChange,
  RebaselineField,
  MeasureType,
} from '@/lib/types';

const PRIMARY = '#1b64da'; // primary-600
const BEFORE = '#8b95a1'; // neutral-500

const fieldLabel: Record<RebaselineField, string> = {
  targetValue: '목표',
  targetText: '목표',
  weight: '가중치',
};

// 측정방식에 맞춰 before/after 값을 표시 문자열로(백엔드 값 그대로 — 재계산 아님).
function fmtFieldValue(
  field: RebaselineField,
  v: number | string | null,
  measureType?: MeasureType,
): string {
  if (v === null || v === undefined || v === '') return '–';
  if (field === 'weight') return `${v}%`;
  if (field === 'targetText') return String(v);
  // targetValue: 측정방식별 단위.
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  if (measureType === 'amount') return fmtAmount(n);
  if (measureType === 'rate') return fmtPercent(n);
  if (measureType === 'count') return `${n.toLocaleString('ko-KR')}건`;
  return n.toLocaleString('ko-KR');
}

export interface RebaselineDiffRowProps {
  title: string; // KPI 과제명
  fields: RebaselineFieldChange[];
  measureType?: MeasureType;
}

export function RebaselineDiffRow({
  title,
  fields,
  measureType,
}: RebaselineDiffRowProps) {
  return (
    <div
      className="flex flex-col gap-1 py-1.5"
      style={{ borderBottom: `1px solid ${T.grey100}` }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>
        {title}
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {fields.map((f, i) => {
          const before = fmtFieldValue(f.field, f.before, measureType);
          const after = fmtFieldValue(f.field, f.after, measureType);
          return (
            <span
              key={`${f.field}-${i}`}
              className="inline-flex items-center gap-1"
              style={{ fontSize: 12 }}
              aria-label={`${fieldLabel[f.field]} ${before}에서 ${after}로 변경`}
            >
              <span style={{ color: T.grey600, fontSize: 11 }}>
                {fieldLabel[f.field]}
              </span>
              <span style={{ color: BEFORE }} title={before}>
                {before}
              </span>
              <span aria-hidden style={{ color: PRIMARY, fontWeight: 700 }}>
                →
              </span>
              <span style={{ color: PRIMARY, fontWeight: 600 }} title={after}>
                {after}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
