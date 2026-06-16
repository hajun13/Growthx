'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  ListChecks,
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Info,
} from 'lucide-react';
import { ApiError } from '@growthx/contracts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { EvalReport } from '@/components/EvalReport';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { gradeColor } from '@/lib/grade';
import { fmtScore, positionLabel, cycleTypeLabel } from '@/lib/ui';
import type { Grade, ByTypeEntry, KpiStatus, EvalStatus, CycleType } from '@/lib/types';
import { useMyResultDetail } from '../hooks';

// ── 단계 라벨 ──────────────────────────────────────────────────
const PHASE_LABEL: Record<string, string> = {
  prep: '기준 설정',
  kpi: 'KPI 작성',
  self: '본인평가',
  downward1: '1차 평가 (팀장)',
  downward2: '2차 평가 (본부장)',
  downward3: '최종 평가 (그룹대표)',
  calibration: '캘리브레이션',
  done: '완료',
};

// ── 현재 사이클 유형 배지(틸 톤) ────────────────────────────────
function CyclePhaseBadge({ cycleType }: { cycleType: CycleType | null }) {
  if (!cycleType) return null;
  const label = cycleTypeLabel[cycleType];
  return (
    <span className="px-2 py-1 rounded-lg text-[12px] font-bold border bg-[#2ddbe4]/20 text-[#004f53] border-[#2ddbe4]/40">
      {label}
    </span>
  );
}

// ── 등급 타일(결과 공개 후) — lib/grade dark-on-light(연한 배경 + 어두운 텍스트) ──
function GradeTile({ grade, size = 60, font = 32 }: { grade: Grade | null; size?: number; font?: number }) {
  const c = grade ? gradeColor(grade) : null;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: c ? c.bg : '#eceff4',
        color: c ? c.fg : '#9aa3ad',
        fontSize: font,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 10px',
      }}
    >
      {grade ?? '–'}
    </div>
  );
}

// ── 평가 단계 행 ────────────────────────────────────────────────
function ProcessStepRow({
  index,
  label,
  sub,
  done,
  inProgress,
}: {
  index: number;
  label: string;
  sub: string;
  done: boolean;
  inProgress: boolean;
}) {
  const state = done ? 'done' : inProgress ? 'progress' : 'wait';

  const chip =
    state === 'done'
      ? { text: '완료', cls: 'bg-[#2ddbe4]/20 text-[#004f53] border border-[#2ddbe4]/40' }
      : state === 'progress'
        ? { text: '진행 중', cls: 'bg-[#0054ca]/10 text-[#0054ca]' }
        : { text: '대기', cls: 'bg-[#f2f3f7] text-[#797582]' };

  return (
    <div className="flex items-center justify-between p-3.5 bg-[#f2f3f7] rounded-lg border border-[#cac4d2]/20 hover:border-[#3f2c80]/30 transition-colors group">
      <div className="flex items-center gap-3.5">
        <div className="w-7 h-7 rounded-md bg-[#0054ca] text-white flex items-center justify-center font-bold text-[13px]">
          {index}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[#191c1f] font-semibold text-[14px] leading-[1.5]">{label}</span>
          <span className="text-[12.5px] text-[#484551]">({sub})</span>
        </div>
      </div>
      <span className={`px-3 py-1 text-[12.5px] font-semibold rounded-md ${chip.cls}`}>
        {chip.text}
      </span>
    </div>
  );
}

export function MyEvaluationView() {
  const { user, loading: authLoading } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cycleLoading,
  } = useCurrentCycle();
  const cycleId = current?.id ?? null;
  const [showReport, setShowReport] = useState(false);

  // 결과 상세 — 캘리브레이션 완료 후 공개. 404 = 미공개, 그 외 graceful degrade.
  const { data, loading: resultLoading, error } = useMyResultDetail(user?.id ?? null, cycleId);

  // 현재 단계
  const { data: phase } = useCurrentPhase(cycleId, { enabled: !!cycleId });

  // 내 KPI 목록 (상태별 집계)
  const { data: kpiRes, loading: kpiLoading } = useKpis(
    { cycleId: cycleId ?? undefined, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myKpis = kpiRes?.data ?? [];

  // 내 평가 진행 상태
  const { data: evalRes, loading: evalLoading } = useEvaluations(
    { cycleId: cycleId ?? undefined, evaluateeId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const myEvals = evalRes?.data ?? [];

  const displayName = data?.userName ?? user?.name ?? '내 평가표';
  const displayDept = data?.departmentName ?? '';
  const displayTitle = user ? positionLabel[user.position] : '';

  // ── KPI 상태 집계 ─────────────────────────────────────────────
  // confirmed    → "확정"
  // submitted + approved → "제출·승인"
  // draft        → "작성 중"
  // rejected + revision_requested → "반려·수정요청"
  const kpiSummary = useMemo(() => {
    const total = myKpis.length;
    const count = (s: KpiStatus) => myKpis.filter((k) => k.status === s).length;
    const confirmed = count('confirmed');
    const submitted = count('submitted') + count('approved');
    const draft = count('draft');
    const rejected = count('rejected') + count('revision_requested');
    const weightTotal = myKpis.reduce((acc, k) => acc + (k.weight ?? 0), 0);
    return { total, confirmed, submitted, draft, rejected, weightTotal };
  }, [myKpis]);

  // ── 평가 진행 단계 ────────────────────────────────────────────
  const steps = useMemo(() => {
    const bt = data?.byType;
    const evalDone = (status: EvalStatus | undefined) =>
      status === 'submitted' || status === 'finalized';

    const selfEv = myEvals.find((e) => e.type === 'self');
    const selfDone = bt?.self?.score != null || evalDone(selfEv?.status);

    const downStage = (round: number, entry: ByTypeEntry | undefined) => {
      const ev = myEvals.find((e) => e.type === 'downward' && e.round === round);
      return {
        done: (entry?.score != null) || evalDone(ev?.status),
        inProgress: ev?.status === 'in_progress',
      };
    };
    const s1 = downStage(1, bt?.downward1);
    const s2 = downStage(2, bt?.downward2);
    const s3 = downStage(3, bt?.downward3);

    return [
      { label: '본인평가', sub: '본인 · 참고용', done: selfDone, inProgress: selfEv?.status === 'in_progress' },
      { label: '1차 평가', sub: '팀장', done: s1.done, inProgress: !s1.done && s1.inProgress },
      { label: '2차 평가', sub: '본부장', done: s2.done, inProgress: !s2.done && s2.inProgress },
      { label: '최종 평가', sub: '그룹대표', done: s3.done, inProgress: !s3.done && s3.inProgress },
    ];
  }, [data, myEvals]);

  const loading = authLoading || cycleLoading || resultLoading || kpiLoading || evalLoading;
  if (loading) return <MySkeleton />;

  if (error instanceof ApiError && error.isForbidden) {
    return <Forbidden message="평가표를 볼 권한이 없어요." />;
  }
  const resultUnavailable = error instanceof ApiError && error.status === 404;
  if (error && !resultUnavailable) {
    return <ErrorState />;
  }
  if (!cycleId) {
    return <EmptyState title="진행 중인 평가 주기가 없어요." />;
  }

  const bg = data?.byGroup;
  const summaryCards = data
    ? [
        { label: '종합평가', grade: data.finalGrade, score: data.finalScore },
        { label: '성과중심 (KPI)', grade: bg?.performance_core.grade ?? null, score: bg?.performance_core.score ?? null },
        { label: '협업·성장', grade: bg?.collaboration_growth.grade ?? null, score: bg?.collaboration_growth.score ?? null },
      ]
    : [];

  return (
    // ── 페이지 컨테이너 — AppShell main이 여백(px-4/8 py-6)을 이미 제공, 추가 패딩 금지 ──
    <div className="space-y-6 w-full">

      {/* 평가 완료 배너 — 결과 공개 시 최상단 표시 */}
      {data && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-xl border"
          style={{ background: 'rgba(45,219,228,0.10)', borderColor: 'rgba(45,219,228,0.45)' }}
        >
          <CheckCircle2 size={20} style={{ color: '#004f53', flexShrink: 0 }} />
          <div>
            <p className="text-[14px] font-bold" style={{ color: '#004f53' }}>평가가 완료됐어요</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: '#00626a' }}>
              캘리브레이션이 완료되어 최종 평가 결과가 공개됐습니다. 아래에서 내 결과를 확인하세요.
            </p>
          </div>
        </div>
      )}

      {/* 결과 공개 후 — 피평가자 정보 + 평가 결과 요약 + 버튼 (최상단 노출) */}
      {data && (
        <>
          <div
            className="bg-white rounded-xl border border-[#cac4d2]/50 overflow-hidden"
            style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
          >
            {/* 피평가자 정보 */}
            <div className="px-7 py-6 border-b border-[#e7e8ec]">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
                  style={{ background: '#3182f6' }}
                >
                  {displayName.slice(0, 1)}
                </div>
                <div>
                  <div className="text-[18px] font-bold text-[#191c1f]">
                    {displayName}{' '}
                    <span className="text-[14px] font-normal text-[#6b7684]">{displayTitle}</span>
                  </div>
                  {displayDept && (
                    <div className="text-[13px] text-[#8b95a1] mt-0.5">{displayDept}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 평가 결과 요약 */}
            <div className="p-7 bg-[#f9fafb] border-b border-[#e7e8ec]">
              <div className="text-[13px] font-bold text-[#191c1f] mb-5">평가 결과 요약</div>
              <div className="grid grid-cols-3 gap-4">
                {summaryCards.map((item) => (
                  <div
                    key={item.label}
                    className="bg-white border border-[#e5e8eb] p-5 rounded-xl text-center"
                    style={{ boxShadow: '0 2px 8px rgba(86,69,153,0.04)' }}
                  >
                    <div className="text-[12px] text-[#8b95a1] mb-3">{item.label}</div>
                    <GradeTile grade={item.grade} />
                    <div className="text-[13px] text-[#6b7684]">
                      ({fmtScore(item.score)}점 / 100점)
                    </div>
                  </div>
                ))}
              </div>
              {(data.percentile !== null || data.companyAvg !== null) && (
                <div className="flex gap-5 mt-4 text-[12.5px] text-[#4e5968]">
                  {data.percentile !== null && (
                    <span>
                      전사 상위 <strong className="text-[#191c1f]">{data.percentile}%</strong>
                    </span>
                  )}
                  {data.companyAvg !== null && (
                    <span>
                      전사 평균 <strong className="text-[#191c1f]">{fmtScore(data.companyAvg)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 상세 평가표 보기 버튼 */}
            <div className="px-7 py-6 flex gap-3">
              <button
                onClick={() => setShowReport(true)}
                className="flex flex-1 items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: '#0054ca', border: '1px solid #0054ca' }}
              >
                <FileText size={14} /> 상세 평가표 보기
              </button>
              <Link
                href={`/eval/result/${user!.id}`}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[13px] font-semibold transition-colors hover:bg-[#f2f4f6]"
                style={{ color: '#4e5968', background: '#fff', border: '1px solid #e5e8eb' }}
              >
                평가결과 상세
              </Link>
            </div>
          </div>
        </>
      )}

      {/* 1. 페이지 헤더 */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[20px] font-bold leading-[1.3] text-[#191c1f] tracking-tight">
              내 평가표
            </h2>
            <CyclePhaseBadge cycleType={current?.cycleType ?? null} />
          </div>
          <p className="text-[13px] leading-[1.5] text-[#484551]">
            {current?.name ?? '–'}
          </p>
        </div>

        {/* 사이클 선택 드롭다운 — ChevronDown 표시, 넉넉한 가로폭 */}
        <div className="relative">
          {cycles && cycles.length > 1 ? (
            <>
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                className="appearance-none min-w-[240px] px-4 py-2 pr-10 bg-white border border-[#cac4d2] rounded-lg text-[13px] font-semibold text-[#191c1f] hover:bg-[#f2f3f7] transition-colors cursor-pointer"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#484551]"
              />
            </>
          ) : (
            <div className="flex min-w-[240px] items-center justify-between gap-2 px-4 py-2 bg-white border border-[#cac4d2] rounded-lg text-[13px] font-semibold text-[#191c1f]">
              <span>{current?.name ?? '평가 주기'}</span>
              <ChevronDown size={18} className="text-[#484551]" />
            </div>
          )}
        </div>
      </div>

      {/* 2. 툴스트립 */}
      <div className="flex items-center justify-between border-b border-[#cac4d2]/30 pb-4">
        <div className="flex items-center gap-2.5">
          <ListChecks size={18} color="#0054ca" />
          <span className="text-[16px] font-semibold leading-[1.4] text-[#191c1f]">
            내 KPI
          </span>
          <span className="text-[13px] text-[#484551]">
            {kpiSummary.total}개 · 가중치 합 {kpiSummary.weightTotal}%
          </span>
        </div>
        <Link
          href="/kpi"
          className="flex items-center gap-1 text-[#0054ca] text-[13px] font-semibold hover:underline transition-colors"
        >
          KPI 작성 <ChevronRight size={15} />
        </Link>
      </div>

      {/* 3. 요약 카드 4개 — 테두리 4장 동일(강조 보더 없음), 숫자 색만 구분 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: '확정', value: kpiSummary.confirmed, color: '#0054ca' },
          { label: '제출·승인', value: kpiSummary.submitted, color: '#3f2c80' },
          { label: '작성 중', value: kpiSummary.draft, color: '#797582' },
          { label: '반려·수정요청', value: kpiSummary.rejected, color: '#ba1a1a' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white p-5 rounded-xl border border-[#cac4d2]/50 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] cursor-pointer"
            style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
          >
            <span className="text-[#484551] text-[13px] font-semibold tracking-[0.01em] mb-1.5">
              {card.label}
            </span>
            <span
              className="tabular-nums text-[34px] font-extrabold leading-[1.2] tracking-[-0.02em]"
              style={{ color: card.color }}
            >
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* 4. 평가 진행 현황 컨테이너 */}
      <div
        className="bg-white rounded-xl border border-[#cac4d2]/50 overflow-hidden"
        style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
      >
        {/* 카드 헤더 */}
        <div className="px-6 py-4 border-b border-[#e7e8ec] flex items-center gap-2.5">
          <ClipboardCheck size={18} color="#0054ca" />
          <h3 className="text-[16px] font-semibold leading-[1.4] text-[#191c1f]">평가 진행 현황</h3>
        </div>

        {/* 카드 본문 */}
        <div className="p-6">
          <p className="text-[12px] font-bold tracking-[0.04em] text-[#484551] mb-3 uppercase">
            평가 프로세스
          </p>
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <ProcessStepRow
                key={step.label}
                index={idx + 1}
                label={step.label}
                sub={step.sub}
                done={step.done}
                inProgress={step.inProgress}
              />
            ))}
          </div>

          {/* 5. 안내 박스 */}
          <div className="mt-6 p-5 bg-[#f2f3f7]/50 rounded-xl border border-dashed border-[#cac4d2] flex items-center gap-3">
            <Info size={20} className="text-[#cac4d2] flex-shrink-0" />
            <p className="text-[13px] leading-[1.5] text-[#484551] italic">
              확정된 평가 결과는 캘리브레이션이 끝나면 이 화면에서 공개돼요.
            </p>
          </div>
        </div>
      </div>

      {/* 현재 단계 안내 배너 */}
      {phase?.phase && (
        <div
          className="bg-white rounded-xl border border-[#cac4d2]/50 px-6 py-4 flex items-center justify-between"
          style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
        >
          <div className="flex items-center gap-2 text-[12.5px] text-[#0054ca]">
            <span className="font-semibold">현재 단계</span>
            <span className="font-bold">{PHASE_LABEL[phase.phase] ?? phase.phase}</span>
            {phase.dueDate && (
              <span className="text-[#484551]">
                · 마감 {new Date(phase.dueDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>
          {(() => {
            if (!phase.dueDate) return null;
            const diff = Math.ceil(
              (new Date(phase.dueDate).getTime() - Date.now()) / 86_400_000,
            );
            if (diff < 0) return null;
            return (
              <span className="text-[11.5px] font-semibold text-[#0054ca]">
                {diff === 0 ? 'D-day' : `D-${diff}`}
              </span>
            );
          })()}
        </div>
      )}

      {/* EvalReport 모달 */}
      {showReport && data && (
        <EvalReport
          data={{
            name: displayName,
            dept: displayDept,
            title: displayTitle,
            finalGrade: data.finalGrade,
            finalScore: data.finalScore,
            percentile: data.percentile,
            companyAvg: data.companyAvg,
            byType: data.byType,
            byGroup: data.byGroup,
            cycleName: current?.name,
          }}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function MySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
