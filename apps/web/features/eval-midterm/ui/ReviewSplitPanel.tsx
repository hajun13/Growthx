'use client';

// 상급자 중간 점검 — 2026-07-02 재구성(사용자 피드백):
//  KPI 문항마다 [피드백 + 수락/재조정] 판정 → 하단 종합 의견 + 단일 버튼.
//  전부 수락이면 "승인", 하나라도 재조정이면 "재조정 요청"(구성원이 목표 재조정 신청 후 재제출).
//  승인 완료 상태에선 저장된 의견 카드만 보이고, 필요 시 "재조정 요청"으로 되돌릴 수 있다(중복 패널 제거).
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/States';
import { GradeChip } from '@/components/GradeChip';
import { cn } from '@/lib/utils';
import { fmtAmount, measureTypeUnit, kpiTypeLabel } from '@/lib/ui';
import type { KpiProgress, MidtermReview, MidtermKpiReviewItem, Grade } from '@/lib/types';

type KpiDecision = 'accepted' | 'rebaseline';
interface DecisionState {
  decision: KpiDecision | null;
  note: string;
}

function targetOf(k: KpiProgress): string {
  if (k.isQualitative) return k.targetText?.trim() || '—';
  if (k.targetValue === null) return k.targetText?.trim() || '—';
  if (k.measureType === 'amount') return fmtAmount(k.targetValue);
  return `${k.targetValue.toLocaleString('ko-KR')}${measureTypeUnit[k.measureType]}`;
}

// KPI별 [정보 | 담당자 자기점검] + 하단 [피드백 + 수락/재조정] 통합 카드.
function KpiReviewCard({
  index,
  kpi,
  review,
  state,
  onChange,
  editable,
}: {
  index: number;
  kpi: KpiProgress;
  review: MidtermReview | null;
  state: DecisionState;
  onChange: (patch: Partial<DecisionState>) => void;
  editable: boolean;
}) {
  const checkIn = review?.kpiCheckIns.find((c) => c.kpiId === kpi.kpiId) ?? null;
  const selfGrade = (checkIn?.selfGrade ?? null) as Grade | null;
  const isQual = kpi.isQualitative;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* 헤더 — 번호 + 칩 + 제목 + 가중치 */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded-[6px] bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
          {String(index).padStart(2, '0')}
        </span>
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', isQual ? 'bg-warning-50 text-warning-700' : 'bg-[#EAF2FE] text-[#0257CE]')}>
          {kpiTypeLabel(kpi)}
        </span>
        <h4 className="min-w-0 flex-1 break-keep text-[13.5px] font-bold leading-snug text-foreground">{kpi.title}</h4>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
          {kpi.weight}%<span className="ml-1 text-[10.5px] font-normal text-muted-foreground">가중치</span>
        </span>
      </div>

      <div className="grid gap-0 border-t border-border/60 md:grid-cols-2 md:divide-x md:divide-border/60">
        {/* 좌: KPI 정보 — 목표·자가 등급 */}
        <div className="px-4 py-3">
          <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">KPI 정보</p>
          <div className="space-y-1.5 text-[12.5px]">
            <p className="flex gap-2">
              <span className="w-12 shrink-0 text-muted-foreground">목표</span>
              <span className="break-keep text-foreground">{targetOf(kpi)}</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="w-12 shrink-0 text-muted-foreground">자가 등급</span>
              {selfGrade ? (
                <span className="flex min-w-0 items-start gap-2">
                  <GradeChip grade={selfGrade} size="sm" />
                  {kpi.gradingCriteria?.[selfGrade] && (
                    <span className="break-keep text-[12px] leading-relaxed text-muted-foreground">
                      {kpi.gradingCriteria[selfGrade]}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>

        {/* 우: 담당자 자기점검(전문 — 클램프 없음) */}
        <div className="border-t border-border/60 px-4 py-3 md:border-t-0">
          <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">담당자 자기점검</p>
          {checkIn?.selfActualText || checkIn?.selfNote ? (
            <div className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {checkIn.selfActualText && <p className="whitespace-pre-wrap break-keep">{checkIn.selfActualText}</p>}
              {checkIn.selfNote && (
                <p className="whitespace-pre-wrap break-keep rounded-md bg-muted/60 px-2.5 py-2 text-[12px] text-foreground/90">
                  {checkIn.selfNote}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">담당자가 아직 이 KPI에 자기점검을 작성하지 않았어요.</p>
          )}
        </div>
      </div>

      {/* 하단: KPI별 판정 — 피드백 + [수락|재조정] */}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
          <input
            type="text"
            value={state.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="이 KPI에 대한 피드백 (선택)"
            aria-label={`${kpi.title} 피드백`}
            className="h-8 min-w-0 flex-1 rounded-none border border-input bg-card px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <div className="flex shrink-0 overflow-hidden rounded-[8px] border border-border">
            <button
              type="button"
              onClick={() => onChange({ decision: 'accepted' })}
              className={cn(
                'px-3 py-1.5 text-[12px] font-semibold transition',
                state.decision === 'accepted' ? 'bg-[#0EA05E] text-white' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              수락
            </button>
            <button
              type="button"
              onClick={() => onChange({ decision: 'rebaseline' })}
              className={cn(
                'border-l border-border px-3 py-1.5 text-[12px] font-semibold transition',
                state.decision === 'rebaseline' ? 'bg-[#F97316] text-white' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              재조정
            </button>
          </div>
        </div>
      ) : (
        (checkIn?.reviewerDecision || checkIn?.reviewerNote) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
            <span className="text-[11.5px] font-semibold text-muted-foreground">상급자 판정</span>
            {checkIn.reviewerDecision && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={
                  checkIn.reviewerDecision === 'accepted'
                    ? { background: '#E3F7EC', color: '#0B7A47' }
                    : { background: '#FEF0E4', color: '#C2410C' }
                }
              >
                {checkIn.reviewerDecision === 'accepted' ? '수락' : '재조정'}
              </span>
            )}
            {checkIn.reviewerNote && (
              <span className="min-w-0 break-keep text-[12px] text-foreground/80">{checkIn.reviewerNote}</span>
            )}
          </div>
        )
      )}
    </div>
  );
}

export function ReviewSplitPanel({
  kpis,
  review,
  readOnly,
  busy,
  onConfirm,
  onRequestRevision,
}: {
  kpis: KpiProgress[];
  review: MidtermReview | null;
  readOnly: boolean;
  busy: boolean;
  /** 전 KPI 수락 → 승인. */
  onConfirm: (note: string, kpiReviews: MidtermKpiReviewItem[]) => void;
  /** 하나라도 재조정 → 재조정 요청(구성원 재제출 필요). 승인 완료 후 되돌릴 때도 사용. */
  onRequestRevision: (note: string, kpiReviews: MidtermKpiReviewItem[]) => void;
}) {
  const confirmed = review?.status === 'confirmed';
  const sentBack = review?.status === 'revision_requested' || review?.status === 'rejected';
  const reviewable = review?.status === 'self_done';
  const editable = !readOnly && !!reviewable;

  // KPI별 판정 상태 — 저장된 reviewerDecision/reviewerNote 프리필.
  const [note, setNote] = useState('');
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  useEffect(() => {
    setNote(review?.reviewerNote ?? '');
    const init: Record<string, DecisionState> = {};
    for (const kpi of kpis) {
      const ci = review?.kpiCheckIns.find((c) => c.kpiId === kpi.kpiId);
      init[kpi.kpiId] = { decision: ci?.reviewerDecision ?? null, note: ci?.reviewerNote ?? '' };
    }
    setDecisions(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.id, review?.status, kpis.length]);

  // 승인 완료 후 "재조정 요청" 재오픈 — 새 사유는 빈 칸에서 시작(기존 의견과 분리).
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenNote, setReopenNote] = useState('');
  useEffect(() => {
    setReopenOpen(false);
    setReopenNote('');
  }, [review?.id, review?.status]);

  const counts = useMemo(() => {
    let accepted = 0;
    let rebase = 0;
    for (const kpi of kpis) {
      const d = decisions[kpi.kpiId]?.decision;
      if (d === 'accepted') accepted += 1;
      else if (d === 'rebaseline') rebase += 1;
    }
    return { accepted, rebase, undecided: kpis.length - accepted - rebase };
  }, [kpis, decisions]);

  const allDecided = counts.undecided === 0;
  const anyRebase = counts.rebase > 0;

  function buildKpiReviews(): MidtermKpiReviewItem[] {
    const items: MidtermKpiReviewItem[] = [];
    for (const kpi of kpis) {
      const d = decisions[kpi.kpiId];
      if (!d || (!d.decision && !d.note.trim())) continue;
      items.push({
        kpiId: kpi.kpiId,
        decision: d.decision ?? undefined,
        note: d.note.trim() || undefined,
      });
    }
    return items;
  }

  if (!review || review.status === 'pending') {
    return (
      <EmptyState title="구성원이 자가점검을 제출한 뒤 상급자 검토를 진행할 수 있어요." />
    );
  }
  if (kpis.length === 0) {
    return <EmptyState title="점검할 KPI가 없어요." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {sentBack && (
        <div className="rounded-[8px] border px-3 py-2.5 text-[12.5px]" style={{ background: review.status === 'rejected' ? '#FDEBEB' : '#FEF3E2', color: review.status === 'rejected' ? '#B91C1C' : '#B45309' }}>
          {review.status === 'rejected' ? '반려' : '재조정 요청'} 상태예요 — 구성원이 목표 재조정·자가점검을 보완해 재제출하면 다시 검토할 수 있어요.
          {review.reviewerNote && <span className="mt-1 block whitespace-pre-wrap text-foreground">사유: {review.reviewerNote}</span>}
        </div>
      )}

      {/* KPI별 정보+자기점검+판정 통합 카드 */}
      {kpis.map((kpi, i) => (
        <KpiReviewCard
          key={kpi.kpiId}
          index={i + 1}
          kpi={kpi}
          review={review}
          state={decisions[kpi.kpiId] ?? { decision: null, note: '' }}
          onChange={(patch) =>
            setDecisions((prev) => ({
              ...prev,
              [kpi.kpiId]: { ...(prev[kpi.kpiId] ?? { decision: null, note: '' }), ...patch },
            }))
          }
          editable={editable}
        />
      ))}

      {/* 승인 완료 — 저장된 의견 + 필요 시 재조정 요청으로 되돌리기(중복 패널 없음) */}
      {confirmed && (
        <Card title="상급자 의견">
          <div className="flex flex-col gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
              <Avatar name={review.reviewerName ?? '검토자'} size="xs" />
              {review.reviewerName ?? '검토자'}
              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>승인 완료</span>
            </span>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
              {review.reviewerNote || '작성된 의견이 없어요.'}
            </p>
            {!readOnly && (
              reopenOpen ? (
                <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5">
                  <TextField
                    label="재조정 요청 사유"
                    hideLabel
                    multiline
                    rows={2}
                    value={reopenNote}
                    onChange={setReopenNote}
                    placeholder="재조정이 필요한 사유를 적어주세요. (구성원에게 사유로 전달돼요)"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => setReopenOpen(false)}>
                      취소
                    </Button>
                    <Button variant="primary" size="sm" loading={busy} disabled={busy || !reopenNote.trim()} onClick={() => onRequestRevision(reopenNote.trim(), [])}>
                      재조정 요청
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-t border-border/60 pt-2.5">
                  <span className="mr-auto text-[11.5px] text-muted-foreground">
                    승인 후에도 목표 조정이 필요하면 점검을 되돌릴 수 있어요.
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setReopenOpen(true)}>
                    재조정 요청
                  </Button>
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* 검토 제출 — 종합 의견 + 단일 버튼(전부 수락→승인 / 재조정 포함→재조정 요청) */}
      {editable && (
        <div className="sticky bottom-0 flex flex-col gap-2.5 rounded-[10px] border border-border bg-card px-4 py-3 shadow-elev-1">
          <TextField
            label="종합 의견"
            hideLabel
            multiline
            rows={2}
            value={note}
            onChange={setNote}
            placeholder="상반기 진척 전반에 대한 종합 의견을 남겨주세요. (구성원에게 전달돼요)"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-[11.5px] tabular-nums text-muted-foreground">
              수락 <b className="text-foreground">{counts.accepted}</b> · 재조정{' '}
              <b className="text-foreground">{counts.rebase}</b>
              {counts.undecided > 0 && (
                <> · 미판정 <b className="text-[#C2410C]">{counts.undecided}</b> — KPI마다 수락/재조정을 선택하세요</>
              )}
            </span>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !note.trim() || !allDecided}
              onClick={() =>
                anyRebase
                  ? onRequestRevision(note.trim(), buildKpiReviews())
                  : onConfirm(note.trim(), buildKpiReviews())
              }
            >
              {anyRebase ? '재조정 요청' : '승인'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
