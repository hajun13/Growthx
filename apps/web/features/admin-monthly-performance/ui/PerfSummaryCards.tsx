'use client';

// 상단 요약 카드 — image 11: 누적매출/누적원가/누적매출총이익/누적이익률/입력완료현황/예상연간달성률/저장상태.
import { CheckCircle2, Save } from 'lucide-react';
import { fmtEok, fmtPct1 } from './perfFormat';

export interface PerfSummaryData {
  revenueActual: number | null;
  revenueTarget: number | null;
  costActual: number | null;
  costTarget: number | null;
  grossActual: number | null;
  grossTarget: number | null;
  marginActual: number | null;
  marginTarget: number | null;
  completeMonths: number;
  projectedAnnualRate: number | null;
  dirty: boolean;
  savedAt: string | null;
}

function achievedPct(actual: number | null, target: number | null): number | null {
  if (actual === null || target === null || target === 0) return null;
  return Math.round((actual / target) * 1000) / 10;
}

export function PerfSummaryCards({ data }: { data: PerfSummaryData }) {
  const revenueRate = achievedPct(data.revenueActual, data.revenueTarget);
  const costRate = achievedPct(data.costActual, data.costTarget);
  const grossRate = achievedPct(data.grossActual, data.grossTarget);
  const marginDelta =
    data.marginActual !== null && data.marginTarget !== null
      ? Math.round((data.marginActual - data.marginTarget) * 10) / 10
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <SummaryCell label="누적 매출" value={fmtEok(data.revenueActual)} sub={revenueRate !== null ? `목표 대비 ${fmtPct1(revenueRate)}` : '목표 미입력'} barPct={revenueRate} barColor="bg-primary" />
      <SummaryCell label="누적 원가" value={fmtEok(data.costActual)} sub={costRate !== null ? `목표 대비 ${fmtPct1(costRate)}` : '목표 미입력'} barPct={costRate} barColor="bg-status-finalized-fg" />
      <SummaryCell label="누적 매출총이익" value={fmtEok(data.grossActual)} sub={grossRate !== null ? `목표 대비 ${fmtPct1(grossRate)}` : '목표 미입력'} barPct={grossRate} barColor="bg-grade-s" />
      <SummaryCell
        label="누적 이익률"
        value={fmtPct1(data.marginActual)}
        sub={marginDelta !== null ? `목표 ${fmtPct1(data.marginTarget)} 대비 ${marginDelta > 0 ? '▲' : '▼'} ${Math.abs(marginDelta)}%p` : '목표 미입력'}
      />
      <SummaryCell label="입력 완료 현황" value={`${data.completeMonths} / 12개월`} bar={<ProgressBar pct={(data.completeMonths / 12) * 100} color="bg-primary" />} />
      <SummaryCell
        label="예상 연간 달성률"
        value={fmtPct1(data.projectedAnnualRate)}
        sub="연간 목표 대비"
        dot
      />
      <div className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-elev-1">
        <div className="text-[11px] font-medium text-muted-foreground">저장 상태</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {data.dirty ? (
            <Save size={15} className="text-status-in-progress-fg" aria-hidden />
          ) : (
            <CheckCircle2 size={15} className="text-status-finalized-fg" aria-hidden />
          )}
          <span className={`text-[13px] font-bold ${data.dirty ? 'text-status-in-progress-fg' : 'text-status-finalized-fg'}`}>
            {data.dirty ? '수정됨' : '저장됨'}
          </span>
        </div>
        {data.savedAt && <div className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">{data.savedAt}</div>}
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  barPct,
  barColor,
  bar,
  dot,
}: {
  label: string;
  value: string;
  sub?: string;
  barPct?: number | null;
  barColor?: string;
  bar?: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-elev-1">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-none tabular-nums text-foreground">{value}</div>
      {sub && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          {dot && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
          {sub}
        </div>
      )}
      {bar}
      {barPct !== undefined && barPct !== null && barColor && <ProgressBar pct={barPct} color={barColor} />}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
