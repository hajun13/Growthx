'use client';

// 본인(employee/부서장 본인) "내 점검" 탭 — 2026-06-09 전면 재구성.
//  - StepChip/MidtermStepper 제거 (사각형만 사용, 원형 없음).
//  - KPI 카드 방식: 본인이 설정해 둔 정의 전부 표시 + 지표별 자가점검 입력.
//  - 부서장 피드백: 제출 이후에만 컴팩트하게 노출.
//  - 보완 조치: 배정된 ActionItem이 있을 때만 노출.
//  - 재조정 + 이력: collapsible "고급 — 목표 재조정" 섹션, mid_review가 아니면 숨김.
//  - 단일 POST로 모든 KPI checkIns + selfNote를 제출.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import {
  useMidtermProgress,
  useMidtermReviews,
  useActionItems,
  midtermReviewCommands,
  actionItemCommands,
} from '@/hooks/useMidterm';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ActionItemRow } from '@/components/ActionItemRow';
import { EmptyState, Skeleton } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { MidtermSignalBadge } from '@/components/MidtermSignalBadge';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { gradeChipColor } from '@/lib/toss';

// Kinetic Enterprise 팔레트
const K = { primary: '#3f2c80', secondary: '#0054ca', tertiary: '#0e9aa0' } as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';
import {
  kpiCategoryLabel,
  kpiGroupLabel,
  kpiTypeLabel,
  fmtPercent,
  fmtAmount,
  measureTypeUnit,
  progressSignalLabel,
} from '@/lib/ui';
import { RebaselineRequestSection } from './RebaselineRequestSection';
import type {
  User,
  ActionItem,
  ActionItemStatus,
  MidtermReview,
  KpiProgress,
  Grade,
} from '@/lib/types';

// 그룹별 섹션 색(본인평가·KPI 페이지와 동일).
const GROUP_CFG: Record<string, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};
const GROUP_ORDER = ['performance_core', 'collaboration_growth'] as const;

// 등급 점수구간 텍스트(ruleSet 없을 때 폴백).
const DEFAULT_GRADE_SCALE: { grade: Grade; label: string }[] = [
  { grade: 'S', label: '96~100점' },
  { grade: 'A', label: '91~95점' },
  { grade: 'B', label: '85~90점' },
  { grade: 'C', label: '80~84점' },
  { grade: 'D', label: '80점 미만' },
];

// KPI별 자가점검 입력 상태.
interface CheckInInput {
  selfActualText: string;
  selfActualValue: string; // 문자열로 입력, 제출 시 파싱
  selfNote: string;
  selfGrade: Grade | '';
}

function defaultCheckIn(kpi: KpiProgress): CheckInInput {
  const ci = kpi.selfCheckIn;
  return {
    selfActualText: ci?.selfActualText ?? '',
    selfActualValue: ci?.selfActualValue !== null && ci?.selfActualValue !== undefined
      ? String(ci.selfActualValue)
      : '',
    selfNote: ci?.selfNote ?? '',
    selfGrade: (ci?.selfGrade as Grade) ?? '',
  };
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
  const {
    data: actionData,
    loading: actionLoading,
    reload: reloadActions,
  } = useActionItems({ cycleId, assigneeId: user.id });

  const myReview = useMemo(
    () => reviews?.data.find((r) => r.evaluateeId === user.id) ?? null,
    [reviews, user.id],
  );
  const selfDone = myReview?.status === 'self_done' || myReview?.status === 'confirmed';
  const confirmed = myReview?.status === 'confirmed';

  const kpis = progress?.kpis ?? [];
  const myItems: ActionItem[] = actionData?.data ?? [];

  // KPI별 자가점검 입력 상태(selfCheckIn prefill).
  const [checkIns, setCheckIns] = useState<Record<string, CheckInInput>>({});
  const [selfNote, setSelfNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [rebaselineOpen, setRebaselineOpen] = useState(false);

  // 로드/리뷰 변경 시 selfNote 복원.
  useEffect(() => {
    setSelfNote(myReview?.selfNote ?? '');
  }, [myReview?.id, myReview?.selfNote]);

  // KPI 로드 시 checkIn 초기화.
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
  }, [kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCheckIn(kpiId: string, patch: Partial<CheckInInput>) {
    setCheckIns((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const kpiCheckIns = kpis
        .map((kpi) => {
          const ci = checkIns[kpi.kpiId];
          if (!ci) return null;
          const entry: {
            kpiId: string;
            selfActualText?: string;
            selfActualValue?: number;
            selfNote?: string;
            selfGrade?: Grade;
          } = { kpiId: kpi.kpiId };
          if (ci.selfActualText.trim()) entry.selfActualText = ci.selfActualText.trim();
          const parsed = parseFloat(ci.selfActualValue);
          if (!isNaN(parsed)) entry.selfActualValue = parsed;
          if (ci.selfNote.trim()) entry.selfNote = ci.selfNote.trim();
          if (ci.selfGrade) entry.selfGrade = ci.selfGrade as Grade;
          return entry;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      await midtermReviewCommands.submitSelf({
        cycleId,
        selfNote: selfNote.trim() || undefined,
        kpiCheckIns,
      });
      toast.show({ variant: 'success', message: '자가 점검을 제출했어요.' });
      reloadReviews();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [cycleId, kpis, checkIns, selfNote, reloadReviews, toast]);

  async function changeStatus(id: string, next: ActionItemStatus, completionNote?: string) {
    setBusyItemId(id);
    try {
      await actionItemCommands.transition(id, { status: next, completionNote });
      toast.show({ variant: 'success', message: '보완 조치 상태를 변경했어요.' });
      reloadActions();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'INVALID_STATE_TRANSITION'
            ? '지금 단계에서는 바꿀 수 없는 상태예요.'
            : err.message
          : '상태 변경에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusyItemId(null);
    }
  }

  // 가중치 합(표시 전용, 백엔드가 검증).
  const weightSum = kpis.reduce((s, k) => s + k.weight, 0);

  // 그룹별 KPI 분리.
  const byGroup: Partial<Record<string, KpiProgress[]>> = {};
  for (const kpi of kpis) {
    if (!byGroup[kpi.group]) byGroup[kpi.group] = [];
    byGroup[kpi.group]!.push(kpi);
  }

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
        title="중간점검할 KPI가 없어요."
        description="KPI가 확정되면 중간 진척을 점검할 수 있어요."
      />
    );
  }

  const isMidReview = current?.status === 'mid_review';
  const canSubmit = !readOnly && !confirmed;

  return (
    <div className="flex flex-col gap-5">

      {/* 제출 상태 안내 */}
      {confirmed && (
        <div
          className="flex items-center gap-2 px-5 py-3 rounded-xl"
          style={{ background: 'rgba(14,154,160,0.06)', border: '1px solid rgba(14,154,160,0.25)', boxShadow: CARD_SHADOW }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#007a7f' }}>
            자가 점검 제출 완료
          </span>
          {myReview?.reviewerName && (
            <span style={{ fontSize: 12, color: '#007a7f' }}>
              — 부서장 {myReview.reviewerName} 확인
              {myReview.confirmedAt
                ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR')}`
                : ''}
            </span>
          )}
        </div>
      )}
      {selfDone && !confirmed && (
        <div
          className="flex items-center gap-2 px-5 py-3 rounded-xl"
          style={{ background: '#fff8f0', border: '1px solid rgba(245,120,0,0.3)', boxShadow: CARD_SHADOW }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9a3412' }}>
            자가 점검 제출 완료 — 부서장 확인 대기 중
          </span>
        </div>
      )}

      {/* KPI 그룹별 카드 */}
      {GROUP_ORDER.map((group) => {
        const rows = byGroup[group];
        if (!rows || rows.length === 0) return null;
        const cfg = GROUP_CFG[group];
        return (
          <div key={group} className="flex flex-col gap-3">
            {/* 그룹 헤더 */}
            <div className="flex items-center gap-2">
              <span
                style={{ width: 4, height: 16, background: cfg.bg, display: 'inline-block', flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{cfg.label}</span>
              <span style={{ fontSize: 12, color: '#797582' }}>{rows.length}개 과제</span>
              <span
                className="ml-auto tabular-nums"
                style={{ fontSize: 12, color: '#797582' }}
              >
                그룹 가중치 합 {rows.reduce((s, k) => s + k.weight, 0)}%
              </span>
            </div>

            {rows.map((kpi) => (
              <KpiCheckInCard
                key={kpi.kpiId}
                kpi={kpi}
                checkIn={checkIns[kpi.kpiId] ?? defaultCheckIn(kpi)}
                onChange={(patch) => updateCheckIn(kpi.kpiId, patch)}
                readOnly={readOnly || confirmed}
              />
            ))}
          </div>
        );
      })}

      {/* 사이클 단위 자가점검 코멘트 */}
      <Card title="종합 자가 점검 코멘트">
        <TextField
          label="자가 점검 코멘트"
          hideLabel
          multiline
          rows={4}
          value={selfNote}
          onChange={setSelfNote}
          readOnly={readOnly || confirmed}
          placeholder="상반기 전체 진척에 대한 종합 의견을 적어주세요. (선택사항)"
        />
        {selfDone && myReview?.selfSubmittedAt && (
          <p className="mt-2" style={{ fontSize: 11.5, color: '#797582' }}>
            제출일: {new Date(myReview.selfSubmittedAt).toLocaleDateString('ko-KR')}
          </p>
        )}
      </Card>

      {/* 가중치 합 표시(검증 없음, 표시만) */}
      <div
        className="flex items-center justify-between px-5 py-3 rounded-xl"
        style={{ background: '#f8f9fd', border: '1px solid rgba(202,196,210,0.4)', boxShadow: CARD_SHADOW }}
      >
        <span style={{ fontSize: 12.5, color: '#484551' }}>
          전체 KPI 가중치 합 <span style={{ fontWeight: 700, color: '#191c1f' }}>{weightSum}%</span>
          <span style={{ fontSize: 11, color: '#b3b0bb', marginLeft: 6 }}>(검증은 백엔드 수행)</span>
        </span>
        {canSubmit && (
          <Button
            loading={submitting}
            onClick={() => void handleSubmit()}
            leftIcon={<Send size={13} />}
          >
            {selfDone ? '자가 점검 재제출' : '자가 점검 제출'}
          </Button>
        )}
      </div>

      {/* 부서장 피드백 — 제출 이후에만 컴팩트하게 노출 */}
      {selfDone && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}>
          <div
            className="px-5 py-3"
            style={{
              borderBottom: confirmed && myReview?.reviewerNote ? '1px solid rgba(202,196,210,0.2)' : 'none',
              background: '#f8f9fd',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#191c1f' }}>부서장 피드백</span>
          </div>
          <div className="px-5 py-3 bg-white">
            {confirmed && myReview?.reviewerNote ? (
              <div className="flex flex-col gap-1">
                <p
                  className="whitespace-pre-wrap"
                  style={{ fontSize: 13, color: '#333d4b', lineHeight: 1.55 }}
                >
                  {myReview.reviewerNote}
                </p>
                <span style={{ fontSize: 11.5, color: '#007a7f' }}>
                  확인 완료
                  {myReview.reviewerName ? ` (${myReview.reviewerName})` : ''}
                  {myReview.confirmedAt
                    ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR')}`
                    : ''}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#797582' }}>
                부서장이 피드백을 작성하고 확인 처리하면 여기서 확인할 수 있어요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 보완 조치 — 배정된 ActionItem이 있을 때만 노출 */}
      {!actionLoading && myItems.length > 0 && (
        <Card title={`보완 조치 (${myItems.length}건)`}>
          <div className="flex flex-col gap-2">
            {myItems.map((it) => (
              <ActionItemRow
                key={it.id}
                item={it}
                mode={readOnly ? 'readonly' : 'assignee'}
                onChangeStatus={changeStatus}
                busy={busyItemId === it.id}
              />
            ))}
          </div>
        </Card>
      )}

      {/* 목표 재조정 — collapsible, mid_review 아니면 숨김 */}
      {isMidReview && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}>
          <button
            onClick={() => setRebaselineOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3"
            style={{ background: '#f8f9fd', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#484551' }}>
              고급 — 목표 재조정
            </span>
            {rebaselineOpen ? (
              <ChevronDown size={16} color="#797582" />
            ) : (
              <ChevronRight size={16} color="#797582" />
            )}
          </button>
          {rebaselineOpen && (
            <div className="p-5 bg-white">
              <RebaselineRequestSection
                cycleId={cycleId}
                userId={user.id}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KPI 자가점검 카드 ──
function KpiCheckInCard({
  kpi,
  checkIn,
  onChange,
  readOnly,
}: {
  kpi: KpiProgress;
  checkIn: CheckInInput;
  onChange: (patch: Partial<CheckInInput>) => void;
  readOnly: boolean;
}) {
  const cfg = GROUP_CFG[kpi.group];
  const isQual = kpi.isQualitative;
  const typeLabel = kpiTypeLabel(kpi);

  // 목표 텍스트 구성.
  const unit = measureTypeUnit[kpi.measureType];
  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? isQual
        ? kpi.targetText
        : kpi.measureType === 'amount'
          ? fmtAmount(kpi.targetValue)
          : `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const inputStyle: React.CSSProperties = {
    border: '1px solid rgba(202,196,210,0.6)',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    color: '#191c1f',
    background: readOnly ? '#f8f9fd' : '#fff',
    width: '100%',
    outline: 'none',
    resize: 'vertical' as const,
  };

  const gradeOptions: Grade[] = ['S', 'A', 'B', 'C', 'D'];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(202,196,210,0.5)', background: '#fff', boxShadow: CARD_SHADOW }}>
      {/* 카드 헤더 */}
      <div
        className="flex items-start gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(202,196,210,0.2)', background: '#f8f9fd' }}
      >
        <span
          className="inline-block px-2 py-0.5"
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: '#fff',
            background: cfg.bg,
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {kpiCategoryLabel[kpi.category]}
        </span>
        <div className="flex-1" style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#191c1f' }}>{kpi.title}</div>
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
            style={{ fontSize: 11.5, color: '#797582', marginTop: 3 }}
          >
            {kpi.csf && <span>{kpi.csf}</span>}
            {kpi.csf && <span>·</span>}
            <span
              style={{
                background: isQual ? 'rgba(245,120,0,0.08)' : 'rgba(0,84,202,0.08)',
                color: isQual ? '#f57800' : K.secondary,
                fontSize: 10,
                padding: '1px 6px',
                fontWeight: 600,
                borderRadius: 999,
              }}
            >
              {typeLabel}
            </span>
            {targetStr && (
              <>
                <span>·</span>
                <span>목표: {targetStr}</span>
              </>
            )}
            {kpi.measureMethod && (
              <>
                <span>·</span>
                <span>측정: {kpi.measureMethod}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5" style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: '#797582' }} className="tabular-nums">
            가중치 {kpi.weight}%
          </span>
          {kpi.currentGrade ? (
            <GradeBadge grade={kpi.currentGrade} />
          ) : kpi.signal !== 'on_track' ? (
            <MidtermSignalBadge signal={kpi.signal} size="sm" />
          ) : null}
        </div>
      </div>

      {/* 진척 정보 */}
      <div
        className="flex flex-wrap gap-4 px-5 py-2"
        style={{ background: '#f2f3f7', borderBottom: '1px solid rgba(202,196,210,0.2)' }}
      >
        <ProgressStat label="누적 달성률" value={isQual ? '–' : fmtPercent(kpi.cumulativeRate)} />
        <ProgressStat
          label="현재실적"
          value={isQual ? '–' : kpi.measureType === 'amount' ? fmtAmount(kpi.cumulativeActual) : `${kpi.cumulativeActual.toLocaleString('ko-KR')}${unit}`}
        />
        <ProgressStat label="신호" value={progressSignalLabel[kpi.signal]} />
      </div>

      {/* 등급 부여 기준(KpiGradingDisplay 재사용 — gradingCriteria 기반 서술형) */}
      {kpi.gradingCriteria && (
        <div
          className="px-5 py-3"
          style={{ borderBottom: '1px solid rgba(202,196,210,0.2)' }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#484551', marginBottom: 6 }}>
            등급 부여 기준
          </div>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-5">
            {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
              const text = kpi.gradingCriteria?.[g];
              if (!text) return null;
              const c = gradeChipColor[g] ?? gradeChipColor.B;
              return (
                <div
                  key={g}
                  className="flex items-start gap-1.5 rounded-lg"
                  style={{ padding: '4px 6px', border: '1px solid rgba(202,196,210,0.3)' }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      fontSize: 10,
                      fontWeight: 700,
                      background: c.bg,
                      color: c.color,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {g}
                  </span>
                  <span style={{ fontSize: 11, color: '#484551', lineHeight: 1.4 }}>{text}</span>
                </div>
              );
            })}
          </div>
          {/* 점수 구간 폴백 안내 */}
          <div className="flex flex-wrap gap-2 mt-2">
            {DEFAULT_GRADE_SCALE.map((item) => {
              const c = gradeChipColor[item.grade] ?? gradeChipColor.B;
              return (
                <span
                  key={item.grade}
                  className="flex items-center gap-1"
                  style={{ fontSize: 10.5, color: '#797582' }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      fontSize: 9,
                      fontWeight: 700,
                      background: c.bg,
                      color: c.color,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.grade}
                  </span>
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 자가점검 입력 */}
      <div className="flex flex-col gap-3 px-5 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 상반기 실적/진척 입력 */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>
              상반기 실적 / 진척
            </label>
            <textarea
              rows={2}
              value={checkIn.selfActualText}
              onChange={(e) => onChange({ selfActualText: e.target.value })}
              disabled={readOnly}
              placeholder={isQual ? '상반기 달성한 내용을 서술해 주세요.' : `예) 12.5억, ${unit ? `50${unit}` : '목표의 85%'}`}
              style={inputStyle}
            />
            {!isQual && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={checkIn.selfActualValue}
                  onChange={(e) => onChange({ selfActualValue: e.target.value })}
                  disabled={readOnly}
                  placeholder={`수치 실적${unit ? ` (${unit})` : ''}`}
                  style={{ ...inputStyle, width: 140, resize: 'none' }}
                />
                {unit && (
                  <span style={{ fontSize: 12, color: '#797582', whiteSpace: 'nowrap' }}>
                    {unit}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 자가 점검 코멘트 */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>
              자가 점검 코멘트 <span style={{ color: '#b3b0bb', fontWeight: 400 }}>(선택)</span>
            </label>
            <textarea
              rows={2}
              value={checkIn.selfNote}
              onChange={(e) => onChange({ selfNote: e.target.value })}
              disabled={readOnly}
              placeholder="달성 배경, 장애요인, 하반기 계획 등 자유롭게 작성하세요."
              style={inputStyle}
            />
          </div>
        </div>

        {/* 자가 등급 선택(선택사항) — 정성 KPI에는 의미 있음 */}
        {(isQual || kpi.gradingCriteria) && (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#484551' }}>
              자가 등급 선택 <span style={{ color: '#b3b0bb', fontWeight: 400 }}>(선택)</span>
            </span>
            <div className="flex gap-1.5">
              {gradeOptions.map((g) => {
                const c = gradeChipColor[g] ?? gradeChipColor.B;
                const isSelected = checkIn.selfGrade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ selfGrade: isSelected ? '' : g })}
                    style={{
                      width: 30,
                      height: 30,
                      fontSize: 12,
                      fontWeight: 700,
                      background: isSelected ? c.bg : '#f2f3f7',
                      color: isSelected ? c.color : '#797582',
                      border: isSelected ? `2px solid ${c.bg}` : '1px solid rgba(202,196,210,0.5)',
                      borderRadius: 999,
                      cursor: readOnly ? 'default' : 'pointer',
                    }}
                    title={`자가 등급 ${g}${isSelected ? ' (선택됨)' : ''}`}
                  >
                    {g}
                  </button>
                );
              })}
              {checkIn.selfGrade && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onChange({ selfGrade: '' })}
                  style={{ fontSize: 11, color: '#b3b0bb', cursor: 'pointer', padding: '0 4px' }}
                >
                  해제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: 10.5, color: '#797582' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#191c1f' }} className="tabular-nums">
        {value}
      </span>
    </div>
  );
}

function GradeBadge({ grade }: { grade: Grade }) {
  const c = gradeChipColor[grade] ?? gradeChipColor.B;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        padding: '2px 8px',
        borderRadius: 999,
      }}
    >
      {grade}
    </span>
  );
}

// SelfStatusLine 은 더 이상 외부 사용 없음 — EmployeeMidterm 내부에서 처리.
