'use client';

import { Check } from 'lucide-react';
import { T, gradeChipColor } from '@/lib/toss';
import type { Kpi, Grade } from '@/lib/types';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

/**
 * 정성(qualitative) KPI 자기평가용 등급 선택 피커.
 * 본인이 KPI 작성 시 세운 등급 기준(gradingCriteria S~D)을 행으로 펼치고,
 * 해당하는 등급 행을 직접 클릭해 선택한다. 선택값은 directGrade 로 전송된다.
 */
export function GradeCriteriaPicker({
  kpi,
  value,
  onSelect,
  readOnly,
}: {
  kpi: Kpi;
  value?: Grade;
  onSelect: (g: Grade) => void;
  readOnly?: boolean;
}) {
  const gc = kpi.gradingCriteria;
  return (
    <div>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.grey800 }}>등급 부여 기준</span>
        <span style={{ fontSize: 11, color: T.grey500 }}>
          {readOnly ? '· 선택한 등급' : '· 달성한 등급의 기준을 눌러 선택하세요'}
        </span>
      </div>
      <div className="space-y-1.5">
        {GRADE_ORDER.map((g) => {
          const text = (gc?.[g] ?? '').trim();
          const selected = value === g;
          const c = gradeChipColor[g] ?? gradeChipColor.B;
          return (
            <button
              key={g}
              type="button"
              disabled={readOnly}
              onClick={() => onSelect(g)}
              aria-pressed={selected}
              className="flex w-full items-center gap-2.5 text-left transition-colors"
              style={{
                padding: '8px 10px',
                border: selected ? `1.5px solid ${c.bg}` : `1px solid ${T.grey200}`,
                background: selected ? `${c.bg}12` : '#fff',
                cursor: readOnly ? 'default' : 'pointer',
                opacity: readOnly && !selected ? 0.55 : 1,
              }}
            >
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 24,
                  height: 24,
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: selected ? c.bg : T.grey100,
                  color: selected ? c.color : T.grey600,
                }}
              >
                {g}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: text ? (selected ? T.grey900 : T.grey700) : T.grey400,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {text || '기준 미작성'}
              </span>
              {selected && <Check size={16} color={c.bg} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
