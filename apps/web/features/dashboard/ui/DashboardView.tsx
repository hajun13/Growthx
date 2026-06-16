'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Loader2,
  Circle,
  FileText,
  UserCheck,
  Users,
  Building2,
  Flag,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useMonthlyPerformanceSummary } from '@/hooks/useMonthlyPerformance';
import { schedulePhaseText, positionLabel } from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { ErrorState, Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import { gradeColor } from '@/lib/grade';
import type { EvalStatus, CycleStatus } from '@/lib/types';
import { useDashboardSummary } from '../hooks';

// ── 날짜 포맷 헬퍼 ──────────────────────────────────────────────
function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${wd})`;
}

function fmtAmount(n: number): string {
  const eok = n / 1e8;
  if (Math.abs(eok) >= 0.1) return `${eok.toFixed(1)}`;
  const man = n / 1e4;
  return `${Math.round(man).toLocaleString()}`;
}

function amountUnit(n: number): string {
  return Math.abs(n / 1e8) >= 0.1 ? '억원' : '만원';
}

// ── 진행 단계 상태 ──────────────────────────────────────────────
type StepState = 'done' | 'active' | 'pending';

type StepMeta = {
  label: string;
  tileCls: string;
  fgCls: string;
};

const STEP_META: Record<StepState, StepMeta> = {
  done:    { label: '완료',  tileCls: 'bg-success-50',  fgCls: 'text-success-700' },
  active:  { label: '진행중', tileCls: 'bg-purple-50',   fgCls: 'text-primary' },
  pending: { label: '대기',  tileCls: 'bg-muted',        fgCls: 'text-muted-foreground' },
};

function StepCard({
  icon: Icon,
  title,
  state,
}: {
  icon: typeof FileText;
  title: string;
  state: StepState;
}) {
  const m = STEP_META[state];
  const StatusIcon = state === 'done' ? CheckCircle2 : state === 'active' ? Loader2 : Circle;
  return (
    <Card>
      <div className="flex flex-col items-center text-center gap-3">
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg ${m.tileCls}`}>
          <Icon size={20} aria-hidden className={m.fgCls} strokeWidth={2} />
        </div>
        <p className={`text-[12.5px] font-semibold ${state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
          {title}
        </p>
        <div className={`flex items-center gap-1 ${m.fgCls}`}>
          <StatusIcon size={13} strokeWidth={2.4} aria-hidden />
          <span className="text-[13px] font-bold">{m.label}</span>
        </div>
      </div>
    </Card>
  );
}

// ── 반원 게이지(SVG) — KPI 달성률 ──────────────────────────────
function HalfGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 70;
  const cx = 90;
  const cy = 90;
  const startA = Math.PI;
  const endA = Math.PI * (1 - clamped / 100);
  const arc = (a0: number, a1: number) => {
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const large = a0 - a1 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  return (
    <div className="relative" style={{ width: 180, height: 104 }}>
      <svg width={180} height={100} viewBox="0 0 180 100" aria-hidden>
        <path d={arc(startA, 0)} fill="none" stroke="var(--color-muted)" strokeWidth={18} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={arc(startA, endA)}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={18}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="tabular-nums text-[40px] font-extrabold leading-none text-foreground" style={{ letterSpacing: '-1px' }}>
          {Math.round(clamped)}<span className="text-[20px]">%</span>
        </span>
        <span className="text-[11.5px] font-semibold text-muted-foreground mt-1">달성률</span>
      </div>
    </div>
  );
}

// ── 목표보드 진행 막대 1행 ──────────────────────────────────────
function ProgressRow({
  icon: Icon,
  label,
  pct,
}: {
  icon: typeof Building2;
  label: string;
  pct: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-lg bg-muted">
        <Icon size={18} aria-hidden className="text-muted-foreground" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-foreground">{label}</span>
          <span className="text-[14px] font-extrabold tabular-nums text-foreground">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${clamped >= 100 ? 'bg-success-500' : 'bg-primary'}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── 평가 일정 상태 배지 ─────────────────────────────────────────
function TimelineBadge({ state }: { state: StepState }) {
  const cfg: Record<StepState, { label: string; cls: string }> = {
    done:    { label: '완료',   cls: 'bg-muted text-muted-foreground' },
    active:  { label: '진행 중', cls: 'bg-purple-50 text-primary' },
    pending: { label: '예정',   cls: 'bg-muted/50 text-muted-foreground' },
  };
  const { label, cls } = cfg[state];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

// ── KPI 카테고리 라벨 ───────────────────────────────────────────
function kpiCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    revenue: '매출액',
    construction: '공정액',
    orders: '수주·업무수행',
    collaboration: '협업성과',
    development: '자기개발',
  };
  return map[category] ?? category;
}

// ── 바로가기 카드 ───────────────────────────────────────────────
function ShortcutCard({
  label,
  icon: Icon,
  href,
}: {
  label: string;
  icon: typeof FileText;
  href: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="flex items-center gap-3.5 p-5 w-full rounded-lg border border-border bg-card shadow-elev-1 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-center justify-center bg-muted rounded-lg p-3">
        <Icon size={20} aria-hidden className="text-muted-foreground" />
      </div>
      <span className="flex-1 font-bold text-[14px] text-foreground">{label}</span>
      <ArrowUpRight size={16} aria-hidden className="text-muted-foreground" />
    </button>
  );
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export function DashboardView() {
  const { user } = useAuth();
  const { selectedId, current, loading: cyclesLoading } = useCurrentCycle();
  const enabled = !!user;

  const { data, loading, error, reload } = useDashboardSummary(selectedId, { enabled });
  const { data: phase } = useCurrentPhase(selectedId, { enabled });

  const isDownward = !!user && canEvaluateDownward(user.role);
  const { data: selfEvals } = useEvaluations(
    { cycleId: selectedId ?? undefined, evaluateeId: user?.id, type: 'self' },
    { enabled: enabled && !!selectedId },
  );
  const { data: myKpis } = useKpis(
    { cycleId: selectedId ?? undefined, userId: user?.id },
    { enabled: enabled && !!selectedId },
  );
  const { data: downwardEvals } = useEvaluations(
    { cycleId: selectedId ?? undefined, evaluatorId: user?.id, type: 'downward' },
    { enabled: enabled && !!selectedId && isDownward },
  );
  const { data: perf } = useMonthlyPerformanceSummary(
    { cycleId: selectedId ?? undefined, departmentId: user?.departmentId ?? undefined },
    { enabled: enabled && !!selectedId && !!user?.departmentId },
  );

  // 평가 일정 타임라인
  const timeline = useMemo(() => {
    const items = (phase?.schedules ?? []).filter((s) => s.dueDate);
    const activePhase = phase?.phase;
    return items
      .map((s) => {
        const due = new Date(s.dueDate).getTime();
        const start = s.startDate ? new Date(s.startDate).getTime() : due;
        const now = Date.now();
        let state: StepState;
        if (s.phase === activePhase) state = 'active';
        else if (now > due) state = 'done';
        else if (now >= start && now <= due) state = 'active';
        else state = 'pending';
        return { label: schedulePhaseText(s.phase), date: fmtMonthDay(s.dueDate), state, due };
      })
      .sort((a, b) => a.due - b.due);
  }, [phase]);

  if (cyclesLoading || loading) {
    return (
      <PageContainer>
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </PageContainer>
    );
  }
  if (error || !data || !user) return <ErrorState onRetry={reload} />;

  // 5단계 진행 상태 산출
  const selfEval = selfEvals?.data[0] ?? null;
  const selfStatus: EvalStatus = selfEval?.status ?? 'not_started';
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';
  const selfActive = selfStatus === 'in_progress';

  const kpiList = myKpis?.data ?? [];
  const kpiConfirmed = kpiList.length > 0 && kpiList.every((k) => k.status === 'confirmed');
  const kpiStarted = kpiList.length > 0;

  const dwAll = downwardEvals?.data ?? [];
  const dwDone = (round: number) => {
    const set = dwAll.filter((e) => e.round === round);
    if (set.length === 0) return null;
    return set.every((e) => e.status === 'submitted' || e.status === 'finalized');
  };
  const dwStarted = (round: number) =>
    dwAll.some(
      (e) => e.round === round &&
        (e.status === 'in_progress' || e.status === 'submitted' || e.status === 'finalized'),
    );

  const cycleStatus: CycleStatus | undefined =
    current?.status ?? (data.cycleStatus as CycleStatus | undefined);
  const isClosed = cycleStatus === 'closed';
  const hasResult = data.me?.hasResult ?? isClosed;

  const step1: StepState = kpiConfirmed ? 'done' : kpiStarted ? 'active' : 'pending';
  const step2: StepState = selfDone ? 'done' : selfActive ? 'active' : 'pending';
  const lead1Done = dwDone(1);
  const step3: StepState = lead1Done === true ? 'done' : dwStarted(1) ? 'active' : 'pending';
  const lead2Done = dwDone(2);
  const step4: StepState = lead2Done === true ? 'done' : dwStarted(2) ? 'active' : 'pending';
  const step5: StepState = hasResult ? 'done' : isClosed ? 'active' : 'pending';

  const steps: { icon: typeof FileText; title: string; state: StepState }[] = [
    { icon: FileText,     title: 'KPI 작성',   state: step1 },
    { icon: UserCheck,    title: '본인평가',    state: step2 },
    { icon: Users,        title: '팀장 평가',   state: step3 },
    { icon: Building2,    title: '본부장 평가', state: step4 },
    { icon: Flag,         title: '최종 평가',   state: step5 },
  ];

  // KPI 달성률 데이터
  const teamGoal = data.teamGoal ?? null;
  const myAchievement =
    perf?.achievementRate ?? teamGoal?.achievementRate ?? data.groupGrades?.[0]?.achievementRate ?? null;
  const gaugePct = myAchievement ?? 0;

  const gaugeTarget = perf?.targetAmount ?? teamGoal?.targetAmount ?? null;
  const gaugeActual = perf?.actualAmount ?? teamGoal?.actualAmount ?? null;

  const boardRows = (data.groupGrades ?? [])
    .map((g) => ({ label: g.groupName, pct: g.achievementRate }))
    .slice(0, 4);

  const groupFallback =
    perf?.byCategory && perf.byCategory.length > 0
      ? perf.byCategory.map((c) => ({
          label: kpiCategoryLabel(c.category),
          pct: c.achievementRate,
        }))
      : null;

  const me = data.me;
  const position = positionLabel[user.position] ?? '';

  return (
    <PageContainer>
      {/* 헤더 — PageHeader 대신 환영 메시지 형태 유지하되 DS 클래스 사용 */}
      <PageHeader
        title={`안녕하세요, ${user.name} ${position}님`}
        subtitle="오늘도 목표 달성을 위해 힘차게 나아가세요."
        right={
          <div className="flex items-center gap-5 rounded-lg border border-border bg-card shadow-elev-1 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-muted rounded-lg p-2">
                <Calendar size={18} aria-hidden className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10.5px] font-bold text-muted-foreground">평가 주기</p>
                <p className="text-[13px] font-bold text-foreground">
                  {data.cycleName ?? '진행 중인 주기 없음'}
                </p>
              </div>
            </div>
            <div className="w-px h-[30px] bg-border" />
            <div>
              <p className="text-[10.5px] font-bold text-muted-foreground">현재 단계</p>
              <p className="text-[13px] font-bold text-primary">
                {phase?.phase ? schedulePhaseText(phase.phase) : '대기 중'}
              </p>
            </div>
          </div>
        }
      />

      {/* 나의 평가 진행 상황 */}
      <section>
        <h3 className="text-[15px] font-bold text-foreground mb-3">나의 평가 진행 상황</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {steps.map((s) => (
            <StepCard key={s.title} icon={s.icon} title={s.title} state={s.state} />
          ))}
        </div>
      </section>

      {/* 게이지 · 목표보드 · 평가 일정 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 내 KPI 달성률 */}
        <Card title="내 KPI 달성률" action={me?.hasResult && me.finalGrade ? <GradeChip grade={me.finalGrade} /> : undefined}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              {myAchievement == null ? (
                <div className="flex flex-col items-center text-muted-foreground">
                  <BarChart3 size={36} aria-hidden className="text-muted-foreground/40" />
                  <p className="text-[13px] mt-2.5">실적 데이터가 아직 없어요.</p>
                </div>
              ) : (
                <HalfGauge pct={gaugePct} />
              )}
            </div>

            {gaugeTarget != null && gaugeActual != null ? (
              <div className="grid grid-cols-2 border-t border-border pt-4">
                <div className="text-center">
                  <p className="text-[11.5px] font-bold text-muted-foreground mb-1">목표</p>
                  <p className="text-[18px] font-extrabold tabular-nums text-foreground">
                    {fmtAmount(gaugeTarget)}{' '}
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {amountUnit(gaugeTarget)}
                    </span>
                  </p>
                </div>
                <div className="text-center border-l border-border">
                  <p className="text-[11.5px] font-bold text-muted-foreground mb-1">실적</p>
                  <p className="text-[18px] font-extrabold tabular-nums text-foreground">
                    {fmtAmount(gaugeActual)}{' '}
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {amountUnit(gaugeActual)}
                    </span>
                  </p>
                </div>
              </div>
            ) : me?.finalScore != null ? (
              <div className="grid grid-cols-2 border-t border-border pt-4">
                <div className="text-center">
                  <p className="text-[11.5px] font-bold text-muted-foreground mb-1">최종 점수</p>
                  <p className="text-[18px] font-extrabold tabular-nums text-foreground">
                    {me.finalScore.toFixed(1)}{' '}
                    <span className="text-[13px] font-medium text-muted-foreground">점</span>
                  </p>
                </div>
                <div className="text-center border-l border-border">
                  <p className="text-[11.5px] font-bold text-muted-foreground mb-1">분위</p>
                  <p className="text-[18px] font-extrabold tabular-nums text-foreground">
                    {me.percentile != null ? `상위 ${me.percentile}%` : '—'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* 목표보드 또는 그룹별 진행 */}
        <Card
          title={boardRows.length > 0 ? '목표보드' : 'KPI 그룹별 진행'}
          action={
            boardRows.length > 0 ? (
              <button
                type="button"
                onClick={() => void 0}
                className="flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
              >
                전체 보기 <ArrowRight size={12} aria-hidden />
              </button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-[26px]">
            {boardRows.length > 0 ? (
              boardRows.map((row, i) => (
                <ProgressRow key={i} icon={Building2} label={row.label} pct={row.pct} />
              ))
            ) : groupFallback ? (
              groupFallback.map((row, i) => (
                <ProgressRow key={i} icon={ClipboardList} label={row.label} pct={row.pct} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Flag size={32} aria-hidden className="text-muted-foreground/40" />
                <p className="text-[13px] mt-2.5">목표 달성률 데이터가 아직 없어요.</p>
              </div>
            )}
          </div>
        </Card>

        {/* 평가 일정 */}
        <Card title="평가 일정">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Calendar size={32} aria-hidden className="text-muted-foreground/40" />
              <p className="text-[13px] mt-2.5">예정된 일정이 없어요.</p>
            </div>
          ) : (
            <ol>
              {timeline.map((t, i) => {
                const isLast = i === timeline.length - 1;
                const dotCls =
                  t.state === 'done'
                    ? 'bg-success-500'
                    : t.state === 'active'
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30';
                return (
                  <li key={i} className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-3 h-3 rounded-full mt-0.5 ${dotCls}`} />
                      {!isLast && <span className="flex-1 w-0.5 bg-muted mt-0.5" />}
                    </div>
                    <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[13px] font-${t.state === 'pending' ? 'semibold text-muted-foreground' : 'bold text-foreground'}`}
                        >
                          {t.label}
                        </span>
                        <TimelineBadge state={t.state} />
                      </div>
                      <span
                        className={`text-[11.5px] font-semibold tabular-nums ${t.state === 'active' ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        {t.date}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {/* 바로가기 */}
      <section>
        <h3 className="text-[15px] font-bold text-foreground mb-3">바로가기</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'KPI 작성',   icon: FileText,     href: '/kpi' },
            { label: '본인평가',   icon: UserCheck,    href: '/eval/self' },
            { label: '내 평가표',  icon: ClipboardList, href: '/eval/my' },
            { label: '평가결과',   icon: BarChart3,    href: '/eval/result' },
          ].map((q) => (
            <ShortcutCard key={q.href} label={q.label} icon={q.icon} href={q.href} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
