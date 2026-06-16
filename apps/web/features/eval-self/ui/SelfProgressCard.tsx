'use client';

/**
 * SelfProgressCard — 본인평가 진행 요약 + 게이지 바.
 * 4개 통계 수치 + 진행률 바를 한 카드에 표시.
 */
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/StatCard';

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
  return (
    <div className="space-y-3">
      {/* 4개 수치 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="전체 과제"
          value={totalCount}
          sub="건"
          tone="default"
        />
        <StatCard
          label="입력 완료"
          value={doneCount}
          sub="건"
          tone="success"
        />
        <StatCard
          label="진행률"
          value={`${progressPct}%`}
          tone="primary"
        />
        <StatCard
          label="미입력"
          value={missingCount}
          sub="건"
          tone={missingCount > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* 게이지 바 */}
      <div className="bg-card rounded-lg shadow-elev-1 px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-muted-foreground">
            입력 진행률
          </span>
          <span className="tabular-nums text-[13px] font-bold text-foreground flex items-center gap-1">
            {progressPct}%
            {progressPct === 100 && (
              <span className="text-[11px] font-semibold text-[#128240] flex items-center gap-0.5">
                <CheckCircle2 size={12} aria-hidden />
                모두 완료
              </span>
            )}
          </span>
        </div>
        <div className="w-full rounded-full bg-[#E3E3E8]" style={{ height: 8 }}>
          <div
            className="rounded-full transition-all duration-500"
            style={{
              height: 8,
              width: `${progressPct}%`,
              background: progressPct === 100 ? '#128240' : '#7A37D8',
            }}
          />
        </div>
        {missingCount > 0 && !readOnly && (
          <p className="text-[11.5px] text-[#C8353A] mt-1.5 flex items-center gap-1">
            <AlertCircle size={11} aria-hidden />
            아직 {missingCount}개 과제를 입력하지 않았어요. 모두 입력해야 제출할 수
            있어요.
          </p>
        )}
      </div>
    </div>
  );
}
