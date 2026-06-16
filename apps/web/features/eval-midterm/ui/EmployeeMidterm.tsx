'use client';

// 본인(employee/부서장 본인) "내 점검" 탭 — 섹션 탭 구조(2026-06-12).
//  - 섹션 탭 4개: KPI 자가점검 / 종합 코멘트 / 부서장 피드백 / 보완조치·재조정
//  - admin/users 탭바 패턴 동일하게 적용 (secondary #7A37D8 활성)
//  - 폼 상태 보존: 전 섹션 마운트 유지 + display:none 토글 (탭 전환 시 입력 보존)
//  - 로직·훅·API·제출 흐름 불변
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Send } from 'lucide-react';
import {
  useMidtermProgress,
  useMidtermReviews,
  useActionItems,
  midtermReviewCommands,
  actionItemCommands,
} from '../hooks';
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
// 등급 배지 색은 공유 모듈 lib/grade 사용(dark-on-light, GRADE_BADGE 로컬 상수 제거).
import { gradeColor } from '@/lib/grade';
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

// Kinetic Enterprise 팔레트
const K = { primary: '#7a37d8', secondary: '#7A37D8', tertiary: '#2563eb' } as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

// 그룹별 섹션 색(본인평가·KPI 페이지와 동일).
const GROUP_CFG: Record<string, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#7A37D8' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#128240' },
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

// ── 섹션 탭 정의 ──
type SectionTab = 'checkin' | 'comment' | 'feedback' | 'actions';

const SECTION_TABS: { key: SectionTab; label: string }[] = [
  { key: 'checkin', label: 'KPI 자가점검' },
  { key: 'comment', label: '종합 코멘트' },
  { key: 'feedback', label: '부서장 피드백' },
  { key: 'actions', label: '보완조치·재조정' },
];

// 탭 라벨 옆 진행 힌트 도트
// teal = 완료, amber = 할 일 있음, 없음 = 중립
type DotStatus = 'done' | 'todo' | 'none';

interface SectionTabBarProps {
  active: SectionTab;
  onSelect: (t: SectionTab) => void;
  dots: Record<SectionTab, DotStatus>;
}

function SectionTabBar({ active, onSelect, dots }: SectionTabBarProps) {
  return (
    <div
      className="flex"
      style={{ borderBottom: '1px solid rgba(204,204,212,0.4)', marginBottom: 0 }}
    >
      {SECTION_TABS.map((t) => {
        const isActive = active === t.key;
        const dot = dots[t.key];
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className="flex items-center gap-1.5"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#7A37D8' : '#74747f',
              borderBottom: `2px solid ${isActive ? '#7A37D8' : 'transparent'}`,
              marginBottom: -1,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {dot === 'done' && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: '#2563eb', display: 'inline-block', flexShrink: 0,
                }}
              />
            )}
            {dot === 'todo' && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: '#f59e0b', display: 'inline-block', flexShrink: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
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

  // 섹션 탭 상태
  const [sectionTab, setSectionTab] = useState<SectionTab>('checkin');

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

  const isMidReview = current?.status === 'mid_review';
  const canSubmit = !readOnly && !confirmed;

  // 진행 힌트 도트 계산
  const dots: Record<SectionTab, DotStatus> = useMemo(() => {
    const checkinDot: DotStatus = confirmed ? 'done' : selfDone ? 'done' : canSubmit ? 'todo' : 'none';
    const commentDot: DotStatus = confirmed ? 'done' : selfDone ? 'done' : 'none';
    const feedbackDot: DotStatus = confirmed ? 'done' : selfDone ? 'todo' : 'none';
    const actionsDot: DotStatus =
      myItems.length > 0
        ? myItems.every((i) => i.status === 'done') ? 'done' : 'todo'
        : 'none';
    return {
      checkin: checkinDot,
      comment: commentDot,
      feedback: feedbackDot,
      actions: actionsDot,
    };
  }, [confirmed, selfDone, canSubmit, myItems]);

  // 기본 탭: 첫 번째로 할 일이 있는 탭 (최초 마운트 시만)
  useEffect(() => {
    if (!progLoading && !revLoading) {
      const first = (Object.keys(dots) as SectionTab[]).find((k) => dots[k] === 'todo');
      if (first) setSectionTab(first);
    }
  }, [progLoading, revLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="flex flex-col gap-0">
      {/* 제출 상태 안내 — 탭 위 */}
      {(confirmed || (selfDone && !confirmed)) && (
        <div style={{ marginBottom: 12 }}>
          {confirmed && (
            <div
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
              style={{ background: 'rgba(14,154,160,0.07)', border: '1px solid rgba(14,154,160,0.3)', boxShadow: CARD_SHADOW }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#2563eb', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4fc4' }}>
                자가 점검 제출 완료
              </span>
              {myReview?.reviewerName && (
                <span style={{ fontSize: 12, color: '#1d4fc4' }}>
                  — 부서장 {myReview.reviewerName} 확인
                  {myReview.confirmedAt
                    ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                    : ''}
                </span>
              )}
            </div>
          )}
          {selfDone && !confirmed && (
            <div
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl"
              style={{ background: 'rgba(245,120,0,0.06)', border: '1px solid rgba(245,120,0,0.25)', boxShadow: CARD_SHADOW }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#9a6103' }}>
                자가 점검 제출 완료 — 부서장 확인 대기 중
              </span>
            </div>
          )}
        </div>
      )}

      {/* 섹션 탭 바 */}
      <SectionTabBar
        active={sectionTab}
        onSelect={setSectionTab}
        dots={dots}
      />

      {/* 탭 콘텐츠 — 전부 마운트, display:none 토글로 폼 상태 보존 */}
      <div style={{ marginTop: 20 }}>

        {/* 탭 1: KPI 자가점검 */}
        <div style={{ display: sectionTab === 'checkin' ? 'flex' : 'none', flexDirection: 'column', gap: 20 }}>
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
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#18181c' }}>{cfg.label}</span>
                  <span style={{ fontSize: 12, color: '#74747f' }}>{rows.length}개 과제</span>
                  <span
                    className="ml-auto tabular-nums"
                    style={{ fontSize: 12, color: '#74747f' }}
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

          {/* 가중치 합 + 제출 버튼 */}
          <div
            className="flex items-center justify-between px-5 py-3 rounded-xl"
            style={{ background: '#f7f7f9', border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
          >
            <span style={{ fontSize: 12.5, color: '#565660' }}>
              전체 KPI 가중치 합 <span style={{ fontWeight: 700, color: '#18181c' }}>{weightSum}%</span>
              <span style={{ fontSize: 11, color: '#a0a0ac', marginLeft: 6 }}>(검증은 백엔드 수행)</span>
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
        </div>

        {/* 탭 2: 종합 코멘트 */}
        <div style={{ display: sectionTab === 'comment' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
          <Card title="종합 자가 점검 코멘트">
            <TextField
              label="자가 점검 코멘트"
              hideLabel
              multiline
              rows={6}
              value={selfNote}
              onChange={setSelfNote}
              readOnly={readOnly || confirmed}
              placeholder="상반기 전체 진척에 대한 종합 의견을 적어주세요. (선택사항)"
            />
            {selfDone && myReview?.selfSubmittedAt && (
              <p className="mt-2" style={{ fontSize: 11.5, color: '#74747f' }}>
                제출일: {new Date(myReview.selfSubmittedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </Card>
          {canSubmit && (
            <div className="flex justify-end">
              <Button
                loading={submitting}
                onClick={() => void handleSubmit()}
                leftIcon={<Send size={13} />}
              >
                {selfDone ? '자가 점검 재제출' : '자가 점검 제출'}
              </Button>
            </div>
          )}
        </div>

        {/* 탭 3: 부서장 피드백 */}
        <div style={{ display: sectionTab === 'feedback' ? 'block' : 'none' }}>
          {!selfDone ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-5 py-10 rounded-xl"
              style={{ background: '#f7f7f9', border: '1px solid rgba(204,204,212,0.4)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: '#a0a0ac' }}>
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, color: '#74747f', textAlign: 'center' }}>
                자가 점검을 제출하면<br />부서장 피드백을 여기서 확인할 수 있어요.
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}>
              <div
                className="flex items-center gap-2.5 px-5 py-3"
                style={{
                  borderBottom: '1px solid rgba(204,204,212,0.2)',
                  background: '#f7f7f9',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#18181c' }}>부서장 피드백</span>
              </div>
              <div className="px-5 py-4 bg-white">
                {confirmed && myReview?.reviewerNote ? (
                  <div className="flex flex-col gap-2">
                    <p
                      className="whitespace-pre-wrap"
                      style={{ fontSize: 13, color: '#2a2a30', lineHeight: 1.6 }}
                    >
                      {myReview.reviewerNote}
                    </p>
                    <span style={{ fontSize: 11.5, color: '#1d4fc4', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: '#2563eb', display: 'inline-block' }} />
                      확인 완료
                      {myReview.reviewerName ? ` (${myReview.reviewerName})` : ''}
                      {myReview.confirmedAt
                        ? ` · ${new Date(myReview.confirmedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                        : ''}
                    </span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#74747f' }}>
                    부서장이 피드백을 작성하고 확인 처리하면 여기서 확인할 수 있어요.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 탭 4: 보완조치·재조정 */}
        <div style={{ display: sectionTab === 'actions' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
          {/* 보완 조치 */}
          {!actionLoading && myItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-5 py-10 rounded-xl"
              style={{ background: '#f7f7f9', border: '1px solid rgba(204,204,212,0.4)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: '#a0a0ac' }}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, color: '#74747f' }}>배정된 보완 조치가 없어요.</p>
            </div>
          ) : (
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
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}>
              <button
                onClick={() => setRebaselineOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3"
                style={{ background: '#f7f7f9', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#565660' }}>
                  고급 — 목표 재조정
                </span>
                {rebaselineOpen ? (
                  <ChevronDown size={16} color="#74747f" />
                ) : (
                  <ChevronRight size={16} color="#74747f" />
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

      </div>
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
    border: '1px solid rgba(204,204,212,0.6)',
    borderRadius: 6,
    padding: '9px 11px',
    fontSize: 13,
    color: '#18181c',
    background: readOnly ? '#f7f7f9' : '#fff',
    width: '100%',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'border-color .12s, box-shadow .12s',
  };
  const inputFocusHandlers = readOnly ? {} : {
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      e.currentTarget.style.borderColor = '#7A37D8';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,55,216,0.10)';
    },
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      e.currentTarget.style.borderColor = 'rgba(204,204,212,0.6)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  const gradeOptions: Grade[] = ['S', 'A', 'B', 'C', 'D'];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(204,204,212,0.5)', background: '#fff', boxShadow: CARD_SHADOW }}>
      {/* 카드 헤더 */}
      <div
        className="flex items-start gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(204,204,212,0.2)', background: '#f7f7f9' }}
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
          <div style={{ fontSize: 14, fontWeight: 700, color: '#18181c' }}>{kpi.title}</div>
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
            style={{ fontSize: 11.5, color: '#74747f', marginTop: 3 }}
          >
            {kpi.csf && <span>{kpi.csf}</span>}
            {kpi.csf && <span>·</span>}
            <span
              style={{
                background: isQual ? 'rgba(245,120,0,0.08)' : 'rgba(122,55,216,0.08)',
                color: isQual ? '#f59e0b' : K.secondary,
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
          <span style={{ fontSize: 11.5, color: '#74747f' }} className="tabular-nums">
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
        style={{ background: '#efeff2', borderBottom: '1px solid rgba(204,204,212,0.2)' }}
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
          style={{ borderBottom: '1px solid rgba(204,204,212,0.2)' }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: '#74747f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            등급 부여 기준
          </div>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-5">
            {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
              const text = kpi.gradingCriteria?.[g];
              if (!text) return null;
              const c = gradeColor(g);
              return (
                <div
                  key={g}
                  className="flex items-start gap-1.5 rounded-lg"
                  style={{ padding: '4px 6px', border: '1px solid rgba(204,204,212,0.3)' }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      fontSize: 10,
                      fontWeight: 700,
                      background: c.bg,
                      color: c.fg,
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {g}
                  </span>
                  <span style={{ fontSize: 11, color: '#565660', lineHeight: 1.4 }}>{text}</span>
                </div>
              );
            })}
          </div>
          {/* 점수 구간 폴백 안내 */}
          <div className="flex flex-wrap gap-2 mt-2">
            {DEFAULT_GRADE_SCALE.map((item) => {
              const c = gradeColor(item.grade);
              return (
                <span
                  key={item.grade}
                  className="flex items-center gap-1"
                  style={{ fontSize: 10.5, color: '#74747f' }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      fontSize: 9,
                      fontWeight: 700,
                      background: c.bg,
                      color: c.fg,
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
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#565660' }}>
              상반기 실적 / 진척
            </label>
            <textarea
              rows={2}
              value={checkIn.selfActualText}
              onChange={(e) => onChange({ selfActualText: e.target.value })}
              disabled={readOnly}
              placeholder={isQual ? '상반기 달성한 내용을 서술해 주세요.' : `예) 12.5억, ${unit ? `50${unit}` : '목표의 85%'}`}
              style={{ ...inputStyle, lineHeight: 1.5 }}
              {...inputFocusHandlers}
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
                  {...inputFocusHandlers}
                />
                {unit && (
                  <span style={{ fontSize: 12, color: '#74747f', whiteSpace: 'nowrap' }}>
                    {unit}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 자가 점검 코멘트 */}
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#565660' }}>
              자가 점검 코멘트 <span style={{ color: '#a0a0ac', fontWeight: 400 }}>(선택)</span>
            </label>
            <textarea
              rows={2}
              value={checkIn.selfNote}
              onChange={(e) => onChange({ selfNote: e.target.value })}
              disabled={readOnly}
              placeholder="달성 배경, 장애요인, 하반기 계획 등 자유롭게 작성하세요."
              style={{ ...inputStyle, lineHeight: 1.5 }}
              {...inputFocusHandlers}
            />
          </div>
        </div>

        {/* 자가 등급 선택(선택사항) — 정성 KPI에는 의미 있음 */}
        {(isQual || kpi.gradingCriteria) && (
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#565660' }}>
              자가 등급 선택 <span style={{ color: '#a0a0ac', fontWeight: 400 }}>(선택)</span>
            </span>
            <div className="flex gap-1.5">
              {gradeOptions.map((g) => {
                const c = gradeColor(g);
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
                      background: isSelected ? c.bg : '#efeff2',
                      color: isSelected ? c.fg : '#74747f',
                      border: isSelected ? `2px solid ${c.bg}` : '1px solid rgba(204,204,212,0.5)',
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
                  style={{ fontSize: 11, color: '#a0a0ac', cursor: 'pointer', padding: '0 4px' }}
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
      <span style={{ fontSize: 10.5, color: '#74747f' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#18181c' }} className="tabular-nums">
        {value}
      </span>
    </div>
  );
}

function GradeBadge({ grade }: { grade: Grade }) {
  const c = gradeColor(grade);
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        background: c.bg,
        color: c.fg,
        padding: '2px 12px',
        borderRadius: 8,
      }}
    >
      {grade}
    </span>
  );
}
