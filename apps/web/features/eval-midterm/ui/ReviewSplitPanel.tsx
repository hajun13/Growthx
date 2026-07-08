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
        <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
          {String(index).padStart(2, '0')}
        </span>
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', isQual ? 'bg-warning-50 text-warning-700' : 'bg-info-50 text-primary')}>
          {kpiTypeLabel(kpi)}
        </span>
        <h4 className="min-w-0 flex-1 break-keep text-[13.5px] font-bold leading-snug text-foreground">{kpi.title}</h4>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-foreground">
          {kpi.weight}%<span className="ml-1 text-[10.5px] font-normal text-muted-foreground">가중치</span>
        </span>
      </div>

      <div className="grid gap-0 border-t border-border/60 md:grid-cols-2 md:divide-x md:divide-border/60">
        {/* 좌: KPI 정보 — 목표 */}
        <div className="px-4 py-3">
          <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">KPI 정보</p>
          <div className="space-y-1.5 text-[12.5px]">
            <p className="flex gap-2">
              <span className="w-12 shrink-0 text-muted-foreground">목표</span>
              <span className="break-keep text-foreground">{targetOf(kpi)}</span>
            </p>
          </div>
        </div>

        {/* 우: 담당자 자기점검(전문 — 클램프 없음). 정량 수치·자가 등급도 구성원 입력값이라 이 컬럼에 표시. */}
        <div className="border-t border-border/60 px-4 py-3 md:border-t-0">
          <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">담당자 자기점검</p>
          {checkIn?.selfActualValue != null || checkIn?.selfActualText || checkIn?.selfNote || selfGrade ? (
            <div className="space-y-2 text-[12.5px] leading-relaxed text-foreground">
              {!isQual && checkIn?.selfActualValue != null && (
                <p className="tabular-nums">
                  실적{' '}
                  <span className="font-semibold">
                    {checkIn.selfActualValue.toLocaleString('ko-KR')}
                    {measureTypeUnit[kpi.measureType]}
                  </span>
                  {' / '}목표 {targetOf(kpi)}
                  {kpi.cumulativeRate != null && <> (달성률 {Math.round(kpi.cumulativeRate)}%)</>}
                </p>
              )}
              {selfGrade && (
                <p className="flex items-start gap-2">
                  <span className="shrink-0 pt-0.5 text-[12px] text-muted-foreground">자가 등급</span>
                  <GradeChip grade={selfGrade} size="sm" />
                  {kpi.gradingCriteria?.[selfGrade] && (
                    <span className="break-keep text-[12px] leading-relaxed text-muted-foreground">
                      {kpi.gradingCriteria[selfGrade]}
                    </span>
                  )}
                </p>
              )}
              {checkIn?.selfActualText && <p className="whitespace-pre-wrap break-keep">{checkIn.selfActualText}</p>}
              {checkIn?.selfNote && (
                <p className="whitespace-pre-wrap break-keep rounded-md bg-muted/60 px-2.5 py-2 text-[12px] text-foreground/90">
                  {checkIn.selfNote}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">작성된 자가점검 내용이 없어요.</p>
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
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => onChange({ decision: 'accepted' })}
              className={cn(
                'px-3 py-1.5 text-[12px] font-semibold transition',
                state.decision === 'accepted' ? 'bg-success-50 text-success-600' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              수락
            </button>
            <button
              type="button"
              onClick={() => onChange({ decision: 'rebaseline' })}
              className={cn(
                'border-l border-border px-3 py-1.5 text-[12px] font-semibold transition',
                state.decision === 'rebaseline' ? 'bg-status-revision-bg text-status-revision-fg' : 'bg-card text-muted-foreground hover:bg-muted',
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
                    : { background: '#FFEEDD', color: '#C2570A' }
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

/** 순차 확인 결재에서 현재 사용자·이 점검에 대한 단계 정보(MemberDetail 산출). */
export interface MidtermStageInfo {
  total: number;
  current: number;
  /** 지금 내가 확인할 차례 — 판정/승인 UI는 이때만 활성. */
  myTurn: boolean;
  /** 내 단계는 이미 확인 완료(상위 단계 진행 중). */
  myDone: boolean;
  nextName: string | null;
  /** 이번 확인이 마지막 단계(=confirmed)인가. */
  finalStep: boolean;
  /** hr_admin — 확정 후 되돌림(재조정 요청) 가능. */
  isHr: boolean;
}

export function ReviewSplitPanel({
  kpis,
  review,
  readOnly,
  busy,
  stage,
  onConfirm,
  onRequestRevision,
  onDirtyChange,
}: {
  kpis: KpiProgress[];
  review: MidtermReview | null;
  readOnly: boolean;
  busy: boolean;
  stage: MidtermStageInfo;
  /** 전 KPI 수락 → 내 단계 확인(마지막 단계면 승인 확정). */
  onConfirm: (note: string, kpiReviews: MidtermKpiReviewItem[]) => void;
  /** 하나라도 재조정 → 재조정 요청(구성원 재제출 필요). 확정 후 되돌림은 HR 전용. */
  onRequestRevision: (note: string, kpiReviews: MidtermKpiReviewItem[]) => void;
  /** 미저장 판정/피드백 존재 여부 통지 — 구성원 전환 시 유실 경고용. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const confirmed = review?.status === 'confirmed';
  const sentBack = review?.status === 'revision_requested' || review?.status === 'rejected';
  const reviewable = review?.status === 'self_done';
  // 순차 결재: 판정·승인은 내 차례에만(앞 단계 미완 건에 액션 노출 금지 — KPI 검토와 동일 규칙).
  const editable = !readOnly && !!reviewable && stage.myTurn;

  // KPI별 판정 상태 — 저장된 reviewerDecision/reviewerNote 프리필.
  // 종합 의견은 프리필하지 않는다 — 앞 단계 결재자 의견을 내 이름으로 덮어쓰는 사고 방지(읽기 전용 분리 표시).
  const [note, setNote] = useState('');
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setNote('');
    const init: Record<string, DecisionState> = {};
    for (const kpi of kpis) {
      const ci = review?.kpiCheckIns.find((c) => c.kpiId === kpi.kpiId);
      init[kpi.kpiId] = { decision: ci?.reviewerDecision ?? null, note: ci?.reviewerNote ?? '' };
    }
    setDecisions(init);
    setTouched(false);
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.id, review?.status, kpis.length]);

  // 편집 중 사용자 입력 발생 → 상위에 미저장 상태 통지(1회).
  function markDirty() {
    if (!touched) {
      setTouched(true);
      onDirtyChange?.(true);
    }
  }

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
        <div className="rounded-md border px-3 py-2.5 text-[12.5px]" style={{ background: review.status === 'rejected' ? '#FDE8E8' : '#FFEEDD', color: review.status === 'rejected' ? '#C81E1E' : '#C2570A' }}>
          {review.status === 'rejected' ? '반려' : '재조정 요청'} 상태예요 — 구성원이 목표 재조정·자가점검을 보완해 재제출하면 다시 검토할 수 있어요.
          {review.reviewerNote && <span className="mt-1 block whitespace-pre-wrap text-foreground">사유: {review.reviewerNote}</span>}
        </div>
      )}

      {/* 순차 결재 대기 배너 — 내 차례가 아니면 판정/승인 UI 대신 상태만 표시 */}
      {reviewable && !readOnly && !stage.myTurn && (
        <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-[12.5px] text-muted-foreground">
          {stage.myDone
            ? `내 확인 완료 (${stage.current}/${stage.total}) — 다음 결재자${stage.nextName ? ` ${stage.nextName}` : ''}의 확인을 기다리고 있어요.`
            : `${stage.current + 1}차 확인 대기${stage.nextName ? ` — ${stage.nextName}` : ''}. 앞 단계 확인이 끝나면 처리할 수 있어요.`}
          {Array.isArray(review.reviewTrail) && review.reviewTrail.length > 0 && (
            <span className="mt-1 block text-[11.5px]">
              확인 이력: {review.reviewTrail.map((t) => `${t.stage}차 ${t.approverName}`).join(' → ')}
            </span>
          )}
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
          onChange={(patch) => {
            setDecisions((prev) => ({
              ...prev,
              [kpi.kpiId]: { ...(prev[kpi.kpiId] ?? { decision: null, note: '' }), ...patch },
            }));
            markDirty();
          }}
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
            {Array.isArray(review.reviewTrail) && review.reviewTrail.length > 0 && (
              <p className="text-[11.5px] text-muted-foreground">
                확인 이력: {review.reviewTrail.map((t) => `${t.stage}차 ${t.approverName}`).join(' → ')}
              </p>
            )}
            {!readOnly && !stage.isHr && (
              <p className="border-t border-border/60 pt-2.5 text-[11.5px] text-muted-foreground">
                전 단계 확인이 완료된 점검이에요. 되돌림(재조정 요청)이 필요하면 HR 관리자에게 요청하세요.
              </p>
            )}
            {!readOnly && stage.isHr && (
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
        <div className="sticky bottom-0 flex flex-col gap-2.5 rounded-lg border border-border bg-card px-4 py-3 shadow-elev-1">
          {/* 앞 단계 결재자 의견 — 읽기 전용 분리 표시(내 입력란은 빈 칸에서 시작) */}
          {review.reviewerNote && (
            <div className="rounded-md bg-muted/60 px-2.5 py-2 text-[12px]">
              <span className="font-semibold text-muted-foreground">앞 단계 의견</span>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-foreground/80">{review.reviewerNote}</p>
            </div>
          )}
          <TextField
            label="종합 의견"
            hideLabel
            multiline
            rows={2}
            value={note}
            onChange={(v) => { setNote(v); markDirty(); }}
            placeholder="상반기 진척 전반에 대한 종합 의견을 남겨주세요. (승인 시 선택 — 비우면 기존 의견 유지, 구성원에게 전달돼요)"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-[11.5px] tabular-nums text-muted-foreground">
              수락 <b className="text-foreground">{counts.accepted}</b> · 재조정{' '}
              <b className="text-foreground">{counts.rebase}</b>
              {counts.undecided > 0 && (
                <> · 미판정 <b className="text-status-revision-fg">{counts.undecided}</b> — KPI마다 수락/재조정을 선택하세요</>
              )}
              {counts.undecided === 0 && anyRebase && !note.trim() && (
                <> · 재조정 요청에는 사유(종합 의견)가 필요해요</>
              )}
            </span>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !allDecided || (anyRebase && !note.trim())}
              onClick={() =>
                anyRebase
                  ? onRequestRevision(note.trim(), buildKpiReviews())
                  : onConfirm(note.trim(), buildKpiReviews())
              }
            >
              {anyRebase ? '재조정 요청' : stage.finalStep ? '최종 승인' : `${stage.current + 1}차 승인`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
