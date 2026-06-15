'use client';

// 조직 진척 요약 — C-3. 소속 그룹 월별 누적 추세 + 요약 통계.
// 데이터는 MidtermProgress.org(계약 §2) 재사용 — 신규 엔드포인트 없음. 백엔드가 사용자
// 소속 그룹으로 스코프(범위 셀렉터는 백엔드 미지원 → 표기 캡션으로 대체).
import { useMidtermProgress } from '@/hooks/useMidterm';
import { Card } from '@/components/Card';
import { MonthlyTrendChart } from '@/components/MonthlyTrendChart';
import { EmptyState, Skeleton } from '@/components/States';
import { fmtPercent, kpiCategoryLabel } from '@/lib/ui';
import { T } from '@/lib/toss';
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
          <span style={{ fontSize: 11.5, color: T.grey500 }}>
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
        <div className="flex flex-col gap-4">
          <MonthlyTrendChart points={points} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="누적 달성률" value={fmtPercent(org.achievementRate)} />
            <Stat
              label="목표 대비"
              value={`${fmtPercent(org.achievementRate)}`}
              sub={org.targetAmount > 0 ? '목표 입력됨' : '목표 미입력'}
            />
            <Stat label="카테고리" value={`${org.byCategory.length}개`} />
          </div>

          {org.byCategory.length > 0 && (
            <div style={{ overflow: 'hidden', border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12 }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: '#f8f9fd' }} className="text-left">
                    <th className="px-3 py-2.5" style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e7e8ec' }}>카테고리</th>
                    <th className="px-3 py-2.5 text-right" style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e7e8ec' }}>달성률</th>
                  </tr>
                </thead>
                <tbody>
                  {org.byCategory.map((c) => (
                    <tr
                      key={c.category}
                      className="hover:bg-[#f2f3f7] transition-colors"
                      style={{ borderTop: '1px solid #e7e8ec' }}
                    >
                      <td className="px-3 py-2.5" style={{ fontSize: 13, color: '#484551', fontWeight: 500 }}>
                        {kpiCategoryLabel[c.category as KpiCategory] ?? c.category}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ fontSize: 13, color: '#191c1f', fontWeight: 700 }}>
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
    <div
      style={{
        border: '1px solid rgba(202,196,210,0.5)',
        borderRadius: 12,
        padding: '14px 16px',
        background: '#fff',
        boxShadow: '0 4px 12px rgba(86,69,153,0.04)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: '#191c1f', marginTop: 4, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#b3b0bb', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
