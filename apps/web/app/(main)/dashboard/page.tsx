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
import { useDashboard } from '@/hooks/useDashboard';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { useKpis } from '@/hooks/useKpis';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useMonthlyPerformanceSummary } from '@/hooks/useMonthlyPerformance';
import { schedulePhaseText, positionLabel } from '@/lib/ui';
import { canEvaluateDownward } from '@/lib/nav';
import { ErrorState, Skeleton } from '@/components/States';
import { PageContainer } from '@/components/PageContainer';
import { T, gradeChipColor } from '@/lib/toss';
import type { Grade, EvalStatus, CycleStatus } from '@/lib/types';

// ── Kinetic Enterprise 팔레트 (루트 DESIGN.md SSOT) ──────────────
// 목업의 indigo/slate 임의색을 DESIGN.md 팔레트로 치환한다.
const K = {
  primary: '#3f2c80', // deep purple — 브랜드·구조
  primaryContainer: '#564599', // 사이드바·강조 면
  secondary: '#0054ca', // true blue — 액션·링크·진행
  secondaryDim: '#336fe5',
  tertiary: '#0e9aa0', // teal — 성공·완료·게이지 강조(접근성 대비 보정)
  tertiaryBright: '#2ddbe4',
  surface: '#f8f9fd', // 캔버스(배경)
  white: '#ffffff',
} as const;

// Level 1 카드 — DESIGN.md: white, 1px border, soft 보라 틴트 그림자, 8px radius.
const CARD_SHADOW = '0 4px 12px rgba(86, 69, 153, 0.05)';
const RADIUS = 8;

const gradeColor = (g: Grade): string => gradeChipColor[g]?.bg ?? T.grey400;

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${wd})`;
}

function fmtAmount(n: number): string {
  // 억원 단위 표기(달성률 게이지 보조 수치).
  const eok = n / 1e8;
  if (Math.abs(eok) >= 0.1) return `${eok.toFixed(1)}`;
  const man = n / 1e4;
  return `${Math.round(man).toLocaleString()}`;
}

function amountUnit(n: number): string {
  return Math.abs(n / 1e8) >= 0.1 ? '억원' : '만원';
}

// ── 공용 카드 프리미티브 (8px radius · Level1 그림자 · 24px 패딩) ──
function Card({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: K.white,
        border: `1px solid ${T.grey200}`,
        borderRadius: RADIUS,
        boxShadow: CARD_SHADOW,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 17,
        fontWeight: 700,
        color: T.grey900,
        letterSpacing: '-0.2px',
        marginBottom: 14,
      }}
    >
      {children}
    </h3>
  );
}

// ── 진행 단계 상태 ──────────────────────────────────────────────
type StepState = 'done' | 'active' | 'pending';

const STEP_META: Record<
  StepState,
  { label: string; bg: string; fg: string; tile: string; tileFg: string }
> = {
  done: { label: '완료', bg: 'transparent', fg: K.tertiary, tile: 'rgba(14,154,160,0.10)', tileFg: K.tertiary },
  active: { label: '진행중', bg: 'transparent', fg: K.secondary, tile: 'rgba(0,84,202,0.10)', tileFg: K.secondary },
  pending: { label: '대기', bg: 'transparent', fg: T.grey400, tile: T.grey100, tileFg: T.grey400 },
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
    <Card
      style={{ padding: 20 }}
      className="flex flex-col items-center text-center"
    >
      <div
        className="flex items-center justify-center"
        style={{ width: 44, height: 44, borderRadius: RADIUS, background: m.tile, marginBottom: 12 }}
      >
        <Icon size={20} color={m.tileFg} strokeWidth={2} />
      </div>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: state === 'pending' ? T.grey400 : T.grey600 }}>
        {title}
      </p>
      <div className="flex items-center gap-1" style={{ marginTop: 6 }}>
        <StatusIcon size={13} color={m.fg} strokeWidth={2.4} />
        <span style={{ fontSize: 13, fontWeight: 700, color: m.fg }}>{m.label}</span>
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
  const startA = Math.PI; // 180°
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
    <div style={{ position: 'relative', width: 180, height: 104 }}>
      <svg width={180} height={100} viewBox="0 0 180 100">
        <path d={arc(startA, 0)} fill="none" stroke={T.grey100} strokeWidth={18} strokeLinecap="round" />
        {clamped > 0 && (
          <path
            d={arc(startA, endA)}
            fill="none"
            stroke={K.tertiary}
            strokeWidth={18}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div
        className="flex flex-col items-center"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 4 }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: T.grey900,
            letterSpacing: '-1px',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {Math.round(clamped)}
          <span style={{ fontSize: 20 }}>%</span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.grey400, marginTop: 4 }}>달성률</span>
      </div>
    </div>
  );
}

// ── 목표보드/그룹 진행 막대 1행 ──────────────────────────────────
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
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 38, height: 38, borderRadius: RADIUS, background: T.grey50 }}
      >
        <Icon size={18} color={T.grey600} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.grey800 }}>{label}</span>
          <span
            style={{ fontSize: 14, fontWeight: 800, color: T.grey900, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(pct)}%
          </span>
        </div>
        <div style={{ width: '100%', height: 8, background: T.grey100, borderRadius: RADIUS, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${clamped}%`,
              background: clamped >= 100 ? K.tertiary : K.secondary,
              borderRadius: RADIUS,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedId, current, loading: cyclesLoading } = useCurrentCycle();
  const enabled = !!user;

  // 봉투 unwrap 은 apiGet 래퍼가 처리 — 여기서는 .data 만 사용.
  const { data, loading, error, reload } = useDashboard(selectedId, { enabled });
  const { data: phase } = useCurrentPhase(selectedId, { enabled });

  // 5단계 진행 도출용(인사평가 메인과 동일 데이터 소스).
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

  // 내 KPI 달성률 — 소속 부서의 누적 실적 요약(달성률·목표·실적·그룹별).
  const { data: perf } = useMonthlyPerformanceSummary(
    { cycleId: selectedId ?? undefined, departmentId: user?.departmentId ?? undefined },
    { enabled: enabled && !!selectedId && !!user?.departmentId },
  );

  // 평가 일정 타임라인(현재 phase 의 schedules → 라벨·날짜·상태).
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

  // ── 5단계 진행 상태 ──
  const selfEval = selfEvals?.data[0] ?? null;
  const selfStatus: EvalStatus = selfEval?.status ?? 'not_started';
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';
  const selfActive = selfStatus === 'in_progress';

  const kpiList = myKpis?.data ?? [];
  const kpiConfirmed = kpiList.length > 0 && kpiList.every((k) => k.status === 'confirmed');
  const kpiStarted = kpiList.length > 0;

  // 부서장(1차/2차) 평가 진척 — round 로 팀장(1)·본부장(2) 구분.
  const dwAll = downwardEvals?.data ?? [];
  const dwDone = (round: number) => {
    const set = dwAll.filter((e) => e.round === round);
    if (set.length === 0) return null; // 대상 없음
    return set.every((e) => e.status === 'submitted' || e.status === 'finalized');
  };
  const dwStarted = (round: number) =>
    dwAll.some((e) => e.round === round && (e.status === 'in_progress' || e.status === 'submitted' || e.status === 'finalized'));

  const cycleStatus: CycleStatus | undefined = current?.status ?? data.cycleStatus;
  const isClosed = cycleStatus === 'closed';
  const hasResult = data.me?.hasResult ?? isClosed;

  // 단계별 상태 산출(실데이터 기반).
  const step1: StepState = kpiConfirmed ? 'done' : kpiStarted ? 'active' : 'pending';
  const step2: StepState = selfDone ? 'done' : selfActive ? 'active' : 'pending';
  const lead1Done = dwDone(1);
  const step3: StepState = lead1Done === true ? 'done' : dwStarted(1) ? 'active' : 'pending';
  const lead2Done = dwDone(2);
  const step4: StepState = lead2Done === true ? 'done' : dwStarted(2) ? 'active' : 'pending';
  const step5: StepState = hasResult ? 'done' : isClosed ? 'active' : 'pending';

  const steps: { icon: typeof FileText; title: string; state: StepState }[] = [
    { icon: FileText, title: 'KPI 작성', state: step1 },
    { icon: UserCheck, title: '본인평가', state: step2 },
    { icon: Users, title: '팀장 평가', state: step3 },
    { icon: Building2, title: '본부장 평가', state: step4 },
    { icon: Flag, title: '최종 평가', state: step5 },
  ];

  // ── KPI 달성률 게이지 + 목표보드 데이터 ──
  // 1순위: 부서 실적 요약(perf). 없으면 dashboard 의 teamGoal/groupGrades 폴백.
  const teamGoal = data.teamGoal ?? null;
  const myAchievement =
    perf?.achievementRate ?? teamGoal?.achievementRate ?? data.groupGrades?.[0]?.achievementRate ?? null;
  const gaugePct = myAchievement ?? 0;

  // 게이지 보조 수치(목표/실적) — perf 가 있을 때만 실데이터.
  const gaugeTarget = perf?.targetAmount ?? teamGoal?.targetAmount ?? null;
  const gaugeActual = perf?.actualAmount ?? teamGoal?.actualAmount ?? null;

  // 목표보드: dashboard groupGrades(회사/그룹/팀 범위 달성률)이 있으면 사용.
  const boardRows = (data.groupGrades ?? [])
    .map((g) => ({ label: g.groupName, pct: g.achievementRate }))
    .slice(0, 4);

  // 목표보드 데이터가 없으면 → 내 KPI 그룹별 진행(성과중심/협업·성장)으로 대체.
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
      {/* ── 헤더 ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: T.grey900,
              letterSpacing: '-0.5px',
            }}
          >
            안녕하세요, {user.name} {position}님! 👋
          </h2>
          <p style={{ color: T.grey500, marginTop: 4, fontSize: 14, fontWeight: 500 }}>
            오늘도 목표 달성을 위해 힘차게 나아가세요!
          </p>
        </div>

        {/* 평가 주기·현재 단계 카드 — 알림은 글로벌 헤더 NotificationBell 로 일원화 */}
        <div
          className="flex items-center gap-7"
          style={{
            background: K.white,
            border: `1px solid ${T.grey200}`,
            borderRadius: RADIUS,
            boxShadow: CARD_SHADOW,
            padding: '12px 18px',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ background: T.grey50, borderRadius: RADIUS, padding: 8 }}
            >
              <Calendar size={18} color={T.grey500} />
            </div>
            <div>
              <p style={{ fontSize: 10.5, color: T.grey400, fontWeight: 700 }}>평가 주기</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.grey700 }}>
                {data.cycleName ?? '진행 중인 주기 없음'}
              </p>
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: T.grey200 }} />
          <div>
            <p style={{ fontSize: 10.5, color: T.grey400, fontWeight: 700 }}>현재 단계</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: K.secondary }}>
              {phase?.phase ? schedulePhaseText(phase.phase) : '대기 중'}
            </p>
          </div>
        </div>
      </header>

      {/* ── 나의 평가 진행 상황 (5단계) ── */}
      <section>
        <SectionTitle>나의 평가 진행 상황</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {steps.map((s) => (
            <StepCard key={s.title} icon={s.icon} title={s.title} state={s.state} />
          ))}
        </div>
      </section>

      {/* ── 게이지 · 목표보드 · 평가 일정 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 내 KPI 달성률 */}
        <Card className="flex flex-col" style={{ minHeight: 380 }}>
          <div className="flex items-center justify-between">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.grey900 }}>내 KPI 달성률</h3>
            {me?.hasResult && me.finalGrade && (
              <span
                className="flex items-center justify-center"
                style={{
                  minWidth: 28,
                  height: 24,
                  borderRadius: 999,
                  padding: '0 8px',
                  background: gradeColor(me.finalGrade),
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {me.finalGrade}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center" style={{ padding: '24px 0' }}>
            {myAchievement == null ? (
              <div className="flex flex-col items-center" style={{ color: T.grey400 }}>
                <BarChart3 size={36} color={T.grey300} />
                <p style={{ fontSize: 13, marginTop: 10 }}>실적 데이터가 아직 없어요.</p>
              </div>
            ) : (
              <HalfGauge pct={gaugePct} />
            )}
          </div>

          {gaugeTarget != null && gaugeActual != null ? (
            <div
              className="grid grid-cols-2"
              style={{ paddingTop: 16, borderTop: `1px solid ${T.grey100}` }}
            >
              <div className="text-center">
                <p style={{ fontSize: 11.5, color: T.grey400, fontWeight: 700, marginBottom: 4 }}>목표</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: T.grey800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtAmount(gaugeTarget)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{amountUnit(gaugeTarget)}</span>
                </p>
              </div>
              <div className="text-center" style={{ borderLeft: `1px solid ${T.grey100}` }}>
                <p style={{ fontSize: 11.5, color: T.grey400, fontWeight: 700, marginBottom: 4 }}>실적</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: T.grey800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtAmount(gaugeActual)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{amountUnit(gaugeActual)}</span>
                </p>
              </div>
            </div>
          ) : me?.finalScore != null ? (
            <div
              className="grid grid-cols-2"
              style={{ paddingTop: 16, borderTop: `1px solid ${T.grey100}` }}
            >
              <div className="text-center">
                <p style={{ fontSize: 11.5, color: T.grey400, fontWeight: 700, marginBottom: 4 }}>최종 점수</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: T.grey800, fontVariantNumeric: 'tabular-nums' }}>
                  {me.finalScore.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500 }}>점</span>
                </p>
              </div>
              <div className="text-center" style={{ borderLeft: `1px solid ${T.grey100}` }}>
                <p style={{ fontSize: 11.5, color: T.grey400, fontWeight: 700, marginBottom: 4 }}>분위</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: T.grey800, fontVariantNumeric: 'tabular-nums' }}>
                  {me.percentile != null ? `상위 ${me.percentile}%` : '—'}
                </p>
              </div>
            </div>
          ) : null}
        </Card>

        {/* 목표보드 또는 그룹별 진행(대체) */}
        <Card className="flex flex-col" style={{ minHeight: 380 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.grey900 }}>
              {boardRows.length > 0 ? '목표보드' : 'KPI 그룹별 진행'}
            </h3>
            {boardRows.length > 0 && (
              <button
                onClick={() => router.push('/reports')}
                className="flex items-center gap-1"
                style={{ fontSize: 12, fontWeight: 700, color: K.secondary }}
              >
                전체 보기 <ArrowRight size={12} />
              </button>
            )}
          </div>
          <div className="flex flex-1 flex-col justify-start" style={{ gap: 26 }}>
            {boardRows.length > 0 ? (
              boardRows.map((row, i) => (
                <ProgressRow key={i} icon={Building2} label={row.label} pct={row.pct} />
              ))
            ) : groupFallback ? (
              groupFallback.map((row, i) => (
                <ProgressRow key={i} icon={ClipboardList} label={row.label} pct={row.pct} />
              ))
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center" style={{ color: T.grey400 }}>
                <Flag size={32} color={T.grey300} />
                <p style={{ fontSize: 13, marginTop: 10 }}>목표 달성률 데이터가 아직 없어요.</p>
              </div>
            )}
          </div>
        </Card>

        {/* 평가 일정 */}
        <Card className="flex flex-col" style={{ minHeight: 380 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.grey900 }}>평가 일정</h3>
          </div>
          <div className="flex-1">
            {timeline.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center" style={{ color: T.grey400 }}>
                <Calendar size={32} color={T.grey300} />
                <p style={{ fontSize: 13, marginTop: 10 }}>예정된 일정이 없어요.</p>
              </div>
            ) : (
              <ol>
                {timeline.map((t, i) => {
                  const isLast = i === timeline.length - 1;
                  const dotColor =
                    t.state === 'done' ? K.tertiary : t.state === 'active' ? K.primary : T.grey300;
                  return (
                    <li key={i} className="flex items-stretch gap-3">
                      {/* 점·라인 */}
                      <div className="flex flex-col items-center">
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: dotColor,
                            marginTop: 3,
                          }}
                        />
                        {!isLast && (
                          <span style={{ flex: 1, width: 2, background: T.grey100, marginTop: 2 }} />
                        )}
                      </div>
                      {/* 내용 */}
                      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: t.state === 'pending' ? 600 : 700,
                              color: t.state === 'pending' ? T.grey400 : T.grey800,
                            }}
                          >
                            {t.label}
                          </span>
                          <StatusBadge state={t.state} />
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: t.state === 'active' ? K.primary : T.grey400,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {t.date}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>
      </div>

      {/* ── 바로가기 ── */}
      <section>
        <SectionTitle>바로가기</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'KPI 작성', icon: FileText, href: '/kpi' },
            { label: '본인평가', icon: UserCheck, href: '/eval/self' },
            { label: '내 평가표', icon: ClipboardList, href: '/eval/my' },
            { label: '평가결과', icon: BarChart3, href: '/eval/result' },
          ].map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.href}
                onClick={() => router.push(q.href)}
                className="group flex items-center transition-all"
                style={{
                  background: K.white,
                  border: `1px solid ${T.grey200}`,
                  borderRadius: RADIUS,
                  boxShadow: CARD_SHADOW,
                  padding: 20,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = K.secondaryDim)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = T.grey200)}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ background: T.grey50, borderRadius: RADIUS, padding: 12, marginRight: 14 }}
                >
                  <Icon size={20} color={T.grey700} />
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, color: T.grey800, fontSize: 14 }}>
                  {q.label}
                </span>
                <ArrowUpRight size={16} color={T.grey400} />
              </button>
            );
          })}
        </div>
      </section>
    </PageContainer>
  );
}

// 평가 일정 상태 배지(Pill — 칩/뱃지는 Pill 허용).
function StatusBadge({ state }: { state: StepState }) {
  const cfg = {
    done: { label: '완료', bg: T.grey100, color: T.grey500 },
    active: { label: '진행 중', bg: 'rgba(0,84,202,0.10)', color: K.secondary },
    pending: { label: '예정', bg: T.grey50, color: T.grey400 },
  }[state];
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        padding: '2px 9px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

// KPI 카테고리 → 그룹 라벨(목표보드 대체 시). 성과중심/협업·성장 그룹 표기.
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
