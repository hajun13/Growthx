'use client';

// 상급자 1차 검토 — 2026-07-24 재구성(사용자 피드백: KPI 검토 화면과 통일감 있는 표형 레이아웃):
//  KPI 검토(KpiReviewView)와 같은 표형 행(No/KPI항목/가중치/판정) + 행 펼침 시 등급기준·CSF·누적
//  달성률, 판정 컨트롤은 재조정 검토(ReviewSplitPanel)와 같은 [수락|조정 필요] 세그먼트 토글 +
//  코멘트 입력. 하단 sticky 는 종합 의견 + 수락/조정/미판정 요약 + 단일 제출 버튼.
//  ⚠ 데이터 로직(로딩 게이트·프리필 규칙·제출 페이로드·가드)은 기존 그대로 — 레이아웃만 재배치.
//  중간점검은 등급·연봉 미반영 참고용이라 등급(S~D) 입력은 두지 않는다(수락/조정 필요만).
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState, HiddenLabelTextarea } from '@/components/MidtermStates';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { useMidtermProgress, useMidtermDetail } from '../hooks';
import { commentMidterm } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import {
  FirstReviewKpiRow,
  hasKpiContent,
  type KpiCommentDraft,
} from './FirstReviewRow';

/**
 * 1차 평가자(부서장) 화면 — KPI별 진척을 보고 코멘트·판정 후 제출.
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
  // 등급 부여 기준(공통 금액/증감률표) — KPI 검토와 동일 원천(진행 주기의 RuleSet). 참고 표시용일
  // 뿐 판정 자체(수락/조정 필요)엔 영향 없다 — 중간점검은 등급·연봉 미반영.
  const { current } = useCurrentCycle();
  const { data: ruleSet } = useRuleSet(current?.ruleSetId ?? null);

  const [drafts, setDrafts] = useState<Record<string, KpiCommentDraft>>({});
  const [overall, setOverall] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 항목별 접힘 상태 — KPI 검토와 동일하게 전 항목 기본 접힘.
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // 기존 코멘트 프리필(재진입 시 유실 방지).
  useEffect(() => {
    if (!detail.data) return;
    setOverall(detail.data.firstComment ?? '');
    // 이번(2단계) 흐름의 1차 코멘트가 아직 없으면 KPI별 초안을 비운 채 시작한다.
    // MidtermKpiCheckIn 행은 개시(open) 때 초기화되지 않아, 폐기된 이전 흐름에서 팀장이
    // 적어 둔 reviewerNote/reviewerDecision 이 그대로 남아 있다. 그걸 프리필하면 새 1차
    // 평가자가 남의 판단을 자기 이름으로 재저장하게 되고, 대상자에게는 "부서장:" 으로 보인다.
    // firstCommentedAt 이 신규 흐름 코멘트가 실제로 등록됐는지의 유일한 신호다.
    const hasNewFlowComment = Boolean(detail.data.firstCommentedAt);
    const next: Record<string, KpiCommentDraft> = {};
    if (hasNewFlowComment) {
      for (const c of detail.data.kpiCheckIns) {
        next[c.kpiId] = { note: c.reviewerNote ?? '', decision: c.reviewerDecision ?? '' };
      }
    }
    setDrafts(next);
  }, [detail.data]);

  const kpis = progress.data?.kpis ?? [];
  // 진척 조회가 실패했거나 아직 안 끝났는데 목록을 빈 배열로 렌더하면 "이 사람은 KPI가
  // 없다"로 읽히고, 그 옆에서 제출 버튼은 그대로 살아 있다(총평만 붙은 코멘트가 확정됨).
  const progressLoading = progress.loading && !progress.data;
  const progressFailed = Boolean(progress.error);
  const progressReady = Boolean(progress.data) && !progressFailed;

  // activeKpis(=kpis)가 도착할 때마다 전 항목 기본 접힘으로 초기화(KPI 검토와 동일 패턴).
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const k of kpis) init[k.kpiId] = true;
    setCollapsedMap(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.data]);

  const toggleCollapsed = (id: string) =>
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));

  // 제출 필수 대상 — 확정(confirmed) KPI 만. 미확정(draft/submitted)은 판정이 선택이라
  // (경고 문구는 유지) 제출을 막는 데는 넣지 않는다.
  const confirmedKpis = useMemo(() => kpis.filter((k) => k.status === 'confirmed'), [kpis]);

  const counts = useMemo(() => {
    let accepted = 0;
    let rebase = 0;
    for (const k of kpis) {
      const d = drafts[k.kpiId]?.decision;
      if (d === 'accepted') accepted += 1;
      else if (d === 'rebaseline') rebase += 1;
    }
    // 미판정은 확정 KPI 기준으로만 카운트 — 사용자 결정(모든 확정 KPI에 판정 필수, 백엔드도
    // 동일 가드). 미확정 KPI 는 판정해도 위 accepted/rebase 에는 반영되지만 미판정 집계엔 안 잡힌다.
    const undecided = confirmedKpis.filter((k) => !drafts[k.kpiId]?.decision).length;
    return { accepted, rebase, undecided };
  }, [kpis, drafts, confirmedKpis]);
  // 기존 변수명 유지(확인 모달 문구에서 그대로 사용).
  const adjustCount = counts.rebase;
  // 확정 KPI 전부가 판정(수락/조정 필요)을 가져야 제출 가능 — 백엔드도 동일 가드가 들어가
  // 프론트-백엔드 정합을 맞춘다.
  const allConfirmedDecided = counts.undecided === 0;

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
      {progressLoading && <Skeleton className="h-40 w-full" />}
      {progressFailed && (
        <ErrorState
          message="구성원의 KPI 진척을 불러오지 못했어요. 다시 시도해 주세요."
          onRetry={progress.reload}
        />
      )}
      {progressReady && kpis.length === 0 && (
        <EmptyState title="이번 주기에 확인할 KPI가 없어요." />
      )}

      {progressReady && kpis.length > 0 && (
        <div className="space-y-3">
          {/* 컬럼 헤더 — KPI 검토와 동일 표형 구조(No/KPI 항목/가중치/판정) */}
          <div className="flex items-center gap-4 rounded-md border border-transparent bg-muted px-4 py-2 text-11h font-semibold text-muted-foreground">
            <span className="w-11 shrink-0">No.</span>
            <span className="min-w-0 flex-1">KPI 항목</span>
            <span className="w-18 shrink-0">가중치</span>
            <span className="w-37.5 shrink-0 pr-1 text-right">판정</span>
          </div>

          {kpis.map((kpi, index) => (
            <FirstReviewKpiRow
              key={kpi.kpiId}
              index={index + 1}
              kpi={kpi}
              scales={ruleSet?.gradingScales}
              draft={drafts[kpi.kpiId] ?? { note: '', decision: '' }}
              collapsed={collapsedMap[kpi.kpiId] ?? true}
              onToggle={() => toggleCollapsed(kpi.kpiId)}
              onChange={(patch) =>
                setDrafts((prev) => ({
                  ...prev,
                  [kpi.kpiId]: { ...(prev[kpi.kpiId] ?? { note: '', decision: '' }), ...patch },
                }))
              }
            />
          ))}
        </div>
      )}

      {detail.data && <MidtermTrailTimeline entries={detail.data.trail} />}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* 종합 의견 + 요약 + 제출 — sticky(재조정 검토 ReviewSplitPanel 과 동일한 하단 패턴) */}
      <div className="sticky bottom-0 flex flex-col gap-2.5 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <p className="text-12h font-medium leading-relaxed text-muted-foreground">
          {progressReady && !allConfirmedDecided ? (
            <span className="font-semibold text-warning-700">
              아직 판정하지 않은 KPI가 {counts.undecided}건 있어요. 모두 수락 또는 조정 필요로
              판정해 주세요.
            </span>
          ) : progressReady ? (
            '제출하면 대상자에게 이메일 안내가 나가고, 대상자가 목표를 수정할 수 있게 돼요.'
          ) : (
            'KPI 진척을 불러온 뒤에 제출할 수 있어요.'
          )}
        </p>
        <HiddenLabelTextarea
          label="종합 의견"
          rows={2}
          value={overall}
          onChange={setOverall}
          placeholder="상반기 전반에 대한 의견을 적어 주세요. (선택)"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-11h tabular-nums text-muted-foreground">
            수락 <b className="text-foreground">{counts.accepted}</b> · 조정{' '}
            <b className="text-foreground">{counts.rebase}</b>
            {counts.undecided > 0 && (
              <>
                {' '}
                · 미판정 <b className="text-status-revision-fg">{counts.undecided}</b>
              </>
            )}
          </span>
          {/* 진척이 로딩 중이거나 실패했으면 제출을 막는다 — 그 상태로 총평만 보내면
              지표별 코멘트 없이 흐름이 다음 단계로 넘어가 되돌릴 수 없다.
              확정 KPI 전부 판정 전에도 막는다(사용자 결정 — 미판정 금지, 백엔드도 동일 가드). */}
          <Button
            onClick={() => setConfirming(true)}
            disabled={saving || !hasContent || !progressReady || !allConfirmedDecided}
          >
            코멘트 제출
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="코멘트를 제출할까요?"
        confirm={{ label: '제출', onClick: submit, loading: saving }}
        cancel={{ label: '취소', onClick: () => setConfirming(false) }}
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            제출하면 대상자에게 이메일로 안내가 나가고, 대상자가 목표를 수정할 수 있게 돼요. 조정
            필요로 표시한 지표는 {adjustCount}건이에요.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
