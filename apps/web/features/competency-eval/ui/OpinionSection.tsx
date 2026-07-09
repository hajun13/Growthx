'use client';

// [종합의견] + 평가점수 환산 블록 — 엑셀 역량평가서 하단 재현.
// 1차/2차/최종 평가자별 자유 서술(내 단계만 편집) + 우측 환산 점수(rowSpan).
import { Lock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { CompetencyOpinion, CompetencySheet, CompetencyStage } from '../api';
import { STAGE_LABELS } from './SheetTable';

const OPINION_STAGES: CompetencyStage[] = ['round1', 'round2', 'round3'];

const th = 'border border-border bg-muted px-2.5 py-2 text-[11.5px] font-semibold text-muted-foreground whitespace-nowrap';
const td = 'border border-border px-3 py-2.5 text-[12.5px] text-foreground align-middle';

const MODE_NOTE: Record<string, string> = {
  exception1: '평가자 동일인 예외 적용 — 1차평가 100% 반영',
  exception2: '평가자 동일인 예외 적용 — 1차평가 70% + 최종평가 30% 반영',
};

export function OpinionSection({
  opinions,
  chainNames,
  myStage,
  editable,
  opinionDraft,
  setOpinionText,
  conversion,
  scoresVisible,
}: {
  opinions: CompetencyOpinion[];
  chainNames: Partial<Record<CompetencyStage, string | null>>;
  myStage: CompetencyStage | null;
  editable: boolean;
  opinionDraft: string;
  setOpinionText: (text: string) => void;
  conversion: CompetencySheet['conversion'];
  scoresVisible: boolean;
}) {
  const opinionOf = (stage: CompetencyStage) =>
    opinions.find((o) => o.stage === stage)?.comment ?? '';
  const perStage = conversion
    ? ([
        ['1차', conversion.round1],
        ['2차', conversion.round2],
        ['최종', conversion.round3],
      ] as const)
    : [];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-elev-1">
      <table className="w-full border-collapse" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th className={`${th} w-[112px] text-center`}>[종합의견]</th>
            <th className={`${th} text-left`} aria-label="의견" />
            <th className={`${th} w-[180px] text-center`}>평가점수 환산</th>
          </tr>
        </thead>
        <tbody>
          {OPINION_STAGES.map((stage, i) => {
            const isMine = stage === myStage;
            const name = chainNames[stage];
            return (
              <tr key={stage}>
                <td className={`${td} bg-muted/40 text-center`}>
                  <div className="text-[12px] font-semibold">{STAGE_LABELS[stage]}</div>
                  {name && <div className="mt-0.5 text-[11px] text-muted-foreground">{name}</div>}
                </td>
                <td className={td}>
                  {isMine && editable ? (
                    <Textarea
                      value={opinionDraft}
                      onChange={(e) => setOpinionText(e.target.value)}
                      placeholder="종합의견을 작성하세요."
                      className="min-h-[72px] resize-none bg-card text-xs"
                    />
                  ) : !scoresVisible && !isMine ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Lock size={12} aria-hidden /> 평가 완료 후 공개돼요.
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap text-[12.5px]">
                      {(isMine ? opinionDraft : opinionOf(stage)) || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </span>
                  )}
                </td>
                {i === 0 && (
                  <td rowSpan={OPINION_STAGES.length} className={`${td} text-center`}>
                    {!scoresVisible ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Lock size={13} aria-hidden /> 완료 후 공개
                      </span>
                    ) : conversion?.combined != null ? (
                      <div>
                        <div className="text-[30px] font-bold tabular-nums leading-tight text-foreground">
                          {conversion.combined.toFixed(2)}
                        </div>
                        <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                          {perStage
                            .filter(([, v]) => v != null)
                            .map(([label, v]) => `${label} ${v!.toFixed(1)}`)
                            .join(' · ')}
                        </div>
                        {MODE_NOTE[conversion.mode] && (
                          <div className="mt-1 text-[10.5px] text-muted-foreground">
                            {MODE_NOTE[conversion.mode]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">
                        평가자 점수 입력 후 산출돼요.
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 각주 — 엑셀 원본 문구. */}
      <div className="border-t border-border bg-muted/30 px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
        <p>※ 본인평가는 평가점수 환산에 반영되지 않아요(참고용). 역량평가 결과는 연봉·최종등급에 반영되지 않습니다.</p>
        <p>※ 평가비율: 1차평가자 50% / 2차평가자 30% / 최종평가자 20%</p>
        <p className="pl-3.5">
          1차평가자가 최종평가자와 동일할 경우 1차평가 100% 반영, 2차평가자와 최종평가자가 동일할 경우 1차평가
          70% + 최종평가 30% 반영
        </p>
        <p>※ 평가점수 환산: 각 항목별 가중치를 계산하여 평가자 비율로 환산</p>
      </div>
    </div>
  );
}
