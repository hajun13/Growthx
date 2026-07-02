'use client';

// HR 최종 결정 — 2026-07-02 목업 정렬: 크림색 강조 섹션(상세 카드 최하단),
// 좌 = 결정 유형 라디오·조건부 점수/등급·사유(카운터), 우 = 안내 박스 + [최종 결정 등록].
// 백엔드 AppealDecisionType 5지 캐스케이드 실배선. score_adjust/grade_adjust 는
// 최종단계(calibration/closed) 사이클에서만 백엔드가 허용(그 외 400).
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import type { Grade } from '@/lib/types';
import type { AppealDecisionType, DecideAppealBody } from '../hooks';

export const DECISION_TYPES: { value: AppealDecisionType; label: string; hint: string }[] = [
  { value: 'uphold', label: '평가 유지', hint: '기존 점수·등급을 유지합니다.' },
  { value: 'score_adjust', label: '점수 수정', hint: '새 점수 입력 — 등급은 규칙에 따라 자동 재산정되고 보상이 재계산됩니다.' },
  { value: 'grade_adjust', label: '등급 수정', hint: '새 등급 선택 — 등급 풀 상한을 넘으면 감사 로그에 경고가 남습니다.' },
  { value: 'reevaluate', label: '재평가 진행', hint: '확정된 부서장 평가를 다시 열어 재평가를 진행합니다.' },
  { value: 'reject', label: '기각', hint: '이의제기를 기각하고 기존 결과를 유지합니다.' },
];

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

interface Props {
  busy: boolean;
  onSubmit: (body: DecideAppealBody) => void;
}

export function AppealDecisionForm({ busy, onSubmit }: Props) {
  const [type, setType] = useState<AppealDecisionType>('uphold');
  const [reason, setReason] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newGrade, setNewGrade] = useState<Grade | null>(null);

  const hint = DECISION_TYPES.find((t) => t.value === type)?.hint ?? '';
  const scoreValid = type !== 'score_adjust' || (newScore.trim() !== '' && !Number.isNaN(Number(newScore)));
  const gradeValid = type !== 'grade_adjust' || newGrade !== null;
  const canSubmit = reason.trim().length > 0 && scoreValid && gradeValid && !busy;

  function handleSubmit() {
    if (!canSubmit) return;
    const body: DecideAppealBody = { decisionType: type, reason: reason.trim() };
    if (type === 'score_adjust') body.newScore = Number(newScore);
    if (type === 'grade_adjust' && newGrade) body.newGrade = newGrade;
    onSubmit(body);
  }

  return (
    <div className="border-t border-border bg-[#FFF9ED] p-5">
      <div className="mb-3 text-[14px] font-bold text-foreground">최종 결정</div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_236px]">
        {/* ── 좌: 결정 입력 ── */}
        <div className="space-y-3.5">
          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              <span className="text-danger-600">*</span> 결정 유형 선택
            </div>
            <div role="radiogroup" aria-label="결정 유형" className="flex flex-wrap gap-x-4 gap-y-2">
              {DECISION_TYPES.map((t) => (
                <label key={t.value} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground">
                  <input
                    type="radio"
                    name="decision-type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="h-3.5 w-3.5 accent-[#0257CE]"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>
          </div>

          {type === 'score_adjust' && (
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                <span className="text-danger-600">*</span> 새 점수
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                placeholder="예: 87.5"
                className="h-9 w-40 rounded-md border border-border bg-card px-3 text-[13px] tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {type === 'grade_adjust' && (
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                <span className="text-danger-600">*</span> 새 등급
              </div>
              <div role="radiogroup" aria-label="새 등급" className="flex items-center gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewGrade(g)}
                    aria-pressed={newGrade === g}
                    className={[
                      'rounded-md border p-1 transition',
                      newGrade === g ? 'border-primary bg-card ring-2 ring-primary/30' : 'border-border bg-card opacity-60 hover:opacity-100',
                    ].join(' ')}
                  >
                    <GradeChip grade={g} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
              <span className="text-danger-600">*</span> 결정 사유
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="최종 결정 사유를 입력하세요."
              rows={3}
              className="bg-card"
            />
            <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{reason.length} / 500</div>
          </div>
        </div>

        {/* ── 우: 안내 + 등록 ── */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <div className="mb-1.5 text-[12px] font-bold text-foreground">안내</div>
            <ul className="space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
              <li>· 최종 결정 등록 후 수정은 불가능합니다.</li>
              <li>· 점수·등급 수정과 재평가는 확정 결과와 보상에 즉시 반영됩니다.</li>
              <li>· 결정 전 관련 근거와 증빙을 다시 한번 확인해주세요.</li>
            </ul>
          </div>
          <Button variant="primary" className="w-full" disabled={!canSubmit} loading={busy} onClick={handleSubmit}>
            최종 결정 등록
          </Button>
        </div>
      </div>
    </div>
  );
}
