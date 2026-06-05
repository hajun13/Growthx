'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowRight, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDashboard } from '@/hooks/useDashboard';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { schedulePhaseText } from '@/lib/ui';
import { Forbidden, ErrorState, Skeleton } from '@/components/States';
import { T } from '@/lib/toss';

const FONT = 'Pretendard, sans-serif';

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const ChartTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.grey200}`,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: FONT,
      }}
    >
      <div style={{ color: T.grey600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: T.grey900 }}>
        {payload[0].value}% 완료
      </div>
    </div>
  ) : null;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedId, loading: cyclesLoading } = useCurrentCycle();

  // 대시보드: hr_admin·division_head·team_lead 접근 허용. employee 차단.
  const allowed = !!user && user.role !== 'employee';
  const { data, loading, error, reload } = useDashboard(selectedId, {
    enabled: allowed,
  });
  const { data: phase } = useCurrentPhase(selectedId, { enabled: allowed });

  // ── 실제 데이터 → Toss 위젯 형태로 가공 ──
  const completion = useMemo(() => {
    const p = data?.progress;
    if (!p) return { rate: 0, done: 0, total: 0 };
    const totalAll =
      (p.self?.total ?? 0) +
      (p.downward1?.total ?? 0) +
      (p.downward2?.total ?? 0);
    const doneAll =
      (p.self?.submitted ?? 0) +
      (p.downward1?.submitted ?? 0) +
      (p.downward2?.submitted ?? 0);
    return {
      rate: totalAll > 0 ? doneAll / totalAll : 0,
      done: doneAll,
      total: totalAll,
    };
  }, [data]);

  // 그룹별 달성률 — groupGrades 사용.
  const deptData = useMemo(() => {
    const groups = data?.groupGrades ?? [];
    return groups
      .map((g) => ({
        dept: g.groupName,
        rate: Math.round(g.achievementRate),
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [data]);

  // 달성률 추이 — monthlyTrend 사용.
  const trendData = useMemo(() => {
    const trend = data?.monthlyTrend ?? [];
    return trend.map((p) => ({
      month: `${p.month}월`,
      rate: Math.round(p.achievementRate),
    }));
  }, [data]);

  // 4개 보조 지표.
  const stats = useMemo(() => {
    const unsubmitted = data?.unsubmittedCount ?? 0;
    const appealsTotal = data?.appeals?.total ?? 0;
    const underReview = data?.appeals?.under_review ?? 0;
    const downward1 = data?.progress?.downward1;
    const inProgress =
      downward1 != null ? downward1.total - downward1.submitted : 0;
    return [
      {
        label: '진행중',
        value: `${inProgress}명`,
        sub: 'KPI 작성·검토 중',
        icon: Clock,
        accent: T.orange500,
      },
      {
        label: '승인 대기',
        value: `${underReview}건`,
        sub: '검토 미완료',
        icon: AlertTriangle,
        accent: T.red500,
      },
      {
        label: '미완료·지연',
        value: `${unsubmitted}건`,
        sub: '미제출 평가',
        icon: AlertTriangle,
        accent: T.red500,
      },
      {
        label: '이의제기',
        value: `${appealsTotal}건`,
        sub: '검토 필요',
        icon: CheckCircle,
        accent: '#a234c7',
      },
    ];
  }, [data]);

  // 남은 일정 — current-phase schedules 에서 dueDate 기준 D-day 산출.
  const schedule = useMemo(() => {
    const items = phase?.schedules ?? [];
    return items
      .filter((s) => s.dueDate)
      .map((s) => {
        const dday = Math.ceil(
          (new Date(s.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return {
          label: schedulePhaseText(s.phase),
          date: fmtMonthDay(s.dueDate!),
          dday,
        };
      })
      .sort((a, b) => a.dday - b.dday);
  }, [phase]);

  if (!allowed) {
    return <Forbidden message="대시보드는 관리자·직책자만 접근할 수 있어요." />;
  }
  if (cyclesLoading || loading) {
    return (
      <div className="flex flex-col gap-6" style={{ padding: 24 }}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <ErrorState onRetry={reload} />;

  const cyclePeriod = data?.cycleName ?? '2025년 하반기 인사평가';
  const pct = Math.round(completion.rate * 100);
  const r = 43;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: FONT,
      }}
    >
      {/* 상단 타이틀 */}
      <div className="flex items-end justify-between">
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
            {cyclePeriod}
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: T.grey900,
              letterSpacing: '-0.4px',
            }}
          >
            평가 현황 개요
          </h1>
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2 text-white transition-all"
          style={{ fontSize: 12.5, fontWeight: 600, background: T.blue500 }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = T.blue600)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = T.blue500)
          }
          onClick={() => router.push('/eval')}
        >
          인사평가 메인 <ArrowRight size={13} />
        </button>
      </div>

      {/* 히어로 행: 진행률 + 4개 지표 + 일정 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 188px',
          gap: 12,
        }}
      >
        {/* 완료율 원형 */}
        <div
          className="flex flex-col items-center justify-center"
          style={{
            background: T.grey900,
            padding: '24px 16px',
            border: `1px solid ${T.grey800}`,
          }}
        >
          <svg width={108} height={108} viewBox="0 0 108 108">
            <circle
              cx={54}
              cy={54}
              r={r}
              fill="none"
              stroke="#333d4b"
              strokeWidth={9}
            />
            <circle
              cx={54}
              cy={54}
              r={r}
              fill="none"
              stroke={T.blue500}
              strokeWidth={9}
              strokeLinecap="butt"
              strokeDasharray={`${circumference * completion.rate} ${circumference * (1 - completion.rate)}`}
              strokeDashoffset={circumference * 0.25}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '54px 54px' }}
            />
            <text
              x={54}
              y={49}
              textAnchor="middle"
              fill="#f9fafb"
              fontSize={22}
              fontWeight={700}
            >
              {pct}%
            </text>
            <text x={54} y={64} textAnchor="middle" fill="#6b7684" fontSize={10}>
              전체 완료율
            </text>
          </svg>
          <div
            style={{
              fontSize: 11,
              color: T.grey600,
              marginTop: 10,
              textAlign: 'center',
            }}
          >
            {completion.done}명 완료 · {completion.total}명 중
          </div>
        </div>

        {/* 4개 보조 지표 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 10,
          }}
        >
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="flex flex-col justify-between"
                style={{
                  background: '#fff',
                  padding: '14px 16px',
                  border: `1px solid ${T.grey200}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11.5, color: T.grey500, fontWeight: 500 }}>
                    {s.label}
                  </span>
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 26, height: 26, background: s.accent }}
                  >
                    <Icon size={13} color="#fff" strokeWidth={2} />
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: T.grey900,
                      letterSpacing: '-0.5px',
                      marginTop: 6,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: T.grey400, marginTop: 1 }}>
                    {s.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 남은 일정 */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${T.grey200}`,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.grey900,
              marginBottom: 12,
              letterSpacing: '-0.2px',
            }}
          >
            남은 일정
          </div>
          {schedule.map((s, i) => (
            <div
              key={i}
              style={{
                paddingBottom: i < schedule.length - 1 ? 10 : 0,
                marginBottom: i < schedule.length - 1 ? 10 : 0,
                borderBottom:
                  i < schedule.length - 1 ? `1px solid ${T.grey100}` : 'none',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  style={{
                    fontSize: 12,
                    color: s.dday <= 7 ? T.grey900 : T.grey600,
                    fontWeight: s.dday <= 7 ? 600 : 400,
                    lineHeight: 1.3,
                  }}
                >
                  {s.label}
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '1px 7px',
                    flexShrink: 0,
                    background:
                      s.dday <= 5 ? T.red500 : s.dday <= 10 ? T.orange500 : T.grey400,
                    color: '#fff',
                  }}
                >
                  D-{s.dday}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: T.grey400, marginTop: 2 }}>
                {s.date}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 차트 행 */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 12 }}
      >
        {/* 부서별 완료율 */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${T.grey200}`,
            padding: '20px 22px',
          }}
        >
          <div
            className="flex items-baseline justify-between"
            style={{ marginBottom: 18 }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
                부서별 달성률
              </div>
              <div style={{ fontSize: 11.5, color: T.grey500, marginTop: 3 }}>
                그룹별 목표 대비 누적 달성률
              </div>
            </div>
            <span style={{ fontSize: 11, color: T.grey400 }}>{cyclePeriod}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {deptData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  style={{
                    width: 88,
                    fontSize: 11.5,
                    color: T.grey600,
                    flexShrink: 0,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.dept}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: T.grey100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(d.rate, 100)}%`,
                      background:
                        d.rate >= 85 ? T.blue500 : d.rate >= 70 ? T.blue300 : T.grey300,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 36,
                    fontSize: 12,
                    fontWeight: 600,
                    color: d.rate >= 85 ? T.blue600 : T.grey600,
                    flexShrink: 0,
                    textAlign: 'right',
                  }}
                >
                  {d.rate}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 추이 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: '#fff',
              border: `1px solid ${T.grey200}`,
              padding: '16px 18px',
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.grey900,
                marginBottom: 12,
              }}
            >
              완료율 추이
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={trendData}
                margin={{ left: -22, right: 4, top: 4, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={T.grey100}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: T.grey400 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: T.grey400 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={T.blue500}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: T.blue500, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
