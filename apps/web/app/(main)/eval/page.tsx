'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useKpis } from '@/hooks/useKpis';
import { useSchedules } from '@/hooks/useSchedules';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { canEvaluateDownward } from '@/lib/nav';
import { T } from '@/lib/toss';
import type { EvalStatus, CycleSchedule } from '@/lib/types';

type TaskStatus = '완료' | '미완료' | '진행중';

// 달력 단계 = Cycle Ops §1 KPI 라이프사이클 5단계.
// ⚠️ id 는 백엔드 일정(CycleSchedule.phase)·schedulePhaseLabel 과 동일 키여야 한다(SSOT).
type PhaseId =
  | 'kpi_selection'
  | 'execution_h1'
  | 'mid_review'
  | 'execution_h2'
  | 'final_review';

type Phase = {
  id: PhaseId;
  label: string;
  shortLabel: string;
  color: string;
  light: string;
  route: string;
};

// mid_review 단계 카드의 route 는 cycle.status 에 따라 동적으로 결정한다(아래 tasks 구성 참조).
const phases: Phase[] = [
  { id: 'kpi_selection', label: 'KPI 선정·작성',   shortLabel: 'KPI 작성',   color: '#3182f6', light: '#f2f4f6', route: '/kpi' },
  { id: 'execution_h1',  label: '상반기 실행관리', shortLabel: '상반기 실행', color: '#0891b2', light: '#f2f4f6', route: '/kpi' },
  { id: 'mid_review',    label: '중간평가',        shortLabel: '중간평가',   color: '#059669', light: '#f2f4f6', route: '/eval/self' },
  { id: 'execution_h2',  label: '하반기 성과관리', shortLabel: '하반기 성과', color: '#7c3aed', light: '#f2f4f6', route: '/kpi' },
  { id: 'final_review',  label: '최종평가',        shortLabel: '최종평가',   color: '#f57800', light: '#f2f4f6', route: '/eval/self' },
];

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

type WeekPhase = { phaseId: PhaseId; startCol: number; span: number; phase: Phase };

// ── 일정 API → 달력 주차 변환 ─────────────────────────────────
// 일정의 phase 키는 곧 Phase.id 와 동일(SSOT). 매핑 테이블 불필요.

function sundayOf(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtMD(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type CalendarWeek = { label: string; dates: string[]; phases: WeekPhase[] };

function buildCalendarWeeks(schedules: CycleSchedule[], phaseDefs: Phase[]): CalendarWeek[] {
  const validIds = new Set<string>(phaseDefs.map((p) => p.id));
  const entries: { phaseId: PhaseId; start: Date; end: Date }[] = [];
  for (const s of schedules) {
    // 정의된 라이프사이클 단계만 달력에 표시(알 수 없는 phase 는 무시).
    if (!validIds.has(s.phase)) continue;
    const phaseId = s.phase as PhaseId;
    const end = new Date(s.dueDate);
    const start = s.startDate ? new Date(s.startDate) : end;
    entries.push({ phaseId, start, end });
  }
  if (entries.length === 0) return [];

  const weekTs = new Set<number>();
  for (const { start, end } of entries) {
    const cur = sundayOf(start);
    const last = sundayOf(end);
    while (cur <= last) {
      weekTs.add(cur.getTime());
      cur.setDate(cur.getDate() + 7);
    }
  }

  return Array.from(weekTs)
    .sort((a, b) => a - b)
    .map(t => {
      const ws = new Date(t);
      const we = new Date(t);
      we.setDate(we.getDate() + 6);

      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        return fmtMD(d);
      });

      const weekPhases: WeekPhase[] = [];
      for (const { phaseId, start, end } of entries) {
        if (end < ws || start > we) continue;
        const phase = phaseDefs.find(p => p.id === phaseId);
        if (!phase) continue;
        const cs = start < ws ? new Date(ws) : new Date(start);
        const ce = end > we ? new Date(we) : new Date(end);
        const startCol = cs.getDay() + 1;
        const span = Math.max(1, Math.round((ce.getTime() - cs.getTime()) / 86_400_000) + 1);
        weekPhases.push({ phaseId, startCol, span, phase });
      }
      weekPhases.sort((a, b) => a.startCol - b.startCol);
      return { label: `${fmtMD(ws)} – ${fmtMD(we)}`, dates, phases: weekPhases };
    })
    .filter(w => w.phases.length > 0);
}

const statusBadge = (status: TaskStatus) => {
  const cfg = {
    완료: { bg: T.green500, color: '#fff', label: '완료' },
    미완료: { bg: T.red500, color: '#fff', label: '미완료' },
    진행중: { bg: T.blue500, color: '#fff', label: '진행중' },
  }[status];
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
        padding: '2px 8px',
      }}
    >
      {cfg.label}
    </span>
  );
};

export default function EvalMainPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    current,
    loading: cyclesLoading,
    error: cyclesError,
    reload,
  } = useCurrentCycle();

  const cycleId = current?.id;

  const { data: schedData, loading: schedLoading } = useSchedules(cycleId, { enabled: !!cycleId });

  const { data: selfEvals } = useEvaluations(
    { cycleId, evaluateeId: user?.id, type: 'self' },
    { enabled: !!cycleId && !!user },
  );
  const { data: myKpis } = useKpis(
    { cycleId, userId: user?.id },
    { enabled: !!cycleId && !!user },
  );
  const { data: downwardEvals } = useEvaluations(
    { cycleId, evaluatorId: user?.id, type: 'downward' },
    { enabled: !!cycleId && !!user && canEvaluateDownward(user.role) },
  );

  const [selected, setSelected] = useState<PhaseId | null>(null);

  // 주차별 단계 배치 — API 일정 데이터에서 동적으로 생성.
  // ⚠️ Hooks 규칙: 아래 조건부 early return 보다 반드시 위에서 호출해야 함.
  const weeks = useMemo(
    () => buildCalendarWeeks(schedData?.data ?? [], phases),
    [schedData],
  );

  if (cyclesLoading || schedLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  if (cyclesError) return <ErrorState onRetry={reload} />;
  if (!current) {
    return (
      <EmptyState
        title="진행 중인 평가 주기가 없어요."
        description="평가 주기가 시작되면 일정과 할 일이 표시돼요."
      />
    );
  }

  // ── 실제 데이터 → 단계별 상태 ──
  const selfEval = selfEvals?.data[0] ?? null;
  const selfStatus: EvalStatus = selfEval?.status ?? 'not_started';
  const selfDone = selfStatus === 'submitted' || selfStatus === 'finalized';

  const kpiList = myKpis?.data ?? [];
  const kpiConfirmed =
    kpiList.length > 0 && kpiList.every((k) => k.status === 'confirmed');

  const isDownwardEvaluator = !!user && canEvaluateDownward(user.role);
  const downwardPending =
    downwardEvals?.data.filter(
      (e) => e.status === 'not_started' || e.status === 'in_progress',
    ).length ?? 0;
  // 부서장 평가 상태: 대상이 1건 이상 + 전원 제출완료일 때만 '완료'.
  // 대상 0건(아직 배정 전)이나 일부만 끝나면 완료로 표시하지 않는다(완료 오표시 버그 수정).
  const downwardTotal = downwardEvals?.data.length ?? 0;
  const downwardDone =
    downwardEvals?.data.filter(
      (e) => e.status === 'submitted' || e.status === 'finalized',
    ).length ?? 0;
  const downwardStatus: TaskStatus =
    downwardTotal > 0 && downwardDone === downwardTotal
      ? '완료'
      : downwardDone > 0
        ? '진행중'
        : '미완료';

  const selfTaskStatus: TaskStatus = selfDone
    ? '완료'
    : selfStatus === 'in_progress'
      ? '진행중'
      : '미완료';

  // 현재 주기가 중간 점검 단계면 mid_review 카드/할일을 /eval/midterm 으로 분기(블록③ §4).
  const isMidReviewNow = current.status === 'mid_review';

  const tasks: Record<
    PhaseId,
    { status: TaskStatus; description: string; actionLabel: string; route?: string }
  > = {
    kpi_selection: {
      status: kpiConfirmed ? '완료' : kpiList.length > 0 ? '진행중' : '미완료',
      description: kpiConfirmed
        ? 'KPI 과제를 모두 확정했어요.'
        : 'KPI 과제를 작성·확정하세요.',
      actionLabel: kpiConfirmed ? 'KPI 확인하기' : 'KPI 작성하기',
    },
    execution_h1: {
      status: '진행중',
      description: '상반기 KPI 실적을 입력·관리하세요.',
      actionLabel: '실적 관리하기',
    },
    mid_review: isMidReviewNow
      ? {
          // 중간 점검 활성: 진척 점검 + 부서장 피드백 진입(등급 미반영).
          status: selfTaskStatus,
          description: '상반기 진척을 점검하고 부서장과 피드백을 나눠요. (등급 미반영)',
          actionLabel: '중간 점검하기',
          route: '/eval/midterm',
        }
      : {
          // 다른 단계: 기존대로 본인평가 이력 조회(혼선 방지).
          status: selfTaskStatus,
          description: '중간 성과를 점검하고 본인평가를 작성하세요.',
          actionLabel: selfDone ? '본인평가 확인하기' : '평가하기',
        },
    execution_h2: {
      status: '진행중',
      description: '하반기 KPI 실적을 입력·관리하세요.',
      actionLabel: '실적 관리하기',
    },
    final_review: {
      status: selfTaskStatus,
      description: isDownwardEvaluator
        ? `최종 본인평가 후 부서장 평가가 진행돼요.${downwardPending > 0 ? ` (${downwardPending}명 미평가)` : ''}`
        : '최종 본인평가를 작성하면 부서장 평가가 진행돼요.',
      actionLabel: selfDone ? '본인평가 확인하기' : '평가하기',
    },
  };

  // 진행 중인(미완료) 평가 개수 — 상단 요약.
  const myCount =
    (selfDone ? 0 : 1) + (isDownwardEvaluator && downwardPending > 0 ? 1 : 0);

  function go(route: string) {
    router.push(route);
  }

  return (
    <PageContainer>
      <PageHeader
        title="인사평가 메인"
        subtitle={
          <>
            <span style={{ fontWeight: 600, color: T.blue500 }}>{myCount}개</span>의
            인사평가를 확인하세요.
          </>
        }
        right={
          <button
            className="flex items-center gap-1.5"
            style={{
              fontSize: 12,
              color: T.grey700,
              border: `1px solid ${T.grey200}`,
              background: '#fff',
              padding: '8px 12px',
            }}
          >
            <Megaphone size={13} /> 공지사항
          </button>
        }
      />

      {/* Phase legend */}
      <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
        {phases.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(selected === p.id ? null : p.id)}
            className="flex items-center gap-1.5"
            style={{
              border: `1px solid ${selected === p.id ? p.color : T.grey200}`,
              background: selected === p.id ? p.light : '#fff',
              padding: '6px 10px',
            }}
          >
            <div style={{ width: 8, height: 8, background: p.color }} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: selected === p.id ? 600 : 400,
                color: selected === p.id ? p.color : T.grey600,
              }}
            >
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', overflow: 'hidden', border: `1px solid ${T.grey200}` }}>
        {weeks.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.grey500, fontSize: 13 }}>
            아직 평가 일정이 설정되지 않았어요.{' '}
            <span style={{ color: T.blue500, fontWeight: 600 }}>관리자 설정 → 일정·대상자</span>
            에서 단계별 일정을 입력해 주세요.
          </div>
        )}
        {weeks.length > 0 && <>
        {/* Day headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            borderBottom: '1px solid #EEF2F7',
          }}
        >
          <div style={{ background: T.grey50, padding: '10px 0', borderRight: '1px solid #EEF2F7' }} />
          {weekDays.map((d, i) => (
            <div
              key={d}
              style={{
                padding: '10px 0',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 500,
                color: i === 0 || i === 6 ? T.red500 : T.grey600,
                background: T.grey50,
                borderRight: i < 6 ? '1px solid #EEF2F7' : 'none',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} style={{ borderBottom: wi < weeks.length - 1 ? '1px solid #EEF2F7' : 'none' }}>
            {/* Date row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                borderBottom: `1px solid ${T.grey50}`,
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  borderRight: '1px solid #EEF2F7',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 10.5, color: T.grey500, fontWeight: 500 }}>{week.label}</span>
              </div>
              {week.dates.map((d, di) => (
                <div
                  key={di}
                  style={{
                    padding: '8px 10px',
                    fontSize: 11.5,
                    color: di === 6 ? T.red500 : T.grey600,
                    fontWeight: 500,
                    borderRight: di < 6 ? '1px solid #EEF2F7' : 'none',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Phase bars */}
            <div
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                minHeight: 48,
              }}
            >
              <div style={{ borderRight: '1px solid #EEF2F7' }} />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ borderRight: i < 6 ? '1px solid #EEF2F7' : 'none' }} />
              ))}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  padding: '8px 4px',
                  pointerEvents: 'none',
                }}
              >
                <div />
                {week.phases.map((item, idx) => {
                  const isActive = selected === item.phaseId;
                  const p = item.phase;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelected(selected === p.id ? null : p.id)}
                      className="flex items-center gap-2"
                      style={{
                        gridColumn: `${item.startCol + 1} / span ${item.span}`,
                        height: 32,
                        background: isActive ? p.color : p.light,
                        border: `1px solid ${isActive ? p.color : p.color + '40'}`,
                        padding: '0 12px',
                        pointerEvents: 'all',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          background: isActive ? '#fff' : p.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: isActive ? '#fff' : p.color,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Task detail row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                minHeight: 90,
                borderTop: '1px dashed #EEF2F7',
              }}
            >
              <div style={{ borderRight: '1px solid #EEF2F7' }} />
              {week.phases.map((item, idx) => {
                const task = tasks[item.phaseId];
                const p = item.phase;
                const isShown = !selected || selected === p.id;
                if (!isShown) return null;
                return (
                  <div
                    key={idx}
                    style={{
                      gridColumn: `${item.startCol + 1} / span ${item.span}`,
                      padding: '12px 14px',
                      borderRight: '1px solid #EEF2F7',
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>{statusBadge(task.status)}</div>
                    <p style={{ fontSize: 12, color: T.grey700, lineHeight: 1.55, marginBottom: 10 }}>
                      {task.description}
                    </p>
                    <button
                      onClick={() => go(task.route ?? p.route)}
                      style={{
                        fontSize: 11.5,
                        color: p.color,
                        fontWeight: 600,
                        borderBottom: `1px solid ${p.color}40`,
                        paddingBottom: 1,
                      }}
                    >
                      {task.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        </>}
      </div>

      {/* 내 할 일 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {[
          {
            title: 'KPI 작성',
            status: tasks.kpi_selection.status,
            actionLabel: kpiConfirmed ? '확인하기' : '작성하기',
            route: '/kpi',
          },
          // mid_review 면 "본인평가" → "중간 점검"(route /eval/midterm). 그 외엔 기존 본인평가.
          isMidReviewNow
            ? {
                title: '중간 점검',
                status: selfTaskStatus,
                actionLabel: selfDone ? '점검 확인하기' : '점검하기',
                route: '/eval/midterm',
              }
            : {
                title: '본인평가',
                status: selfTaskStatus,
                actionLabel: selfDone ? '확인하기' : '평가하기',
                route: '/eval/self',
              },
          {
            title: '결과 조회',
            status: (current.status === 'closed' ? '완료' : '미완료') as TaskStatus,
            actionLabel: current.status === 'closed' ? '결과 보기' : '공개예정',
            route: `/eval/result/${user?.id}?cycleId=${current.id}`,
            disabled: current.status !== 'closed',
          },
          // 부서장: mid_review 면 "부서장 중간 확인"(route /eval/midterm), 그 외엔 "부서장 평가".
          ...(isDownwardEvaluator
            ? [
                isMidReviewNow
                  ? {
                      title: '부서장 중간 확인',
                      status: '미완료' as TaskStatus,
                      actionLabel: '확인하러 가기',
                      route: '/eval/midterm',
                    }
                  : {
                      title: '부서장 평가',
                      status: downwardStatus,
                      actionLabel: downwardStatus === '완료' ? '확인하기' : '평가하기',
                      route: '/eval/dept-head',
                    },
              ]
            : []),
        ].map((c, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              border: `1px solid ${T.grey200}`,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 15, fontWeight: 600, color: T.grey900 }}>{c.title}</span>
              {statusBadge(c.status)}
            </div>
            <button
              onClick={() => !(c as any).disabled && go(c.route)}
              disabled={(c as any).disabled}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: '8px 0',
                border: `1px solid ${T.grey200}`,
                background: (c as any).disabled ? T.grey50 : '#fff',
                color: (c as any).disabled ? T.grey400 : T.grey700,
                cursor: (c as any).disabled ? 'default' : 'pointer',
              }}
            >
              {c.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
