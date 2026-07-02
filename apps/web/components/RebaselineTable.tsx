'use client';

// ④-6 RebaselineTable — 재조정 편집 표.
// [과제명(+group/정성 칩) / 현재 목표·가중치(muted 참고값) / → 새 목표·가중치(주 입력)].
// 변경 셀은 RebaselineChangedCell 로 강조. 사유는 전체 reason(편집 본문 하단)만 전송·기록한다.
//   행별 사유 입력칸은 전송·저장되지 않아 혼동을 유발하므로 제거했다(MINOR-3).
// 편집 불가: 과제명·group·measureType·정성토글(KPI 정체성). 합 검증은 WeightSummaryBar 집계.
import { groupChip, T } from '@/lib/palette';
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
}

export function RebaselineTable({
  rows,
  onChange,
  readOnly,
}: RebaselineTableProps) {
  if (rows.length === 0) {
    return <EmptyState title="이 구성원의 확정 KPI가 없어요." />;
  }

  return (
    <div className="overflow-x-auto rounded-none border border-border">
      {/* %-기반 고정 비율 열 — 컨테이너(모달 lg 포함)가 좁아도 넘치지 않고 비율로 맞춘다 */}
      <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '31%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr className="bg-muted border-b border-border">
            {/* 과제명 */}
            <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              과제명
            </th>
            {/* 현재 열 — 참고값 */}
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              현재 목표
            </th>
            <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              가중치
            </th>
            {/* 새 값 열 — 주(主) */}
            <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-foreground whitespace-nowrap">
              새 목표
            </th>
            <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold text-foreground whitespace-nowrap">
              새 가중치
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const qual = r.isQualitative || r.measureType === 'qualitative';
            const targetChanged = qual
              ? r.nextTargetText !== r.currentTargetText
              : r.nextTargetValue !== r.currentTargetValue;
            const weightChanged = r.nextWeight !== r.currentWeight;
            const rowChanged = targetChanged || weightChanged;
            const unit = measureTypeUnit[r.measureType];
            const chip = groupChip[r.group];

            return (
              <tr
                key={r.kpiId}
                className={[
                  idx < rows.length - 1 ? 'border-b border-border/60' : '',
                  rowChanged ? 'bg-neutral-50/60' : '',
                ].join(' ')}
              >
                {/* 과제명 + 칩 */}
                <td className="px-3.5 py-3 align-top">
                  <span className="block text-[13px] font-semibold text-foreground leading-snug">
                    {r.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      className="rounded-pill px-1.5 py-0 text-[10px] font-semibold leading-[16px]"
                      style={{
                        background: chip?.bg ?? T.grey300,
                        color: chip?.color ?? '#fff',
                      }}
                    >
                      {kpiGroupLabel[r.group]}
                    </span>
                    {qual && (
                      <span className="rounded-pill bg-neutral-100 px-1.5 py-0 text-[10px] font-medium leading-[16px] text-muted-foreground">
                        정성
                      </span>
                    )}
                  </span>
                </td>

                {/* 현재 목표(참고값 — 읽히는 회색) */}
                <td className="px-3 py-3 align-top text-[12px] leading-relaxed tabular-nums text-muted-foreground">
                  {fmtCurrentTarget(r)}
                </td>

                {/* 현재 가중치(참고값) */}
                <td className="px-3 py-3 align-top text-right text-[12px] tabular-nums text-muted-foreground">
                  {r.currentWeight}%
                </td>

                {/* 새 목표(입력 — 주) */}
                <td className="px-2 py-2 align-top">
                  <RebaselineChangedCell changed={targetChanged}>
                    {qual ? (
                      <Textarea
                        aria-label={`${r.title} 새 목표`}
                        rows={3}
                        value={r.nextTargetText ?? ''}
                        readOnly={readOnly}
                        disabled={readOnly}
                        onChange={(e) =>
                          onChange(r.kpiId, {
                            nextTargetText: e.target.value === '' ? null : e.target.value,
                          })
                        }
                        className="resize-y text-[13px] leading-relaxed"
                        placeholder="새 목표 서술"
                      />
                    ) : (
                      <span className="flex items-center gap-1.5">
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
                          className="text-right text-[13px] tabular-nums"
                        />
                        {unit && (
                          <span className="shrink-0 text-[12px] text-muted-foreground">
                            {unit}
                          </span>
                        )}
                      </span>
                    )}
                    {/* amount 미리보기(억/만 환산) */}
                    {!qual &&
                      r.measureType === 'amount' &&
                      r.nextTargetValue !== null && (
                        <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                          ≈ {fmtAmount(r.nextTargetValue)}
                        </span>
                      )}
                  </RebaselineChangedCell>
                </td>

                {/* 새 가중치(입력 — 주) — % 는 입력칸 밖에 두어 숫자가 가려지지 않게 */}
                <td className="px-2 py-2 align-top">
                  <RebaselineChangedCell changed={weightChanged}>
                    <div className="flex items-center gap-1.5">
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
                        className="text-right text-[13px] tabular-nums"
                      />
                      <span className="shrink-0 text-[12px] text-muted-foreground">%</span>
                    </div>
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
