'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { useMidtermProgress, useMidtermDetail } from '../hooks';
import { commentMidterm } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';

interface KpiCommentDraft {
  note: string;
  decision: 'accepted' | 'rebaseline' | '';
}

/**
 * KPI가 실제 코멘트·판정 중 하나라도 있는지 확인.
 * 판정만 있어도(코멘트 없어도) 제출할 내용으로 취급.
 * 버튼 활성화 조건과 페이로드 필터링 조건을 일치시키기 위해 단일 소스로 관리.
 */
const hasKpiContent = (d: KpiCommentDraft): boolean =>
  Boolean(d.note.trim() || d.decision);

/**
 * 1차 평가자(본부장) 화면 — KPI별 진척을 보고 코멘트·판정 후 제출.
 * 제출하면 대상자에게 이메일이 나가므로 확인 모달을 거친다.
 */
export function FirstReviewPanel({
  reviewId,
  evaluateeId,
  cycleId,
  onDone,
  onDirtyChange,
}: {
  reviewId: string;
  evaluateeId: string;
  cycleId: string;
  onDone: () => void;
  /** 미저장 입력(hasContent) 존재 여부 통지 — 구성원 전환 가드용. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const detail = useMidtermDetail(reviewId);
  // cycleId·evaluateeId 가 아직 없으면 조회하지 않음(불필요한 undefined 요청 방지).
  const progress = useMidtermProgress(
    { cycleId, userId: evaluateeId },
    { enabled: Boolean(cycleId && evaluateeId) },
  );
  const [drafts, setDrafts] = useState<Record<string, KpiCommentDraft>>({});
  const [overall, setOverall] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기존 코멘트 프리필(재진입 시 유실 방지).
  useEffect(() => {
    if (!detail.data) return;
    setOverall(detail.data.firstComment ?? '');
    const next: Record<string, KpiCommentDraft> = {};
    for (const c of detail.data.kpiCheckIns) {
      next[c.kpiId] = { note: c.reviewerNote ?? '', decision: c.reviewerDecision ?? '' };
    }
    setDrafts(next);
  }, [detail.data]);

  const kpis = progress.data?.kpis ?? [];
  const adjustCount = Object.values(drafts).filter((d) => d.decision === 'rebaseline').length;

  // 제출할 내용이 있는지 확인: 전체 총평이거나 KPI별 코멘트/판정이 하나라도 있어야 함.
  const hasContent = overall.trim() || Object.values(drafts).some(hasKpiContent);

  // 제출 버튼 활성화와 동일한 "미저장 입력" 판정을 그대로 상위(ReviewerQueue)에 통지 —
  // 별도의 dirty 개념을 새로 만들지 않는다.
  useEffect(() => {
    onDirtyChange?.(Boolean(hasContent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      // commentMidterm 은 MidtermDetail | null 을 반환(orval 의 200|201(void) 유니언 때문에
      // 실제 페이로드가 없을 수 있음) — null 은 실패가 아니라 "제출은 됐지만 응답 바디가 없음".
      await commentMidterm(reviewId, {
        overallComment: overall,
        kpiComments: Object.entries(drafts)
          .filter(([, d]) => hasKpiContent(d))
          .map(([kpiId, d]) => ({
            kpiId,
            note: d.note.trim() || undefined,
            decision: d.decision || undefined,
          })),
      });
      setConfirming(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {kpis.map((kpi) => (
        <Card key={kpi.kpiId}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">{kpi.title}</h4>
            <span className="text-[12px] text-muted-foreground tabular-nums">
              가중치 {kpi.weight}% · 누적 달성률{' '}
              {kpi.cumulativeRate !== null ? `${kpi.cumulativeRate}%` : '-'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            목표: {kpi.targetText ?? kpi.targetValue ?? '-'}
          </p>
          <div className="mt-3 flex gap-2">
            {(['accepted', 'rebaseline'] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={drafts[kpi.kpiId]?.decision === d ? 'primary' : 'secondary'}
                onClick={() =>
                  setDrafts((p) => ({
                    ...p,
                    [kpi.kpiId]: { note: p[kpi.kpiId]?.note ?? '', decision: d },
                  }))
                }
              >
                {d === 'accepted' ? '현행 유지' : '조정 필요'}
              </Button>
            ))}
          </div>
          <textarea
            value={drafts[kpi.kpiId]?.note ?? ''}
            onChange={(e) =>
              setDrafts((p) => ({
                ...p,
                [kpi.kpiId]: { decision: p[kpi.kpiId]?.decision ?? '', note: e.target.value },
              }))
            }
            placeholder="이 지표에 대한 코멘트를 적어 주세요."
            className="mt-3 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground"
            rows={2}
          />
        </Card>
      ))}

      <Card>
        <h4 className="mb-2 text-sm font-semibold text-foreground">전체 총평</h4>
        <textarea
          value={overall}
          onChange={(e) => setOverall(e.target.value)}
          placeholder="상반기 전반에 대한 의견을 적어 주세요."
          className="w-full rounded-md border border-border bg-card p-2 text-sm text-foreground"
          rows={4}
        />
      </Card>

      {detail.data && <MidtermTrailTimeline entries={detail.data.trail} />}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <EvaluationActionPanel
        sticky
        message="제출하면 대상자에게 이메일 안내가 나가고, 대상자가 목표를 수정할 수 있게 돼요."
        summary={
          <p className="text-[12px] text-muted-foreground">
            조정 필요 <span className="font-bold text-foreground tabular-nums">{adjustCount}</span>건
          </p>
        }
        actions={
          <Button onClick={() => setConfirming(true)} disabled={saving || !hasContent}>
            코멘트 제출
          </Button>
        }
      />

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="코멘트를 제출할까요?"
        primaryAction={{ label: '제출', onClick: submit, loading: saving }}
        secondaryAction={{ label: '취소', onClick: () => setConfirming(false) }}
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            제출하면 대상자에게 이메일로 안내가 나가고, 대상자가 목표를 수정할 수 있게 돼요. 조정
            필요로 표시한 지표는 {adjustCount}건이에요.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
