'use client';

// 본인(employee/부서장 본인) "내 중간 점검" — 단일 세로 흐름(2026-07-02 단순화, 탭 없음).
//  ① KPI 자가점검(+상반기 총평, 제출) → ② 부서장 피드백(승인/반려/재조정 요청) → ③ 목표 재조정.
//  보완 조치 UI는 사용자 피드백으로 제거 — 상급자 피드백은 "재조정 요청" 흐름으로 일원화.
//  2026-07-06: 일괄 제출 → 문항(카드) 단위 개별 제출로 전환. 카드마다 제출 버튼·상태 칩,
//  상반기 총평은 별도 저장. 백엔드 submitSelf 는 보낸 kpiCheckIns 만 upsert 하므로 그대로 재사용.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useMidtermProgress, useMidtermReviews, midtermReviewCommands } from '../hooks';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRebaselineRequests } from '@/hooks/useMidterm';
import { Modal } from '@/components/Modal';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { EmptyState, Skeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RebaselineRequestSection } from './RebaselineRequestSection';
import { KpiCheckInCard, defaultCheckIn } from './KpiCheckInCard';
import type { CheckInInput } from './KpiCheckInCard';
import type { User, KpiProgress, Grade } from '@/lib/types';

// 그룹별 섹션 색(본인평가·KPI 페이지와 동일).
const GROUP_CFG: Record<string, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-neutral-500' },
};
const GROUP_ORDER = ['performance_core', 'collaboration_growth'] as const;

// 카드 입력이 마지막 제출 스냅샷과 같은지(공백·미선택 동일 취급).
function sameCheckIn(a: CheckInInput, b: CheckInInput): boolean {
  return (
    a.selfActualText.trim() === b.selfActualText.trim() &&
    a.selfActualValue.trim() === b.selfActualValue.trim() &&
    a.selfNote.trim() === b.selfNote.trim() &&
    a.selfGrade === b.selfGrade
  );
}

// 서버 전송 엔트리 — 빈 필드는 생략(백엔드가 null 로 정규화).
function buildCheckInEntry(kpiId: string, ci: CheckInInput) {
  const entry: {
    kpiId: string;
    selfActualText?: string;
    selfActualValue?: number;
    selfNote?: string;
    selfGrade?: Grade;
  } = { kpiId };
  if (ci.selfActualText.trim()) entry.selfActualText = ci.selfActualText.trim();
  const parsed = parseFloat(ci.selfActualValue);
  if (!isNaN(parsed)) entry.selfActualValue = parsed;
  if (ci.selfNote.trim()) entry.selfNote = ci.selfNote.trim();
  if (ci.selfGrade) entry.selfGrade = ci.selfGrade as Grade;
  return entry;
}

export function EmployeeMidterm({
  cycleId,
  user,
  readOnly,
}: {
  cycleId: string;
  user: User;
  readOnly: boolean;
}) {
  const toast = useToast();
  const { current } = useCurrentCycle();

  const { data: progress, loading: progLoading } = useMidtermProgress({
    cycleId,
    userId: user.id,
  });
  const {
    data: reviews,
    loading: revLoading,
    reload: reloadReviews,
  } = useMidtermReviews({ cycleId, evaluateeId: user.id });

  const myReview = useMemo(
    () => reviews?.data.find((r) => r.evaluateeId === user.id) ?? null,
    [reviews, user.id],
  );
  const selfDone = myReview?.status === 'self_done' || myReview?.status === 'confirmed';
  const confirmed = myReview?.status === 'confirmed';
  // 상급자가 되돌린 상태 — 재조정 요청(revision_requested) 또는 반려(rejected).
  const sentBack = myReview?.status === 'revision_requested' || myReview?.status === 'rejected';

  const kpis = progress?.kpis ?? [];

  const [checkIns, setCheckIns] = useState<Record<string, CheckInInput>>({});
  // 문항 단위 제출 상태 — 마지막 제출 스냅샷(dirty 판정)·제출 여부·제출 중 카드.
  const [savedSnapshots, setSavedSnapshots] = useState<Record<string, CheckInInput>>({});
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  const [submittingKpiId, setSubmittingKpiId] = useState<string | null>(null);
  const [selfNote, setSelfNoteState] = useState('');
  // 총평 dirty 추적 — 편집 중(미저장) 상태에서는 서버값 동기화로 덮어쓰지 않는다.
  const [noteDirty, setNoteDirty] = useState(false);
  // 최신 총평 미러(ref) — 저장 응답 도착 시점의 "지금 입력값"을 stale closure 없이 판정.
  const selfNoteRef = useRef('');
  const setSelfNote = useCallback((v: string) => {
    selfNoteRef.current = v;
    setSelfNoteState(v);
  }, []);
  const [noteSaving, setNoteSaving] = useState(false);
  const [rebaselineModalOpen, setRebaselineModalOpen] = useState(false);

  // 내 재조정 요청(요약 레일 상태 표시용) — 상세·신청은 모달의 RebaselineRequestSection이 담당.
  const { data: myRebaselineList } = useRebaselineRequests(
    { cycleId, evaluateeId: user.id },
    { enabled: !!cycleId },
  );
  const myRebaseline = useMemo(() => {
    const list = myRebaselineList?.data ?? [];
    return (
      list.find((r) => r.status === 'submitted') ??
      [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
      null
    );
  }, [myRebaselineList]);


  // 서버 총평 — 정규화(''). 사용자가 편집 중(dirty)이면 reload 도착값으로 덮어쓰지 않는다
  // (저장 → 이어 타이핑 → 응답 도착 시 롤백 방지). 미편집일 때만 서버값 동기화.
  const serverNote = myReview?.selfNote ?? '';
  useEffect(() => {
    if (!noteDirty) setSelfNote(serverNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverNote]);

  // 사이클/대상 전환 = 정당한 리셋 — 로컬 편집을 버리고 서버값으로 재동기화.
  useEffect(() => {
    setSelfNote(myReview?.selfNote ?? '');
    setNoteDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, user.id]);

  useEffect(() => {
    if (kpis.length === 0) return;
    setCheckIns((prev) => {
      const next = { ...prev };
      for (const kpi of kpis) {
        if (!next[kpi.kpiId]) {
          next[kpi.kpiId] = defaultCheckIn(kpi);
        }
      }
      return next;
    });
    // 제출 스냅샷·제출 여부 시드 — 서버에 check-in 이 있으면 제출된 것으로 간주.
    setSavedSnapshots((prev) => {
      const next = { ...prev };
      for (const kpi of kpis) {
        if (!next[kpi.kpiId]) next[kpi.kpiId] = defaultCheckIn(kpi);
      }
      return next;
    });
    setSubmittedMap((prev) => {
      const next = { ...prev };
      for (const kpi of kpis) {
        if (next[kpi.kpiId] === undefined) next[kpi.kpiId] = kpi.selfCheckIn != null;
      }
      return next;
    });
  }, [kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCheckIn(kpiId: string, patch: Partial<CheckInInput>) {
    setCheckIns((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  // 문항(카드) 단위 개별 제출 — 해당 KPI 1건만 upsert(총평·다른 문항 보존).
  const handleSubmitCard = useCallback(
    async (kpi: KpiProgress) => {
      const ci = checkIns[kpi.kpiId];
      if (!ci) return;
      setSubmittingKpiId(kpi.kpiId);
      try {
        await midtermReviewCommands.submitSelf({
          cycleId,
          kpiCheckIns: [buildCheckInEntry(kpi.kpiId, ci)],
        });
        setSavedSnapshots((prev) => ({ ...prev, [kpi.kpiId]: { ...ci } }));
        setSubmittedMap((prev) => ({ ...prev, [kpi.kpiId]: true }));
        toast.show({ variant: 'success', message: `'${kpi.title}' 자가점검을 제출했어요.` });
        reloadReviews();
      } catch (err) {
        toast.show({
          variant: 'danger',
          message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
        });
      } finally {
        setSubmittingKpiId(null);
      }
    },
    [cycleId, checkIns, reloadReviews, toast],
  );

  // 상반기 총평 저장 — selfNote 만 갱신(문항 check-in 은 건드리지 않음, 상태 전이 없음).
  const handleSaveNote = useCallback(async () => {
    const toSave = selfNote.trim();
    setNoteSaving(true);
    try {
      await midtermReviewCommands.submitSelf({ cycleId, selfNote: toSave });
      // 저장 중 이어 타이핑하지 않았을 때만 dirty 해제 → 서버 동기화 재개.
      // (타이핑했다면 dirty 유지 — reload 도착값이 입력을 덮어쓰지 않는다.)
      if (selfNoteRef.current.trim() === toSave) setNoteDirty(false);
      toast.show({ variant: 'success', message: '상반기 총평을 저장했어요.' });
      reloadReviews();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setNoteSaving(false);
    }
  }, [cycleId, selfNote, reloadReviews, toast]);

  const weightSum = kpis.reduce((s, k) => s + k.weight, 0);

  const byGroup: Partial<Record<string, KpiProgress[]>> = {};
  for (const kpi of kpis) {
    if (!byGroup[kpi.group]) byGroup[kpi.group] = [];
    byGroup[kpi.group]!.push(kpi);
  }

  const isMidReview = current?.status === 'mid_review';
  const canSubmit = !readOnly && !confirmed;

  // 첫 화면은 항상 "KPI 자가점검"(기본 state) — todo 탭 자동 점프·도트 파생은 혼란을 줘 제거(2026-07-02 사용자 피드백).

  if (progLoading || revLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <EmptyState
        title="자가점검할 KPI가 없어요."
        description="KPI가 확정되면 중간 진척을 점검할 수 있어요."
      />
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* 2026-07-02 재배치: 하단에 쌓여 안 보이던 피드백/재조정을 우측 sticky 요약 레일로.
          좌(본문) = KPI 자가점검·제출 / 우(레일) = 부서장 피드백·목표 재조정 요약(+모달 상세). */}
      <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">

        {/* ── 좌: KPI 자가점검 (+ 상반기 총평 통합) ── */}
        <div className="flex flex-col gap-6">
          {GROUP_ORDER.map((group) => {
            const rows = byGroup[group];
            if (!rows || rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} className="flex flex-col gap-2.5">
                {/* 그룹 섹션 헤더 */}
                <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                  <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
                  <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
                  <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
                  <span className="ml-auto tabular-nums text-[12px] text-muted-foreground">
                    소계 <span className="font-semibold text-foreground">{rows.reduce((s, k) => s + k.weight, 0)}%</span>
                  </span>
                </div>

                {rows.map((kpi, i) => {
                  const reviewed = myReview?.kpiCheckIns.find((c) => c.kpiId === kpi.kpiId);
                  const cur = checkIns[kpi.kpiId] ?? defaultCheckIn(kpi);
                  const saved = savedSnapshots[kpi.kpiId] ?? defaultCheckIn(kpi);
                  const dirty = !sameCheckIn(cur, saved);
                  const submitted = submittedMap[kpi.kpiId] ?? kpi.selfCheckIn != null;
                  return (
                    <KpiCheckInCard
                      key={kpi.kpiId}
                      index={i + 1}
                      kpi={kpi}
                      checkIn={cur}
                      onChange={(patch) => updateCheckIn(kpi.kpiId, patch)}
                      readOnly={readOnly || confirmed}
                      reviewerFeedback={
                        reviewed && (reviewed.reviewerDecision || reviewed.reviewerNote)
                          ? { decision: reviewed.reviewerDecision, note: reviewed.reviewerNote }
                          : null
                      }
                      submit={
                        canSubmit
                          ? {
                              submitted,
                              dirty,
                              submitting: submittingKpiId === kpi.kpiId,
                              // 변경 시 제출, 반려/재조정 요청을 받았으면 무변경 재제출도 허용.
                              enabled: dirty || (sentBack && submitted),
                              onSubmit: () => void handleSubmitCard(kpi),
                            }
                          : null
                      }
                    />
                  );
                })}
              </div>
            );
          })}

          {/* 상반기 총평 — 문항과 별개로 저장(선택) */}
          <Card title="상반기 총평">
            <TextField
              label="상반기 총평"
              hideLabel
              multiline
              rows={4}
              value={selfNote}
              onChange={(v) => {
                setSelfNote(v);
                setNoteDirty(true);
              }}
              readOnly={readOnly || confirmed}
              placeholder="상반기 전체 진척에 대한 종합 의견을 적어주세요. (선택사항)"
            />
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-[11.5px] text-muted-foreground">
                {selfDone && myReview?.selfSubmittedAt
                  ? `최근 제출: ${new Date(myReview.selfSubmittedAt).toLocaleDateString('ko-KR')}`
                  : ''}
              </p>
              {canSubmit && (
                <Button
                  size="sm"
                  loading={noteSaving}
                  disabled={selfNote.trim() === serverNote.trim()}
                  onClick={() => void handleSaveNote()}
                  leftIcon={<Send size={12} />}
                >
                  총평 저장
                </Button>
              )}
            </div>
          </Card>

          {/* 가중치 합 + 문항 제출 현황 */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted border border-border">
            <span className="text-[12px] text-muted-foreground">
              전체 가중치{' '}
              <span className="font-semibold text-foreground tabular-nums">{weightSum}%</span>
            </span>
            <span className="text-[12px] text-muted-foreground">
              문항 제출{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {kpis.filter((k) => submittedMap[k.kpiId] ?? k.selfCheckIn != null).length}/{kpis.length}
              </span>
            </span>
          </div>
        </div>

        {/* ── 우: 요약 레일(sticky) — 스크롤 없이 항상 보이는 진행 현황 ── */}
        <aside className="mt-6 flex flex-col gap-3 lg:sticky lg:top-6 lg:mt-0">
          {/* 부서장 피드백 요약 */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-elev-1">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-foreground">부서장 피드백</h3>
              {confirmed ? (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>승인</span>
              ) : myReview?.status === 'revision_requested' ? (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FFEEDD', color: '#C2570A' }}>재조정 요청</span>
              ) : myReview?.status === 'rejected' ? (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#FDE8E8', color: '#C81E1E' }}>반려</span>
              ) : selfDone ? (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>대기 중</span>
              ) : (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F4F5FA', color: '#6B6980' }}>제출 전</span>
              )}
            </div>
            {(confirmed || sentBack) && myReview?.reviewerNote ? (
              <>
                <p className="line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
                  {myReview.reviewerNote}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {myReview.reviewerName ?? '부서장'}
                  {myReview.confirmedAt
                    ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                    : ''}
                </p>
                {myReview.status === 'revision_requested' && (
                  <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-foreground/80">
                    아래 <span className="font-semibold">목표 재조정</span>에서 조정을 신청하고, 자가점검을 보완해 재제출해 주세요.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {selfDone ? '부서장이 확인하면 피드백이 여기에 표시돼요.' : '자가점검을 제출하면 피드백을 받을 수 있어요.'}
              </p>
            )}
          </div>

          {/* 목표 재조정 요약 — 상세·신청은 모달 */}
          {isMidReview && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-elev-1">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-foreground">목표 재조정</h3>
                {myRebaseline && <RebaselineChipBadge status={myRebaseline.status} />}
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {myRebaseline
                  ? myRebaseline.status === 'submitted'
                    ? '부서장 검토를 기다리고 있어요. 검토 전에는 수정할 수 있어요.'
                    : myRebaseline.status === 'approved'
                      ? '재조정이 승인되어 목표에 반영됐어요. 필요하면 새로 신청할 수 있어요.'
                      : '반려됐어요 — 사유 확인 후 수정해 재제출할 수 있어요.'
                  : '목표 수치가 현실과 맞지 않으면 재조정을 신청하세요.'}
              </p>
              <Button
                variant={myRebaseline?.status === 'submitted' ? 'secondary' : 'primary'}
                size="sm"
                className="mt-2.5 w-full"
                onClick={() => setRebaselineModalOpen(true)}
              >
                {!myRebaseline
                  ? '재조정 신청'
                  : myRebaseline.status === 'submitted'
                    ? '신청 내용 확인·수정'
                    : myRebaseline.status === 'rejected'
                      ? '수정·재제출'
                      : '새 재조정 신청'}
              </Button>
            </div>
          )}
        </aside>

      </div>

      {/* 목표 재조정 신청/상태 모달 — 신청·수정은 모달 안 인라인 폼(중첩 팝업 없음) */}
      <Modal
        open={rebaselineModalOpen}
        onClose={() => setRebaselineModalOpen(false)}
        title="목표 재조정"
        size="xl"
      >
        <RebaselineRequestSection
          cycleId={cycleId}
          userId={user.id}
          readOnly={readOnly}
          onClose={() => setRebaselineModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

// 재조정 상태 칩(요약 레일용).
function RebaselineChipBadge({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? { bg: '#E3F7EC', color: '#0B7A47', label: '승인' }
      : status === 'rejected'
        ? { bg: '#FDE8E8', color: '#C81E1E', label: '반려' }
        : { bg: '#EAF2FE', color: '#0257CE', label: '검토 대기' };
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tone.bg, color: tone.color }}>
      {tone.label}
    </span>
  );
}
