'use client';

// ④-6 RebaselineTable — 재조정 편집 표.
// [과제명(+group/정성 칩) / 현재 목표·가중치 / → 새 목표·가중치].
// 변경 셀은 RebaselineChangedCell 로 강조. 사유는 전체 reason(편집 본문 하단)만 전송·기록한다.
//   행별 사유 입력칸은 전송·저장되지 않아 혼동을 유발하므로 제거했다(MINOR-3).
// 편집 불가: 과제명·group·measureType·정성토글(KPI 정체성). 합 검증은 WeightSummaryBar 집계.
import { groupChip, T } from '@/lib/toss';
import { fmtAmount, fmtPercent, kpiGroupLabel, measureTypeUnit } from '@/lib/ui';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/States';
import { RebaselineChangedCell } from './RebaselineChangedCell';
import type { KpiGroup, MeasureType } from '@/lib/types';

// ④-0 편집 행(현재 확정 KPI + 새 값) — 프론트 로컬 상태(계약 타입 아님).
export interface RebaselineRow {
  kpiId: string;
  title: string;
  group: KpiGroup;
  measureType: MeasureType;
  isQualitative: boolean;
  // 현재(확정) 값 = 비교 기준(원본).
  currentTargetValue: number | null;
  currentTargetText: string | null;
  currentWeight: number;
  // 편집 중인 새 값(초기 = 현재값 복사).
  nextTargetValue: number | null;
  nextTargetText: string | null;
  nextWeight: number;
}

// 변경 여부(목표값/목표서술/가중치 중 하나라도 원본과 다르면 true).
export function isRowChanged(r: RebaselineRow): boolean {
  return (
    r.nextTargetValue !== r.currentTargetValue ||
    r.nextTargetText !== r.currentTargetText ||
    r.nextWeight !== r.currentWeight
  );
}

function fmtCurrentTarget(r: RebaselineRow): string {
  if (r.isQualitative || r.measureType === 'qualitative') {
    return r.currentTargetText ?? '–';
  }
  if (r.currentTargetValue === null) return '–';
  if (r.measureType === 'amount') return fmtAmount(r.currentTargetValue);
  if (r.measureType === 'rate') return fmtPercent(r.currentTargetValue);
  return `${r.currentTargetValue.toLocaleString('ko-KR')}건`;
}

export interface RebaselineTableProps {
  rows: RebaselineRow[];
  onChange: (kpiId: string, patch: Partial<RebaselineRow>) => void;
  readOnly?: boolean;
  // NOTE: 백엔드가 향후 details 로 kpiId별 에러를 줄 여지가 있으면 여기에 rowErrors 를 다시 배선.
  //   현재 계약(§7)은 행 단위 에러를 반환하지 않아 미사용 → dead UI 제거(MINOR-3).
}

const thStyle: React.CSSProperties = {
  background: T.grey50,
  fontSize: 11.5,
  fontWeight: 600,
  color: T.grey600,
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: `1px solid ${T.grey200}`,
  whiteSpace: 'nowrap',
};

export function RebaselineTable({
  rows,
  onChange,
  readOnly,
}: RebaselineTableProps) {
  if (rows.length === 0) {
    return <EmptyState title="이 구성원의 확정 KPI가 없어요." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>과제명</th>
            <th style={thStyle}>현재 목표</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>현재 가중치</th>
            <th style={thStyle}>→ 새 목표</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>새 가중치</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const qual = r.isQualitative || r.measureType === 'qualitative';
            const targetChanged = qual
              ? r.nextTargetText !== r.currentTargetText
              : r.nextTargetValue !== r.currentTargetValue;
            const weightChanged = r.nextWeight !== r.currentWeight;
            const unit = measureTypeUnit[r.measureType];
            const chip = groupChip[r.group];

            return (
              <tr key={r.kpiId} style={{ borderBottom: `1px solid ${T.grey200}` }}>
                {/* 과제명 + 칩 */}
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
                    {r.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: chip?.bg ?? T.grey300,
                        color: chip?.color ?? '#fff',
                        padding: '1px 6px',
                      }}
                    >
                      {kpiGroupLabel[r.group]}
                    </span>
                    {qual && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          background: T.grey100,
                          color: T.grey600,
                          padding: '1px 6px',
                        }}
                      >
                        정성
                      </span>
                    )}
                  </span>
                </td>

                {/* 현재 목표(읽기전용 비교 기준) */}
                <td
                  style={{
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: T.grey500,
                    verticalAlign: 'top',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtCurrentTarget(r)}
                </td>

                {/* 현재 가중치 */}
                <td
                  style={{
                    padding: '8px 10px',
                    fontSize: 12.5,
                    color: T.grey500,
                    textAlign: 'right',
                    verticalAlign: 'top',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.currentWeight}%
                </td>

                {/* 새 목표(입력) */}
                <td style={{ padding: '4px 6px', verticalAlign: 'top', minWidth: 160 }}>
                  <RebaselineChangedCell changed={targetChanged}>
                    {qual ? (
                      <Textarea
                        aria-label={`${r.title} 새 목표`}
                        rows={2}
                        value={r.nextTargetText ?? ''}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChange(r.kpiId, {
                            nextTargetText: e.target.value === '' ? null : e.target.value,
                          })
                        }
                        className="resize-y text-[12.5px]"
                        placeholder="새 목표 서술"
                      />
                    ) : (
                      <span className="relative flex items-center">
                        <Input
                          type="number"
                          inputMode="decimal"
                          aria-label={`${r.title} 새 목표`}
                          value={r.nextTargetValue ?? ''}
                          readOnly={readOnly}
                          disabled={readOnly}
                          min={0}
                          onChange={(e) => {
                            const v = e.target.value;
                            onChange(r.kpiId, {
                              nextTargetValue: v === '' ? null : Number(v),
                            });
                          }}
                          className="text-right text-[12.5px] tabular-nums"
                        />
                        {unit && (
                          <span
                            className="pointer-events-none absolute right-2"
                            style={{ fontSize: 11, color: T.grey500 }}
                          >
                            {unit}
                          </span>
                        )}
                      </span>
                    )}
                    {/* amount 미리보기(억/만 환산) */}
                    {!qual &&
                      r.measureType === 'amount' &&
                      r.nextTargetValue !== null && (
                        <span
                          className="mt-0.5 block"
                          style={{ fontSize: 10.5, color: T.grey500 }}
                        >
                          ≈ {fmtAmount(r.nextTargetValue)}
                        </span>
                      )}
                  </RebaselineChangedCell>
                </td>

                {/* 새 가중치(입력) */}
                <td style={{ padding: '4px 6px', verticalAlign: 'top', width: 96 }}>
                  <RebaselineChangedCell changed={weightChanged}>
                    <span className="relative flex items-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        aria-label={`${r.title} 새 가중치`}
                        value={Number.isFinite(r.nextWeight) ? r.nextWeight : ''}
                        readOnly={readOnly}
                        disabled={readOnly}
                        min={0}
                        max={100}
                        onChange={(e) => {
                          const v = e.target.value;
                          onChange(r.kpiId, {
                            nextWeight: v === '' ? 0 : Math.round(Number(v)),
                          });
                        }}
                        className="pr-7 text-right text-[12.5px] tabular-nums"
                      />
                      <span
                        className="pointer-events-none absolute right-2"
                        style={{ fontSize: 11, color: T.grey500 }}
                      >
                        %
                      </span>
                    </span>
                  </RebaselineChangedCell>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
