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
import { canEvaluateDownward } from '@/lib/nav';
import { T } from '@/lib/toss';
import type { EvalStatus, CycleSchedule } from '@/lib/types';

const FONT = 'Pretendard, sans-serif';

type TaskStatus = '완료' | '미완료' | '진행중';

// 우리 도메인 단계 — 다면(peer)평가 없음. 기준설정 → 본인 → 1차 팀장 → 2차 본부장.
type PhaseId = 'kpi-setup' | 'self-eval' | 'dept-eval1' | 'dept-eval2';

type Phase = {
  id: PhaseId;
  label: string;
  shortLabel: string;
  color: string;
  light: string;
  route: string;
};

const phases: Phase[] = [
  { id: 'kpi-setup', label: '평가기준 설정', shortLabel: '기준 설정', color: '#3182f6', light: '#f2f4f6', route: '/kpi' },
  { id: 'self-eval', label: '본인평가', shortLabel: '본인평가', color: '#0891B2', light: '#f2f4f6', route: '/eval/self' },
  { id: 'dept-eval1', label: '1차 부서장 평가', shortLabel: '1차 부서장', color: '#059669', light: '#f2f4f6', route: '/eval/dept-head' },
  { id: 'dept-eval2', label: '2차 부서장 평가', shortLabel: '2차 부서장', color: '#f57800', light: '#f2f4f6', route: '/eval/dept-head' },
];

const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

type WeekPhase = { phaseId: PhaseId; startCol: number; span: number; phase: Phase };

// ── 일정 API → 달력 주차 변환 ─────────────────────────────────

const PHASE_API_MAP: Partial<Record<string, PhaseId>> = {
  prep:      'kpi-setup',
  self:      'self-eval',
  downward1: 'dept-eval1',
  downward2: 'dept-eval2',
};

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
  const entries: { phaseId: PhaseId; start: Date; end: Date }[] = [];
  for (const s of schedules) {
    const phaseId = PHASE_API_MAP[s.phase];
    if (!phaseId) continue;
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
    selectedId,
    setSelectedId,
    cycles,
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
      <div className="flex flex-col gap-4" style={{ padding: 28 }}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
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

  const tasks: Record<PhaseId, { status: TaskStatus; description: string; actionLabel: string }> = {
    'kpi-setup': {
      status: kpiConfirmed ? '완료' : kpiList.length > 0 ? '진행중' : '미완료',
      description: kpiConfirmed
        ? 'KPI 과제를 모두 확정했어요.'
        : 'KPI 과제를 작성·확정하세요.',
      actionLabel: kpiConfirmed ? 'KPI 확인하기' : 'KPI 작성하기',
    },
    'self-eval': {
      status: selfDone ? '완료' : selfStatus === 'in_progress' ? '진행중' : '미완료',
      description: selfDone
        ? '본인평가를 제출했어요.'
        : '성과중심·협업·성장 KPI 실적을 입력하세요.',
      actionLabel: selfDone ? '본인평가 확인하기' : '평가하기',
    },
    'dept-eval1': {
      status: '미완료',
      description: isDownwardEvaluator
        ? `팀장이 팀원 KPI 성과를 평가합니다.${downwardPending > 0 ? ` (${downwardPending}명 미평가)` : ''}`
        : '팀장이 팀원 KPI 성과를 평가합니다.',
      actionLabel: isDownwardEvaluator ? '평가하기' : '진행 예정',
    },
    'dept-eval2': {
      status: '미완료',
      description: '본부장이 1차 결과를 검토·확정합니다.',
      actionLabel: isDownwardEvaluator ? '평가하기' : '진행 예정',
    },
  };

  // 진행 중인(미완료) 평가 개수 — 상단 요약.
  const myCount =
    (selfDone ? 0 : 1) + (isDownwardEvaluator && downwardPending > 0 ? 1 : 0);

  function go(route: string) {
    router.push(route);
  }

  return (
    <div style={{ padding: 28, fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: T.grey500,
              fontWeight: 500,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            진행중인 평가
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.grey900, letterSpacing: '-0.5px' }}>
            인사평가 메인
          </h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 5 }}>
            <span style={{ fontWeight: 600, color: T.blue500 }}>{myCount}개</span>의
            인사평가를 확인하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
            style={{
              fontSize: 12.5,
              color: T.grey900,
              fontWeight: 600,
              border: `1px solid ${T.grey200}`,
              background: '#fff',
              padding: '8px 10px',
            }}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
        </div>
      </div>

      {/* Phase legend */}
      <div className="flex items-center gap-4" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
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
                      onClick={() => go(p.route)}
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
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {[
          {
            title: 'KPI 작성',
            status: tasks['kpi-setup'].status,
            actionLabel: kpiConfirmed ? '확인하기' : '작성하기',
            route: '/kpi',
          },
          {
            title: '본인평가',
            status: tasks['self-eval'].status,
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
          ...(isDownwardEvaluator
            ? [
                {
                  title: '부서장 평가',
                  status: (downwardPending > 0 ? '미완료' : '완료') as TaskStatus,
                  actionLabel: '평가하기',
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
    </div>
  );
}
