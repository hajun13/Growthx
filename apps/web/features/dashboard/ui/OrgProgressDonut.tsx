'use client';

// 우리 조직 진행 현황 — 시안: 도넛(전체 진행률) + 범례(완료/진행중/대기/미시작 인원·%) + 상세 링크.
// 데이터는 dashboard summary progress(self/downward1/downward2의 total·submitted·finalized)에서 파생.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { T } from '@/lib/palette';

export interface OrgProgressSlice {
  label: string;
  count: number;
  color: string;
}

interface Props {
  /** 전체 진행률(%) — 단계 rate 평균 */
  totalPct: number;
  slices: OrgProgressSlice[];
  detailHref: string;
}

export function OrgProgressDonut({ totalPct, slices, detailHref }: Props) {
  const total = slices.reduce((acc, s) => acc + s.count, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <section className="flex h-full flex-col rounded-lg border border-border bg-white p-5 shadow-elev-1">
      <h2 className="mb-3 text-[14px] font-semibold text-foreground">우리 조직 진행 현황</h2>
      <div className="flex flex-1 items-center gap-6">
        <div className="relative shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={r} fill="none" stroke={T.grey200} strokeWidth="14" />
            {slices.map((s) => {
              const len = (s.count / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="66" cy="66" r={r} fill="none" stroke={s.color} strokeWidth="14"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[22px] font-bold tabular-nums text-foreground">{totalPct}%</span>
            <span className="text-[11px] text-muted-foreground">전체 진행률</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2.5">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-neutral-800">{s.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {s.count}명 ({Math.round((s.count / total) * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href={detailHref}
        className="mt-3 inline-flex items-center gap-1 self-end text-[12.5px] font-semibold text-primary hover:underline"
      >
        조직 현황 상세 보기
        <ArrowRight size={13} aria-hidden />
      </Link>
    </section>
  );
}
