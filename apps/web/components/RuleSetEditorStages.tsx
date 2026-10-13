'use client';

import { cn } from '@/lib/utils';
import type { RuleSetDraft } from './RuleSetEditorModel';
import { Stepper } from './RuleSetEditorStepper';

// 다단계 평가 가중치 — 1차/2차/최종 단계 가중 + 최종점수 실적/역량 가중(편집).
export function MultiStageWeights({
  value,
  onChange,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
}) {
  const sw = value.stageWeights;
  const pc = value.perfCompWeights;
  // 표시·입력은 %(정수), 내부 저장은 0~1 소수 유지(계약 불변).
  const toPct = (n: number) => Math.round(n * 100);
  const stagePctSum = toPct(sw.teamLeader) + toPct(sw.divisionHead) + toPct(sw.ceo);
  const pcPctSum = toPct(pc.perf) + toPct(pc.comp);
  const stageBad = stagePctSum !== 100;
  const pcBad = pcPctSum !== 100;
  const setStage = (f: 'teamLeader' | 'divisionHead' | 'ceo', pctN: number | null) =>
    onChange({ ...value, stageWeights: { ...sw, [f]: (pctN ?? 0) / 100 } });
  const setPC = (f: 'perf' | 'comp', pctN: number | null) =>
    onChange({ ...value, perfCompWeights: { ...pc, [f]: (pctN ?? 0) / 100 } });

  const pctField = (
    label: string,
    v: number,
    on: (n: number | null) => void,
    bad: boolean,
  ) => (
    <div className="flex items-center gap-1.5">
      <span className="text-12h text-neutral-700">{label}</span>
      <Stepper
        ariaLabel={`${label} 가중치`}
        value={toPct(v)}
        onChange={on}
        step={5}
        min={0}
        max={100}
        suffix="%"
        className="w-29"
        invalid={bad}
      />
    </div>
  );

  const sumText = (sum: number, bad: boolean) => (
    <span
      className={cn(
        'text-11h font-semibold',
        bad ? 'text-danger-600' : 'text-success-600',
      )}
    >
      합 {sum}%{bad ? ' — 100%가 되어야 해요' : ''}
    </span>
  );

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="text-13 font-bold text-foreground">다단계 평가 가중치</div>
      <p className="text-11h leading-normal text-neutral-500">
        합산점수 = 1차×가중 + 2차×가중 + 최종×가중(없는 단계는 제외 후 재정규화). 최종점수 = 합산실적×실적 + 합산역량×역량.
        <br />역량 가중은 기본 0%(등급 미반영·참고용)이에요. 예외: 1차=최종평가자 → 1차 100%, 2차=최종평가자 → 1차 70% + 최종 30%로 자동 적용돼요.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {pctField('1차·팀장', sw.teamLeader, (n) => setStage('teamLeader', n), stageBad)}
        {pctField('2차·본부장', sw.divisionHead, (n) => setStage('divisionHead', n), stageBad)}
        {pctField('최종·대표', sw.ceo, (n) => setStage('ceo', n), stageBad)}
        {sumText(stagePctSum, stageBad)}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        {pctField('실적', pc.perf, (n) => setPC('perf', n), pcBad)}
        {pctField('역량', pc.comp, (n) => setPC('comp', n), pcBad)}
        {sumText(pcPctSum, pcBad)}
      </div>
    </div>
  );
}
