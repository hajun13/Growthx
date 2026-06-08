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
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Award,
  Target,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDashboard } from '@/hooks/useDashboard';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { schedulePhaseText } from '@/lib/ui';
import { ErrorState, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { T, gradeChipColor } from '@/lib/toss';
import type { Grade } from '@/lib/types';

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 등급(S~D) 의미색 — 하우스 표준(gradeChipColor) 단일 출처. S 우수 → D 미흡.
const gradeColor = (g: Grade): string => gradeChipColor[g]?.bg ?? T.grey400;

// ── 공용 프리미티브 (시각 일관성: 동일 테두리·여백) ──
function Card({
  children,
  dark,
  style,
  className,
}: {
  children: React.ReactNode;
  dark?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: dark ? T.grey900 : '#fff',
        border: `1px solid ${dark ? T.grey800 : T.grey200}`,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// 섹션 구분 라벨 — '진행' vs '성과·결과' 축을 시각적으로 분리.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: T.grey500,
        letterSpacing: '0.02em',
        marginBottom: 10,
        marginTop: 2,
      }}
    >
      {children}
    </div>
  );
}

// scope 범위 뱃지 — '지금 어느 범위를 보는지' 즉시 인지.
function ScopePill({ label }: { label: string }) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: T.grey700,
        background: T.grey50,
        border: `1px solid ${T.grey200}`,
        padding: '4px 10px',
      }}
    >
      <span style={{ width: 6, height: 6, background: T.blue500, borderRadius: 0 }} />
      {label} 범위
    </span>
  );
}

const ChartTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.grey200}`,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div style={{ color: T.grey600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: T.grey900 }}>
        {payload[0].value}% 달성
      </div>
    </div>
  ) : null;

// 남은 일정 — current-phase schedules 에서 dueDate 기준 D-day 산출(공용).
function useSchedule(phase: { schedules?: { phase: string; dueDate: string | null }[] } | null | undefined) {
  return useMemo(() => {
    const items = phase?.schedules ?? [];
    return items
      .filter((s) => s.dueDate)
      .map((s) => {
        const dday = Math.ceil(
          (new Date(s.dueDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return { label: schedulePhaseText(s.phase), date: fmtMonthDay(s.dueDate!), dday };
      })
      .sort((a, b) => a.dday - b.dday);
  }, [phase]);
}

function ScheduleCard({
  schedule,
}: {
  schedule: { label: string; date: string; dday: number }[];
}) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: 16 }}>
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
      {schedule.length === 0 && (
        <div style={{ fontSize: 11.5, color: T.grey400 }}>예정된 일정이 없어요.</div>
      )}
      {schedule.map((s, i) => (
        <div
          key={i}
          style={{
            paddingBottom: i < schedule.length - 1 ? 10 : 0,
            marginBottom: i < schedule.length - 1 ? 10 : 0,
            borderBottom: i < schedule.length - 1 ? `1px solid ${T.grey100}` : 'none',
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
                background: s.dday <= 5 ? T.red500 : s.dday <= 10 ? T.orange500 : T.grey400,
                color: '#fff',
              }}
            >
              D-{s.dday}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: T.grey400, marginTop: 2 }}>{s.date}</div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedId, loading: cyclesLoading } = useCurrentCycle();

  // M4: 모든 인증 사용자 접근. 가시 범위(scope)는 백엔드가 강제.
  const enabled = !!user;
  const { data, loading, error, reload } = useDashboard(selectedId, { enabled });
  const { data: phase } = useCurrentPhase(selectedId, { enabled });
  const schedule = useSchedule(phase);

  if (cyclesLoading || loading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </PageContainer>
    );
  }
  if (error) return <ErrorState onRetry={reload} />;
  if (!data) return <ErrorState onRetry={reload} />;

  // 팀원(self): 본인 평가 요약 화면.
  if (data.scope === 'self') {
    return <SelfDashboard data={data} schedule={schedule} />;
  }
  // 팀장·본부장·그룹장·HR: 조직 현황판(scope 범위로 적응).
  return <OrgDashboard data={data} schedule={schedule} onMain={() => router.push('/eval')} />;
}

// ─────────────────────────── 팀원(self) ───────────────────────────
function SelfDashboard({
  data,
  schedule,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>['data']>;
  schedule: { label: string; date: string; dday: number }[];
}) {
  const router = useRouter();
  const me = data.me;
  const team = data.teamGoal ?? data.groupGrades?.[0] ?? null;
  const teamName =
    team && 'groupName' in team && typeof team.groupName === 'string' ? team.groupName : '조직';
  const submitted = me?.selfSubmitted ?? false;

  const resultGrade = me?.hasResult ? (me.finalGrade as Grade) : null;

  return (
    <PageContainer>
      <PageHeader title="내 평가 현황" subtitle={data.cycleName || undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 196px', gap: 14 }}>
        {/* 내 결과 — 히어로(가장 먼저 눈에 들어와야 할 정보) */}
        <Card dark style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 12, color: T.grey400, fontWeight: 600, letterSpacing: '0.02em' }}>
              내 최종 결과
            </span>
            <Award size={15} color={T.grey500} />
          </div>
          {resultGrade ? (
            <div className="flex items-end gap-4" style={{ marginTop: 8 }}>
              <div
                className="flex items-center justify-center"
                style={{ width: 76, height: 76, background: gradeColor(resultGrade), flexShrink: 0 }}
              >
                <span style={{ fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>
                  {resultGrade}
                </span>
              </div>
              <div style={{ paddingBottom: 4 }}>
                {me?.finalScore != null && (
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
                    {me.finalScore.toFixed(1)}
                    <span style={{ fontSize: 13, color: T.grey400, fontWeight: 500 }}> 점</span>
                  </div>
                )}
                <div style={{ fontSize: 12, color: T.grey400, marginTop: 2 }}>
                  {me?.percentile != null ? `상위 ${me.percentile}%` : '최종 등급'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                산정 전
              </div>
              <div style={{ fontSize: 12, color: T.grey500, marginTop: 4 }}>
                평가가 마감되면 최종 등급이 산정돼요.
              </div>
            </div>
          )}
          <button
            className="flex items-center justify-between transition-all"
            style={{
              marginTop: 18,
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: T.grey800,
              width: '100%',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = T.grey700)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = T.grey800)}
            onClick={() => router.push(resultGrade ? '/eval/result' : '/eval/my')}
          >
            {resultGrade ? '결과 상세 보기' : '내 평가표'} <ArrowRight size={14} />
          </button>
        </Card>

        {/* 내 평가 제출 상태 */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 12, color: T.grey500, fontWeight: 600 }}>본인 평가</span>
            <div
              className="flex items-center justify-center"
              style={{ width: 28, height: 28, background: submitted ? T.green500 : T.orange500 }}
            >
              {submitted ? (
                <CheckCircle size={15} color="#fff" />
              ) : (
                <ClipboardList size={14} color="#fff" />
              )}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.grey900, letterSpacing: '-0.5px' }}>
              {submitted ? '제출 완료' : '작성 필요'}
            </div>
            <div style={{ fontSize: 12, color: T.grey400, marginTop: 3 }}>
              {submitted ? '본인 평가를 제출했어요.' : '아직 제출하지 않았어요.'}
            </div>
          </div>
          <button
            className="flex items-center justify-between transition-all"
            style={{
              marginTop: 16,
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: submitted ? T.grey700 : '#fff',
              background: submitted ? '#fff' : T.blue500,
              border: submitted ? `1px solid ${T.grey300}` : 'none',
              width: '100%',
            }}
            onClick={() => router.push('/eval/self')}
          >
            {submitted ? '본인 평가 보기' : '본인 평가 작성'} <ArrowRight size={14} />
          </button>
        </Card>

        {/* 남은 일정 */}
        <ScheduleCard schedule={schedule} />
      </div>

      {/* 소속 성과 (참고) */}
      {team && (
        <Card style={{ padding: '20px 22px' }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
              소속 {teamName} 성과
            </div>
            <span style={{ fontSize: 11, color: T.grey400 }}>참고 · 연봉 미반영</span>
          </div>
          <div className="flex items-center gap-7">
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.blue600, letterSpacing: '-0.5px' }}>
                {Math.round(team.achievementRate)}%
              </div>
              <div style={{ fontSize: 11, color: T.grey400, marginTop: 1 }}>누적 달성률</div>
            </div>
            {team.currentGrade && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: gradeColor(team.currentGrade), letterSpacing: '-0.5px' }}>
                  {team.currentGrade}
                </div>
                <div style={{ fontSize: 11, color: T.grey400, marginTop: 1 }}>현재 등급</div>
              </div>
            )}
            <div style={{ flex: 1, height: 8, background: T.grey100, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(team.achievementRate, 100)}%`,
                  background: T.blue500,
                }}
              />
            </div>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}

// ─────────────────── 팀장·본부장·그룹장·HR (조직 현황판) ───────────────────
function OrgDashboard({
  data,
  schedule,
  onMain,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>['data']>;
  schedule: { label: string; date: string; dday: number }[];
  onMain: () => void;
}) {
  const isCompany = data.scope === 'company';

  // 완료율(scope 내 전체 평가 제출률).
  const completion = useMemo(() => {
    const p = data.progress;
    const total = (p.self?.total ?? 0) + (p.downward1?.total ?? 0) + (p.downward2?.total ?? 0);
    const done =
      (p.self?.submitted ?? 0) + (p.downward1?.submitted ?? 0) + (p.downward2?.submitted ?? 0);
    return { rate: total > 0 ? done / total : 0, done, total };
  }, [data]);

  // 그룹/부서별 달성률.
  const deptData = useMemo(
    () =>
      (data.groupGrades ?? [])
        .map((g) => ({ dept: g.groupName, rate: Math.round(g.achievementRate) }))
        .sort((a, b) => b.rate - a.rate),
    [data],
  );

  // 달성률 추이.
  const trendData = useMemo(
    () =>
      (data.monthlyTrend ?? []).map((p) => ({
        month: `${p.month}월`,
        rate: Math.round(p.achievementRate),
      })),
    [data],
  );

  // 등급분포(scope 내).
  const dist = data.gradeDistribution?.company ?? { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const distTotal = (['S', 'A', 'B', 'C', 'D'] as Grade[]).reduce((s, g) => s + dist[g], 0);

  // 4개 보조 지표 — 관리자(company)는 운영 현황, 직책자는 '내가 할 일' 우선.
  const stats = useMemo(() => {
    const unsubmitted = data.unsubmittedCount ?? 0;
    const underReview = data.appeals?.under_review ?? 0;
    const appealsTotal = data.appeals?.total ?? 0;
    const myPending = data.myTasks?.pending ?? 0;

    const first = isCompany
      ? {
          label: '진행중',
          value: `${(data.progress?.downward1?.total ?? 0) - (data.progress?.downward1?.submitted ?? 0)}건`,
          sub: '1차 평가 미제출',
          icon: Clock,
          accent: T.orange500,
        }
      : {
          label: '내가 할 일',
          value: `${myPending}건`,
          sub: '내 평가 미완료',
          icon: ClipboardList,
          accent: myPending > 0 ? T.red500 : T.blue500,
        };
    return [
      first,
      { label: '승인 대기', value: `${underReview}건`, sub: '이의 검토 미완료', icon: AlertTriangle, accent: T.red500 },
      { label: '미완료·지연', value: `${unsubmitted}건`, sub: '미제출 평가', icon: AlertTriangle, accent: T.orange500 },
      { label: '이의제기', value: `${appealsTotal}건`, sub: '검토 필요', icon: CheckCircle, accent: '#a234c7' },
    ];
  }, [data, isCompany]);

  const pct = Math.round(completion.rate * 100);
  const r = 43;
  const circumference = 2 * Math.PI * r;

  return (
    <PageContainer>
      <PageHeader
        title="평가 현황 개요"
        subtitle={data.cycleName || undefined}
        right={
          <>
            <ScopePill label={data.scopeLabel} />
            <button
              className="flex items-center gap-1.5 px-4 py-2 text-white transition-all"
              style={{ fontSize: 12.5, fontWeight: 600, background: T.blue500 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = T.blue600)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = T.blue500)}
              onClick={onMain}
            >
              인사평가 메인 <ArrowRight size={13} />
            </button>
          </>
        }
      />

      {/* ── 섹션 1: 평가 진행 현황 ── */}
      <div>
        <SectionLabel>평가 진행 현황</SectionLabel>
        {/* 히어로 행: 진행률 + 4개 지표 + 일정 */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 196px', gap: 14 }}>
        {/* 완료율 원형 */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ background: T.grey900, padding: '24px 16px', border: `1px solid ${T.grey800}` }}
        >
          <svg width={108} height={108} viewBox="0 0 108 108">
            <circle cx={54} cy={54} r={r} fill="none" stroke="#333d4b" strokeWidth={9} />
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
            <text x={54} y={49} textAnchor="middle" fill="#f9fafb" fontSize={22} fontWeight={700}>
              {pct}%
            </text>
            <text x={54} y={64} textAnchor="middle" fill="#6b7684" fontSize={10}>
              {isCompany ? '전체 완료율' : '제출률'}
            </text>
          </svg>
          <div style={{ fontSize: 11, color: T.grey600, marginTop: 10, textAlign: 'center' }}>
            {completion.done}건 완료 · {completion.total}건 중
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
                style={{ background: '#fff', padding: '14px 16px', border: `1px solid ${T.grey200}` }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11.5, color: T.grey500, fontWeight: 500 }}>{s.label}</span>
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
                  <div style={{ fontSize: 11, color: T.grey400, marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

          {/* 남은 일정 */}
          <ScheduleCard schedule={schedule} />
        </div>
      </div>

      {/* ── 섹션 2: 성과 · 결과 ── */}
      <div>
        <SectionLabel>성과 · 결과</SectionLabel>
        {/* 차트 행 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 14 }}>
        {/* 부서별 달성률 */}
        <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: '20px 22px' }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>
                {isCompany ? '그룹별 달성률' : '부서별 달성률'}
              </div>
              <div style={{ fontSize: 11.5, color: T.grey500, marginTop: 3 }}>
                목표 대비 누적 달성률
              </div>
            </div>
            <span style={{ fontSize: 11, color: T.grey400 }}>{data.scopeLabel}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {deptData.length === 0 && (
              <div style={{ fontSize: 11.5, color: T.grey400 }}>실적 데이터가 없어요.</div>
            )}
            {deptData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  style={{
                    width: 88,
                    fontSize: 11.5,
                    color: T.grey600,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.dept}
                </div>
                <div style={{ flex: 1, height: 6, background: T.grey100, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(d.rate, 100)}%`,
                      background: d.rate >= 85 ? T.blue500 : d.rate >= 70 ? T.blue300 : T.grey300,
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

          {/* 등급분포 + 평균 인상률 (결과 축) */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.grey100}` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}>등급 분포</div>
              {data.avgRaiseRate != null && (
                <div style={{ fontSize: 11.5, color: T.grey500 }}>
                  평균 인상률{' '}
                  <span style={{ fontWeight: 700, color: T.blue600 }}>{data.avgRaiseRate}%</span>
                </div>
              )}
            </div>
            {distTotal === 0 ? (
              <div style={{ fontSize: 11.5, color: T.grey400 }}>확정된 결과가 없어요.</div>
            ) : (
              <>
                <div className="flex" style={{ height: 10, overflow: 'hidden' }}>
                  {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) =>
                    dist[g] > 0 ? (
                      <div
                        key={g}
                        style={{ width: `${(dist[g] / distTotal) * 100}%`, background: gradeColor(g) }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="flex flex-wrap" style={{ gap: 12, marginTop: 8 }}>
                  {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <span style={{ width: 8, height: 8, background: gradeColor(g) }} />
                      <span style={{ fontSize: 11, color: T.grey600 }}>
                        {g} <span style={{ fontWeight: 700, color: T.grey900 }}>{dist[g]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 우측: 추이 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', border: `1px solid ${T.grey200}`, padding: '16px 18px', flex: 1 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <Target size={14} color={T.grey500} />
              <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>달성률 추이</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ left: -22, right: 4, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.grey100} vertical={false} />
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
    </PageContainer>
  );
}
