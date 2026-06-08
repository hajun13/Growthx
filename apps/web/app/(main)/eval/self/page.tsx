'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useEvaluations,
  useEvaluationDetail,
  evaluationCommands,
} from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import {
  kpiGroupLabel,
  kpiCategoryLabel,
  measureTypeLabel,
  measureTypeUnit,
  fmtScore,
} from '@/lib/ui';
import { T, gradeChipColor } from '@/lib/toss';
import type { Kpi, KpiGroup, KpiScore } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

interface AchInput {
  actualValue?: number;
  count?: number;
  qualitativeNote?: string;
}

// 그룹별 섹션 색(KPI 작성 탭과 동일 — 성과중심 파랑 / 협업·성장 초록).
const GROUP_CFG: Record<KpiGroup, { label: string; bg: string }> = {
  performance_core: { label: '성과중심 지표', bg: '#1B64DA' },
  collaboration_growth: { label: '협업·성장 지표', bg: '#029359' },
};

const GRID_COLS = '110px 1fr 80px 160px 90px 56px 80px';
const COL_HEADERS = ['카테고리', '과제명 (CSF)', '목표값', '실적 입력', '측정방식', '가중치', '점수/등급'];

const card: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${T.grey200}`,
};

const cellInput: React.CSSProperties = {
  border: `1px solid ${T.grey200}`,
  padding: '5px 8px',
  fontSize: 12,
  color: T.grey900,
  background: '#fff',
  width: '100%',
  outline: 'none',
};

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  not_started: { label: '미시작', bg: T.grey500 },
  in_progress: { label: '진행중', bg: T.blue500 },
  submitted: { label: '제출 완료', bg: T.green500 },
  finalized: { label: '확정', bg: T.blue700 },
};

export default function SelfEvaluationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const {
    data: selfEvals,
    loading: evalLoading,
    error: evalError,
    reload: reloadEvals,
  } = useEvaluations(
    { cycleId, evaluateeId: user?.id, type: 'self' },
    { enabled: !!cycleId && !!user },
  );
  const selfEval = selfEvals?.data[0] ?? null;

  const {
    data: detail,
    loading: detailLoading,
    reload: reloadDetail,
  } = useEvaluationDetail(selfEval?.id ?? null);

  const { data: myKpis, loading: kpiLoading } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const allKpis: Kpi[] = myKpis?.data ?? [];
  const kpis = useMemo(
    () => allKpis.filter((k) => k.status === 'confirmed'),
    [allKpis],
  );

  const readOnly =
    selfEval?.status === 'submitted' || selfEval?.status === 'finalized';

  const [inputs, setInputs] = useState<Record<string, AchInput>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 저장된 KpiScore → measureType별로 입력값 복원.
  useEffect(() => {
    if (!detail) return;
    const kpiMap = new Map(kpis.map((k) => [k.id, k]));
    const next: Record<string, AchInput> = {};
    for (const s of detail.kpiScores) {
      const kpi = kpiMap.get(s.kpiId);
      if (!kpi) continue;
      if (kpi.measureType === 'count') {
        next[s.kpiId] = { count: s.achievementRate ?? undefined };
      } else if (kpi.measureType === 'qualitative') {
        next[s.kpiId] = { qualitativeNote: s.selfNote ?? '' };
      } else {
        next[s.kpiId] = { actualValue: s.achievementRate ?? undefined };
      }
    }
    setInputs((prev) => ({ ...next, ...prev }));
  }, [detail?.id, kpis]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreByKpi = useMemo(() => {
    const map = new Map<string, KpiScore>();
    for (const s of detail?.kpiScores ?? []) map.set(s.kpiId, s);
    return map;
  }, [detail?.kpiScores]);

  const coreKpis = kpis.filter((k) => k.group === 'performance_core');
  const growthKpis = kpis.filter((k) => k.group === 'collaboration_growth');

  const doneCount = detail?.kpiScores.length ?? 0;
  const totalCount = kpis.length;

  function updateInput(kpiId: string, patch: AchInput) {
    setInputs((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], ...patch } }));
  }

  async function save(): Promise<boolean> {
    if (!selfEval) return false;
    const kpiScores = kpis
      .map((k) => {
        const inp = inputs[k.id] ?? {};
        if (k.measureType === 'qualitative') {
          // 정성: achievementRate 없이 selfNote만 전송.
          return { kpiId: k.id, selfNote: inp.qualitativeNote ?? '', weight: k.weight };
        }
        const ach = k.measureType === 'count' ? inp.count : inp.actualValue;
        if (ach === undefined) return null;
        return { kpiId: k.id, achievementRate: ach, weight: k.weight };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    try {
      await evaluationCommands.patch(selfEval.id, { kpiScores });
      reloadDetail();
      return true;
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
      return false;
    }
  }

  async function handleSubmit() {
    if (!selfEval) return;
    setSubmitting(true);
    try {
      const saved = await save();
      if (!saved) return;
      await evaluationCommands.submit(selfEval.id);
      toast.show({ variant: 'success', message: '본인평가를 제출했어요.' });
      reloadEvals();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === 'COMMENT_REQUIRED'
            ? '평가 코멘트를 작성해야 제출할 수 있어요.'
            : err.code === 'POOL_EXCEEDED'
              ? '그룹 등급 풀 상한을 초과했어요.'
              : err.message
          : '제출에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSelf() {
    if (!cycleId || !user) return;
    setCreateBusy(true);
    try {
      await evaluationCommands.create({
        cycleId,
        evaluateeId: user.id,
        type: 'self',
      });
      toast.show({ variant: 'success', message: '본인평가를 시작했어요.' });
      reloadEvals();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError && err.code === 'ALREADY_EXISTS'
            ? '이미 시작한 본인평가가 있어요.'
            : '본인평가를 시작하지 못했어요.',
      });
      reloadEvals();
    } finally {
      setCreateBusy(false);
    }
  }

  // 측정 가능한(정성 제외) KPI는 실적값이 있어야 제출 가능.
  const measurable = kpis.filter((k) => k.measureType !== 'qualitative');
  const missingCount = measurable.filter((k) => {
    const inp = inputs[k.id] ?? {};
    const has =
      (k.measureType === 'count' ? inp.count : inp.actualValue) !== undefined ||
      scoreByKpi.has(k.id);
    return !has;
  }).length;
  const canSubmit =
    !readOnly && !!selfEval && kpis.length > 0 && missingCount === 0;

  if (cyclesLoading || evalLoading) return <SelfSkeleton />;
  if (evalError) return <ErrorState onRetry={reloadEvals} />;
  if (!current) return <EmptyState title="지금은 본인평가 기간이 아니에요." />;

  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const status = selfEval ? STATUS_LABEL[selfEval.status] ?? STATUS_LABEL.in_progress : null;

  return (
    <PageContainer>
      <PageHeader
        title="본인평가"
        subtitle="과제별 실적을 입력하면 측정방식에 따라 등급·점수가 자동 산정돼요."
        right={
          <>
            {status && (
              <span
                className="px-3 py-1.5 text-white"
                style={{ fontSize: 11, fontWeight: 600, background: status.bg }}
              >
                {status.label}
              </span>
            )}
            {selfEval && !readOnly && (
              <>
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5 px-4 py-2"
                  style={{ fontSize: 13, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-60"
                  style={{ fontSize: 13, fontWeight: 600, background: canSubmit ? T.blue500 : T.grey400 }}
                >
                  <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
                </button>
              </>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="p-4 border" style={{ background: T.grey100, borderColor: T.grey200 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.green500 }}>
            본인평가가 제출되었습니다. 부서장 평가가 진행돼요.
          </div>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '평가 대상자', value: user?.name ?? '나', accent: false },
          { label: '평가 기간', value: current.name, accent: false },
          { label: '진행률', value: `${progressPct}%`, accent: true },
          { label: '입력 현황', value: `${doneCount} / ${totalCount}건`, accent: false },
        ].map((c, i) => (
          <div key={i} className="px-4 py-3" style={card}>
            <div style={{ fontSize: 11, color: T.grey500 }}>{c.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.accent ? T.blue500 : T.grey900, marginTop: 2 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {!selfEval ? (
        <div className="px-5 py-10 text-center" style={card}>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>아직 본인평가를 시작하지 않았어요.</p>
          <p style={{ fontSize: 13, color: T.grey500, marginTop: 4, marginBottom: 16 }}>
            시작하면 KPI별 실적을 입력할 수 있어요.
          </p>
          <button
            onClick={handleCreateSelf}
            disabled={createBusy}
            className="px-5 py-2.5 text-white disabled:opacity-60"
            style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}
          >
            {createBusy ? '시작 중…' : '본인평가 시작하기'}
          </button>
        </div>
      ) : kpiLoading || detailLoading ? (
        <SelfSkeleton />
      ) : kpis.length === 0 ? (
        <div className="px-5 py-10 text-center" style={card}>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>아직 확정된 KPI가 없어요.</p>
          <p style={{ fontSize: 13, color: T.grey500, marginTop: 4, marginBottom: 16 }}>
            KPI 작성에서 과제를 등록·확정해 주세요.
          </p>
          <Link href="/kpi">
            <span className="inline-block px-5 py-2.5 text-white" style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}>
              KPI 작성하기
            </span>
          </Link>
        </div>
      ) : (
        <>
          {/* 그룹별 섹션 테이블 */}
          {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
            const rows = group === 'performance_core' ? coreKpis : growthKpis;
            if (rows.length === 0) return null;
            const cfg = GROUP_CFG[group];
            return (
              <div key={group} style={{ ...card, overflow: 'hidden' }}>
                {/* 그룹 헤더 */}
                <div
                  className="flex items-center gap-2"
                  style={{ padding: '10px 16px', background: cfg.bg }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: '#fff', opacity: 0.85 }}>{rows.length}개 과제</span>
                </div>

                {/* 컬럼 헤더 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID_COLS,
                    gap: 8,
                    padding: '8px 16px',
                    borderBottom: `1px solid ${T.grey200}`,
                    background: T.grey50,
                  }}
                >
                  {COL_HEADERS.map((h, i) => (
                    <div key={i} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
                      {h}
                    </div>
                  ))}
                </div>

                {/* KPI 행 */}
                {rows.map((kpi) => {
                  const score = scoreByKpi.get(kpi.id) ?? null;
                  const inp = inputs[kpi.id] ?? {};
                  const unit = measureTypeUnit[kpi.measureType];
                  const isQual = kpi.measureType === 'qualitative';
                  const isCount = kpi.measureType === 'count';
                  return (
                    <div
                      key={kpi.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: GRID_COLS,
                        gap: 8,
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: `1px solid ${T.grey200}`,
                      }}
                    >
                      {/* 카테고리 뱃지 */}
                      <div>
                        <span
                          className="inline-block px-2 py-1"
                          style={{ fontSize: 10.5, fontWeight: 600, color: '#fff', background: cfg.bg }}
                        >
                          {kpiCategoryLabel[kpi.category]}
                        </span>
                      </div>

                      {/* 과제명 + CSF */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{kpi.title}</div>
                        {kpi.csf && (
                          <div style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}>{kpi.csf}</div>
                        )}
                      </div>

                      {/* 목표값 */}
                      <div
                        className="tabular-nums"
                        style={{ fontSize: 12, color: T.grey700, textAlign: 'right' }}
                      >
                        {isQual
                          ? '정성'
                          : kpi.targetValue === null
                            ? '–'
                            : `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`}
                      </div>

                      {/* 실적 입력 */}
                      <div>
                        {isQual ? (
                          <textarea
                            rows={2}
                            value={inp.qualitativeNote ?? ''}
                            onChange={(e) => updateInput(kpi.id, { qualitativeNote: e.target.value })}
                            placeholder="성과 서술 입력"
                            disabled={readOnly}
                            style={{ ...cellInput, resize: 'vertical', lineHeight: 1.4 }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              value={
                                isCount
                                  ? inp.count ?? ''
                                  : inp.actualValue ?? ''
                              }
                              onChange={(e) => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value);
                                updateInput(kpi.id, isCount ? { count: v } : { actualValue: v });
                              }}
                              placeholder={isCount ? '건수' : '실적값'}
                              disabled={readOnly}
                              style={{ ...cellInput, textAlign: 'right' }}
                            />
                            {(unit || isCount) && (
                              <span style={{ fontSize: 11, color: T.grey500, whiteSpace: 'nowrap' }}>
                                {isCount ? '건' : unit}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 측정방식 */}
                      <div style={{ fontSize: 11, color: T.grey600 }}>
                        {measureTypeLabel[kpi.measureType]}
                      </div>

                      {/* 가중치 */}
                      <div className="tabular-nums" style={{ fontSize: 12, color: T.grey700 }}>
                        {kpi.weight}%
                      </div>

                      {/* 점수/등급 */}
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700, color: T.blue600 }}>
                          {fmtScore(score?.score)}
                        </span>
                        {score?.grade && <GradeBadge grade={score.grade} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 하단 바 */}
          {!readOnly && (
            <div
              className="flex items-center justify-between flex-wrap gap-2"
              style={{ ...card, padding: '12px 16px' }}
            >
              <p style={{ fontSize: 13, color: T.grey600 }}>
                <span style={{ fontWeight: 700, color: T.grey900 }}>{doneCount}</span>/{totalCount}건 완료
                {missingCount > 0 ? ` · 미입력 ${missingCount}건` : ' · 모두 입력했어요'}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => void save()}
                  className="flex items-center gap-1.5 px-4 py-2"
                  style={{ fontSize: 13, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
                >
                  <Save size={14} /> 임시저장
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-60"
                  style={{ fontSize: 13, fontWeight: 600, background: canSubmit ? T.blue500 : T.grey400 }}
                >
                  <Send size={14} /> {submitting ? '제출 중…' : '제출하기'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const c = gradeChipColor[grade] ?? gradeChipColor.B;
  return (
    <span className="px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      {grade}
    </span>
  );
}

function SelfSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </PageContainer>
  );
}
