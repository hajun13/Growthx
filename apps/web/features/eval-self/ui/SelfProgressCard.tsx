'use client';

/**
 * SelfProgressCard — 본인평가 진행 요약 (디자인 테스트베드).
 * "AI 대시보드" 느낌(거대 숫자·코너 아이콘 타일·색깔 숫자) 대신
 * 한 카드에 구분선으로 묶은 지표 스트립 + 진행 게이지의 절제된 스타일.
 */
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  totalCount: number;
  doneCount: number;
  progressPct: number;
  missingCount: number;
  readOnly: boolean;
}

export function SelfProgressCard({
  totalCount,
  doneCount,
  progressPct,
  missingCount,
  readOnly,
}: Props) {
  const metrics: { label: string; value: React.ReactNode; sub?: string; accent?: string }[] = [
    { label: '전체 과제', value: totalCount, sub: '건' },
    { label: '입력 완료', value: doneCount, sub: '건' },
    { label: '진행률', value: `${progressPct}%` },
    {
      label: '미입력',
      value: missingCount,
      sub: '건',
      accent: missingCount > 0 ? 'text-danger-600' : undefined,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-elev-1">
      {/* 지표 스트립 — 구분선으로 나뉜 4개 지표(아이콘 타일·색깔 숫자 없음) */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
        {metrics.map((m) => (
          <div key={m.label} className="px-5 py-4">
            <p className="text-[12px] font-medium text-muted-foreground">{m.label}</p>
            <p className="mt-1.5 flex items-baseline gap-1">
              <span
                className={`text-[26px] font-bold leading-none tabular-nums ${m.accent ?? 'text-foreground'}`}
              >
                {m.value}
              </span>
              {m.sub && <span className="text-[12px] text-muted-foreground">{m.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* 진행 게이지 — 같은 카드 하단 */}
      <div className="border-t border-border px-5 py-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-muted-foreground">입력 진행률</span>
          <span className="flex items-center gap-1 text-[13px] font-bold tabular-nums text-foreground">
            {progressPct}%
            {progressPct === 100 && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-success-600">
                <CheckCircle2 size={12} aria-hidden />
                모두 완료
              </span>
            )}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressPct === 100 ? 'bg-success-500' : 'bg-primary'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {missingCount > 0 && !readOnly && (
          <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-danger-600">
            <AlertCircle size={11} aria-hidden />
            아직 {missingCount}개 과제를 입력하지 않았어요. 모두 입력해야 제출할 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}
