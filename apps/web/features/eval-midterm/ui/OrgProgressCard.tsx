'use client';

// 조직 진척 요약 — C-3. 소속 그룹 월별 누적 추세 + 요약 통계.
// 데이터는 MidtermProgress.org(계약 §2) 재사용 — 신규 엔드포인트 없음. 백엔드가 사용자
// 소속 그룹으로 스코프(범위 셀렉터는 백엔드 미지원 → 표기 캡션으로 대체).
import { useMidtermProgress } from '../hooks';
import { Card } from '@/components/Card';
import { MonthlyTrendChart } from '@/components/MonthlyTrendChart';
import { EmptyState, Skeleton } from '@/components/States';
import { fmtPercent, kpiCategoryLabel } from '@/lib/ui';
import type { KpiCategory, MonthlyTrendPoint } from '@/lib/types';

export function OrgProgressCard({
  cycleId,
  userId,
}: {
  cycleId: string;
  userId: string;
}) {
  const { data, loading } = useMidtermProgress({ cycleId, userId });
  const org = data?.org ?? null;

  // org.monthlyTrend(month·achievementRate) → MonthlyTrendChart 포인트(grade null).
  const points: MonthlyTrendPoint[] = (org?.monthlyTrend ?? []).map((m) => ({
    month: m.month,
    achievementRate: m.achievementRate,
    grade: null,
  }));

  return (
    <Card
      title="조직 진척 요약"
      action={
        org?.departmentName ? (
          <span className="text-[11.5px] text-muted-foreground">
            {org.departmentName} · 월별 누적
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !org || points.length === 0 ? (
        <EmptyState title="아직 집계할 월별 실적이 없어요." />
      ) : (
        <div className="flex flex-col gap-5">
          <MonthlyTrendChart points={points} />

          {/* 요약 통계 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="누적 달성률" value={fmtPercent(org.achievementRate)} />
            <Stat
              label="목표 대비"
              value={fmtPercent(org.achievementRate)}
              sub={org.targetAmount > 0 ? '목표 입력됨' : '목표 미입력'}
            />
            <Stat label="카테고리" value={`${org.byCategory.length}개`} />
          </div>

          {/* 카테고리별 달성률 표 */}
          {org.byCategory.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/60 text-left border-b border-border/40">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      카테고리
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      달성률
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {org.byCategory.map((c) => (
                    <tr
                      key={c.category}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[13px] text-foreground/80 font-medium">
                        {kpiCategoryLabel[c.category as KpiCategory] ?? c.category}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[13px] text-foreground font-semibold">
                        {fmtPercent(c.achievementRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-4 py-3.5 shadow-elev-1">
      <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="tabular-nums text-[22px] font-extrabold text-foreground mt-1 tracking-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
