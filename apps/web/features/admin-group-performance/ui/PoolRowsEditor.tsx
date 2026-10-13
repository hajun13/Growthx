'use client';

// 전사 등급풀 상한 인원 편집 — 등급별 [-] 슬라이더 [+] 숫자입력.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GradeChip } from '@/components/GradeChip';
import type { Grade } from '@/lib/types';

export type PoolRow = { grade: Grade; count: number };

// 슬라이더 accent 색 — 등급 Solid 색(정적 클래스 룩업).
const ACCENT: Record<Grade, string> = {
  S: 'accent-grade-s',
  A: 'accent-grade-a',
  B: 'accent-grade-b',
  C: 'accent-grade-c',
  D: 'accent-grade-d',
};

export function PoolRowsEditor({
  rows,
  headcount,
  countSum,
  countDelta,
  editable,
  onSet,
  onAdjust,
}: {
  rows: PoolRow[];
  headcount: number;
  countSum: number;
  countDelta: number;
  editable: boolean;
  onSet: (grade: Grade, value: number) => void;
  onAdjust: (grade: Grade, delta: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div
        className={
          countSum === headcount
            ? 'flex flex-wrap items-center justify-between gap-2 text-12 text-muted-foreground'
            : 'flex flex-wrap items-center justify-between gap-2 text-12 font-semibold text-danger-600'
        }
      >
        <span>합계 {countSum}명 / 전사 모수 {headcount}명</span>
        <span>
          {countDelta === 0 ? '저장 가능' : `${countDelta > 0 ? '부족' : '초과'} ${Math.abs(countDelta)}명`}
        </span>
      </div>
      {rows.map((row) => {
        const pct = headcount > 0 ? Math.round((row.count / headcount) * 1000) / 10 : 0;
        return (
          <div key={row.grade} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <GradeChip grade={row.grade} />
              <div className="min-w-27.5 text-12 text-muted-foreground">
                상한 {row.count}명 · {pct}%
              </div>
              <div className="flex min-w-55 flex-1 items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!editable}
                  onClick={() => onAdjust(row.grade, -1)}
                  aria-label={`${row.grade}등급 1명 감소`}
                >
                  -
                </Button>
                {/* eslint-disable-next-line no-restricted-syntax -- L1 에 Slider 가 없음(range 입력) */}
                <input
                  type="range"
                  min={0}
                  max={headcount}
                  value={row.count}
                  disabled={!editable}
                  onChange={(event) => onSet(row.grade, Number(event.target.value))}
                  className={`min-w-0 flex-1 ${ACCENT[row.grade]}`}
                  aria-label={`${row.grade}등급 상한 인원`}
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!editable}
                  onClick={() => onAdjust(row.grade, 1)}
                  aria-label={`${row.grade}등급 1명 증가`}
                >
                  +
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <PoolCountInput
                  grade={row.grade}
                  value={row.count}
                  max={headcount}
                  disabled={!editable}
                  onCommit={(n) => onSet(row.grade, n)}
                />
                <span className="text-12 text-muted-foreground">명</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 상한 인원 숫자 입력 — 로컬 문자열 상태 + blur 시 파싱.
 * 입력 중 지우기(빈 값)가 즉시 0 으로 강제되지 않게 하고, blur 시점에만 확정한다.
 */
function PoolCountInput({
  grade,
  value,
  max,
  disabled,
  onCommit,
}: {
  grade: Grade;
  value: number;
  max: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(0, Math.min(max, Math.round(n)));
    onCommit(clamped);
    setText(String(clamped));
  }

  return (
    <Input
      type="number"
      min={0}
      max={max}
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
      className="h-8 w-20 text-right text-13 font-bold tabular-nums"
      aria-label={`${grade}등급 상한 인원 숫자 입력`}
    />
  );
}
