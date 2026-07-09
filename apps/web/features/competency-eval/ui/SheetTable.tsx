'use client';

// 역량평가서 본문 표 — 엑셀 양식 재현:
// 지표(카테고리 rowSpan) | 가중치 | 행동지표 | 본인평가 | 1차평가자 | 2차평가자 | 최종평가자.
// 내 열(myStage)만 편집 가능(1~5 버튼), 나머지 열은 숫자 표시. 문항별 의견 없음(종합의견으로 일원화).
import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { CompetencyQuestion, CompetencyResponse, CompetencyStage } from '../api';
import { gradeToScore } from './useCompetencyForm';

const STAGES: CompetencyStage[] = ['self', 'round1', 'round2', 'round3'];
export const STAGE_LABELS: Record<CompetencyStage, string> = {
  self: '본인평가',
  round1: '1차평가자',
  round2: '2차평가자',
  round3: '최종평가자',
};
export const DEFAULT_SCORE_LABELS = ['매우 그렇지 않다', '그렇지 않다', '보통', '그렇다', '매우 그렇다'];

const th = 'border border-border bg-muted px-2.5 py-2 text-[11.5px] font-semibold text-muted-foreground whitespace-nowrap';
const td = 'border border-border px-2.5 py-2 text-[12.5px] text-foreground align-middle';

interface AnswerDraft {
  score: number;
  comment: string;
}

export function SheetTable({
  questions,
  responses,
  chainNames,
  evaluateeName,
  myStage,
  editable,
  scoresVisible,
  answers,
  setAnswer,
}: {
  questions: CompetencyQuestion[];
  responses: CompetencyResponse[];
  /** 단계별 평가자 이름(미지정 계층은 null). */
  chainNames: Partial<Record<CompetencyStage, string | null>>;
  evaluateeName: string;
  myStage: CompetencyStage | null;
  /** 내 열 편집 가능 여부(단계 게이트·제출 완료 반영). */
  editable: boolean;
  /** 평가자 열 공개 여부(본인 조기열람 게이트). */
  scoresVisible: boolean;
  answers: Record<string, AnswerDraft>;
  setAnswer: (questionId: string, patch: Partial<AnswerDraft>) => void;
}) {
  // stage×question → 응답 조회 맵.
  const byKey = useMemo(() => {
    const map = new Map<string, CompetencyResponse>();
    for (const r of responses) map.set(`${r.stage}:${r.questionId}`, r);
    return map;
  }, [responses]);

  // 카테고리 그룹(문항 순서 유지) — 지표 rowSpan + 카테고리 가중치 합.
  // 카테고리(지표) 그룹 — 연속된 같은 카테고리 문항을 묶어 지표·가중치 셀을 rowSpan 병합.
  const groups = useMemo(() => {
    const list: { name: string; items: CompetencyQuestion[] }[] = [];
    for (const q of questions) {
      const name = q.categoryName ?? q.categoryId;
      const last = list[list.length - 1];
      if (last && last.name === name) last.items.push(q);
      else list.push({ name, items: [q] });
    }
    return list;
  }, [questions]);

  // 가중치 표시 모드 자동 판별 — 두 데이터 모델을 모두 지원:
  //  (A) 카테고리 가중치 반복형(엑셀/2025): 한 카테고리의 문항이 모두 같은 가중치(=카테고리 가중치).
  //      카테고리별 대표값 합이 100 → 대표값(첫 문항 가중치)을 그대로 표시.
  //  (B) 문항 분할형(2026 시드): 문항당 가중치가 카테고리 총합의 조각(합쳐야 카테고리 가중치).
  //      전체 문항 가중치 합이 100 → 그룹 내 합산을 표시.
  // 100 에 더 가까운 쪽을 채택(둘 다 아니면 합산 폴백). 점수 환산은 백엔드가 별도 계산.
  const weightForGroup = useMemo(() => {
    const singleTotal = groups.reduce((s, g) => s + (g.items[0]?.weight ?? 0), 0);
    const sumTotal = groups.reduce((s, g) => s + g.items.reduce((a, q) => a + q.weight, 0), 0);
    const useSingle = Math.abs(singleTotal - 100) <= Math.abs(sumTotal - 100);
    return (g: { items: CompetencyQuestion[] }) =>
      useSingle ? (g.items[0]?.weight ?? 0) : g.items.reduce((a, q) => a + q.weight, 0);
  }, [groups]);

  const scoreOf = (stage: CompetencyStage, questionId: string): number => {
    if (stage === myStage) return answers[questionId]?.score ?? 0;
    const r = byKey.get(`${stage}:${questionId}`);
    return r ? gradeToScore(r.grade) : 0;
  };
  const stageHidden = (stage: CompetencyStage) => stage !== 'self' && !scoresVisible && stage !== myStage;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-elev-1">
      <table className="w-full border-collapse" style={{ minWidth: 880 }}>
        <thead>
          <tr>
            <th className={`${th} w-[88px] text-center`}>지표</th>
            <th className={`${th} w-[64px] text-center`}>가중치</th>
            <th className={`${th} text-left`}>행동지표</th>
            {STAGES.map((stage) => (
              <th key={stage} className={`${th} w-[104px] text-center`}>
                <div>{STAGE_LABELS[stage]}</div>
                <div className="mt-0.5 text-[10.5px] font-medium text-muted-foreground/80">
                  {stage === 'self'
                    ? evaluateeName
                    : stageHidden(stage)
                      ? '완료 후 공개'
                      : (chainNames[stage] ?? '—')}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const groupWeight = weightForGroup(g);
            return g.items.map((q, qi) => {
              const labels = q.options && q.options.length === 5 ? q.options : DEFAULT_SCORE_LABELS;
              return (
                <tr key={q.id} className="bg-card">
                  {qi === 0 && (
                    <>
                      <td rowSpan={g.items.length} className={`${td} bg-muted/40 text-center text-[12px] font-semibold`}>
                        <span className="break-keep">{g.name}</span>
                      </td>
                      <td rowSpan={g.items.length} className={`${td} bg-muted/40 text-center tabular-nums font-semibold`}>
                        {groupWeight > 0 ? `${groupWeight}%` : '-'}
                      </td>
                    </>
                  )}
                  <td className={`${td} text-left`}>
                    <span className="leading-snug">{q.text}</span>
                    {q.hint && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{q.hint}</span>
                    )}
                  </td>
                  {STAGES.map((stage) => {
                    const isMine = stage === myStage;
                    if (stageHidden(stage)) {
                      return (
                        <td key={stage} className={`${td} bg-muted/30 text-center text-muted-foreground`}>
                          <Lock size={12} aria-hidden className="mx-auto opacity-50" />
                        </td>
                      );
                    }
                    if (isMine && editable) {
                      const cur = answers[q.id]?.score ?? 0;
                      return (
                        <td key={stage} className={`${td} bg-primary/[0.04] px-1.5 text-center`}>
                          <div className="inline-flex gap-0.5" role="radiogroup" aria-label={`${q.text} 점수`}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                role="radio"
                                aria-checked={cur === s}
                                title={labels[s - 1]}
                                onClick={() => setAnswer(q.id, { score: s })}
                                className={`h-6 w-[17px] rounded-sm border text-[11px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  cur === s
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    }
                    const v = scoreOf(stage, q.id);
                    return (
                      <td
                        key={stage}
                        className={`${td} text-center tabular-nums font-semibold ${isMine ? 'bg-primary/[0.04]' : ''} ${v === 0 ? 'text-muted-foreground' : ''}`}
                      >
                        {v > 0 ? v : '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
