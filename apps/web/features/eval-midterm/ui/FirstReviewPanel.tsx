'use client';

// 상급자 1차 검토 — 2026-07-24 재구성(사용자 피드백: KPI 검토 화면과 통일감 있는 표형 레이아웃):
//  KPI 검토(KpiReviewView)와 같은 표형 행(No/KPI항목/가중치/판정) + 행 펼침 시 등급기준·CSF·누적
//  달성률, 판정 컨트롤은 재조정 검토(ReviewSplitPanel)와 같은 [수락|조정 필요] 세그먼트 토글 +
//  코멘트 입력. 하단 sticky 는 종합 의견 + 수락/조정/미판정 요약 + 단일 제출 버튼.
//  ⚠ 데이터 로직(로딩 게이트·프리필 규칙·제출 페이로드·가드)은 기존 그대로 — 레이아웃만 재배치.
//  중간점검은 등급·연봉 미반영 참고용이라 등급(S~D) 입력은 두지 않는다(수락/조정 필요만).
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ErrorState, Skeleton, EmptyState } from '@/components/States';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet } from '@/hooks/useRuleSets';
import { cn } from '@/lib/utils';
import { categoryChip } from '@/lib/palette';
import { kpiCategoryLabel, measureTypeUnit, fmtAmount } from '@/lib/ui';
import { useMidtermProgress, useMidtermDetail } from '../hooks';
import { commentMidterm } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import type { KpiProgress, RuleSet } from '@/lib/types';

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

// 1차 검토 표형 행 그리드 — KPI 검토(KPI_ROW_GRID)와 같은 열 구성(No/항목/가중치/판정).
// 마지막 열은 현재 판정 배지 + 펼침 버튼만 담아 KPI 검토보다 좁다 — 실제 판정 입력(코멘트+토글)은
// 카드 하단 바에서 상시 처리한다(펼침 여부와 무관하게 항상 접근 가능해야 하는 조작이라서).
const ROW_GRID = 'grid items-center gap-4 grid-cols-[44px_minmax(0,1fr)_72px_150px]';

function targetLabelOf(k: KpiProgress): string | null {
  if (k.targetText?.trim()) return k.targetText;
  if (k.targetValue === null) return null;
  return k.measureType === 'amount'
    ? fmtAmount(k.targetValue)
    : `${k.targetValue.toLocaleString('ko-KR')}${measureTypeUnit[k.measureType]}`;
}

function DecisionBadge({ decision }: { decision: KpiCommentDraft['decision'] }) {
  if (decision === 'accepted') {
    return (
      <span className="whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold bg-success-50 text-success-600">
        수락
      </span>
    );
  }
  if (decision === 'rebaseline') {
    return (
      <span className="whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold bg-status-revision-bg text-status-revision-fg">
        조정 필요
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold bg-muted text-muted-foreground">
      미판정
    </span>
  );
}

function FirstReviewKpiRow({
  index,
  kpi,
  scales,
  draft,
  collapsed,
  onToggle,
  onChange,
}: {
  index: number;
  kpi: KpiProgress;
  scales?: RuleSet['gradingScales'];
  draft: KpiCommentDraft;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<KpiCommentDraft>) => void;
}) {
  const cc = categoryChip[kpi.category] ?? categoryChip.orders;
  const target = targetLabelOf(kpi);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* 행 전체 클릭 → 등급 부여 기준·CSF·누적 달성률 펼침/접힘 (KPI 검토와 동일 패턴) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        className={`${ROW_GRID} w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-accent/40`}
      >
        <span className="inline-flex h-7 w-9 items-center justify-center rounded-sm bg-muted text-[12px] font-bold tabular-nums text-muted-foreground">
          {String(index).padStart(2, '0')}
        </span>

        {/* KPI 항목 — 정성/정량·카테고리 칩 + 제목/목표/측정방식 */}
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex w-[86px] shrink-0 flex-col items-start gap-1 pt-0.5">
            <span className="rounded bg-primary/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {kpi.isQualitative ? '정성' : '정량'}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ background: cc.bg, color: cc.color }}
            >
              {kpiCategoryLabel[kpi.category]}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[14px] font-bold leading-snug text-foreground break-keep">{kpi.title}</p>
            {target && (
              <p className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">목표</span>
                <span className="truncate">{target}</span>
              </p>
            )}
            {kpi.measureMethod && (
              <p className="flex gap-2 text-[12px] text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">측정</span>
                <span className="truncate">{kpi.measureMethod}</span>
              </p>
            )}
            {/* 확정 전 KPI에도 코멘트·판정을 남길 수 있다 — 어디서 목표를 조치해야 하는지 안내
                (MemberRevisionPanel 의 미확정 카드 안내와 같은 사실). */}
            {kpi.status !== 'confirmed' && (
              <p className="text-[11.5px] text-warning-700">
                아직 확정되지 않은 KPI예요. 코멘트·판정은 대상자에게 그대로 전달되지만, 목표 수정은
                중간점검이 아니라 KPI 검토에서 이뤄져요.
              </p>
            )}
          </div>
        </div>

        <span className="tabular-nums text-[15px] font-bold text-foreground">{kpi.weight}%</span>

        <div className="flex shrink-0 items-center justify-end gap-1.5" onClick={stop}>
          <DecisionBadge decision={draft.decision} />
          <button
            type="button"
            aria-label={collapsed ? '등급 부여 기준 펼치기' : '등급 부여 기준 접기'}
            onClick={onToggle}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* 펼침 영역 — CSF + 누적 달성률 + 등급 부여 기준(참고용, 중간점검은 등급 미반영) */}
      {!collapsed && (
        <div className="border-t border-border">
          {kpi.csf && (
            <p className="bg-muted/60 px-5 pt-3 text-[12px] text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">CSF(전략목표)</span>
              {kpi.csf}
            </p>
          )}
          {kpi.cumulativeRate !== null && (
            <p className="bg-muted/60 px-5 pt-2 text-[12px] text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">누적 달성률</span>
              <span className="tabular-nums">{kpi.cumulativeRate}%</span>
            </p>
          )}
          <div className="bg-muted/60 px-5 pt-3 pb-4">
            {/* KpiGradingDisplay 는 gradingCriteria/measureType 만 읽는다 — 진척 응답(KpiProgress)엔
                건수 기준(grading) 원본 배열이 없어 null 로 넘긴다(정성 서술·공통 금액/증감률표는 그대로 표시). */}
            <KpiGradingDisplay
              kpi={{ gradingCriteria: kpi.gradingCriteria, grading: null, measureType: kpi.measureType }}
              scales={scales}
            />
          </div>
        </div>
      )}

      {/* 판정 컨트롤 — 코멘트 입력 + [수락|조정 필요] 세그먼트 토글(재조정 검토 스타일).
          펼침 여부와 무관하게 상시 노출 — 등급기준 확인 없이도 바로 판정할 수 있어야 한다. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
        <input
          type="text"
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="이 KPI에 대한 코멘트 (선택)"
          aria-label={`${kpi.title} 코멘트`}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={() => onChange({ decision: 'accepted' })}
            className={cn(
              'px-3 py-1.5 text-[12px] font-semibold transition',
              draft.decision === 'accepted' ? 'bg-success-50 text-success-600' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            수락
          </button>
          <button
            type="button"
            onClick={() => onChange({ decision: 'rebaseline' })}
            className={cn(
              'border-l border-border px-3 py-1.5 text-[12px] font-semibold transition',
              draft.decision === 'rebaseline' ? 'bg-status-revision-bg text-status-revision-fg' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            조정 필요
          </button>
        </div>
      </div>
    </div>
  );
}

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
          <div className={`${ROW_GRID} rounded-md border border-transparent bg-muted px-4 py-2 text-[11.5px] font-semibold text-muted-foreground`}>
            <span>No.</span>
            <span>KPI 항목</span>
            <span>가중치</span>
            <span className="text-right pr-1">판정</span>
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
      <div className="sticky bottom-0 flex flex-col gap-2.5 rounded-lg border border-border bg-card px-4 py-3 shadow-elev-1">
        <p className="text-[12.5px] font-medium leading-relaxed text-muted-foreground">
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
        <TextField
          label="종합 의견"
          hideLabel
          multiline
          rows={2}
          value={overall}
          onChange={setOverall}
          placeholder="상반기 전반에 대한 의견을 적어 주세요. (선택)"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-[11.5px] tabular-nums text-muted-foreground">
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
