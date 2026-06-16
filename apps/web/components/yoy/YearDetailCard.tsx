'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { RuleSetChip } from './RuleSetChip';
import { fmtScore } from '@/lib/ui';
import { T } from '@/lib/toss';
import type { Grade, OrgSnapshot } from '@/lib/types';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  primary: '#7a37d8',
  secondary: '#7A37D8',
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  outlineVariant: '#ccccd4',
  surfaceLow: '#efeff2',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

// GRADE_BADGE — 브리프 §4-1 기준 (S=purple, A=blue)
const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#7a37d8', color: '#fff' },
  A: { bg: '#2563EB', color: '#fff' },
  B: { bg: '#16a34a', color: '#fff' },
  C: { bg: '#f59e0b', color: '#fff' },
  D: { bg: '#e5484d', color: '#fff' },
};

export interface YearDetailCardProps {
  year: number;
  finalGrade: Grade | null;
  finalScore: number | null;
  perfScore: number | null; // 실적(원형)
  compScore: number | null; // 역량 — null이면 "—", 값 있으면 "(참고)" 캡션
  org: OrgSnapshot;
  // 전년 대비 조직 변경 여부(셀별).
  orgChanged?: { group: boolean; division: boolean; team: boolean };
  // 전년 대비 최종점수 증감(있으면 헤더에 ▲/▼ 신호). 첫 연도면 undefined.
  scoreDelta?: number | null;
  ruleSummary: { competencyIncluded: boolean; perfWeight?: number };
}

function OrgRow({
  label,
  value,
  changed,
}: {
  label: string;
  value: string | null;
  changed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
      {changed && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: K.primary,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{ width: 28, flexShrink: 0, color: K.outline }}
      >
        {label}
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ fontWeight: 500, color: K.onSurface }}
      >
        {value ?? '—'}
      </span>
      {changed && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 600,
            color: K.primary,
          }}
        >
          변경
        </span>
      )}
    </div>
  );
}

// 전년 대비 점수 증감 신호(색만으로 구분 금지 → 화살표 + 부호 텍스트).
function ScoreDelta({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.005) {
    return (
      <span
        className="inline-flex items-center gap-0.5 tabular-nums"
        style={{ fontSize: 11, fontWeight: 600, color: K.outline }}
        title="전년과 동일"
      >
        ±0.00
      </span>
    );
  }
  const up = delta > 0;
  const color = up ? T.green500 : T.red500;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums"
      style={{ fontSize: 11, fontWeight: 600, color }}
      title={`전년 대비 ${up ? '+' : ''}${delta.toFixed(2)}점`}
    >
      <Icon size={11} aria-hidden />
      {up ? '+' : ''}
      {delta.toFixed(2)}
    </span>
  );
}

// 연도별 상세 카드(개인 탭). Kinetic Enterprise 카드. 백엔드 값 표시만.
export function YearDetailCard({
  year,
  finalGrade,
  finalScore,
  perfScore,
  compScore,
  org,
  orgChanged,
  scoreDelta,
  ruleSummary,
}: YearDetailCardProps) {
  const hasDelta = scoreDelta != null && finalScore != null;
  return (
    <div
      className="flex flex-col gap-3 p-4 transition-colors"
      style={{
        background: K.white,
        border: '1px solid rgba(204,204,212,0.5)',
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(122,55,216,0.25)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(204,204,212,0.5)';
      }}
    >
      {/* 헤더: 연도 + 등급 + 점수(전년 대비 증감) */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="tabular-nums"
            style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}
          >
            {year}
          </span>
          {hasDelta && <ScoreDelta delta={scoreDelta as number} />}
        </div>
        <div className="flex items-center gap-2">
          {finalGrade ? (
            <span
              style={{
                background: GRADE_BADGE[finalGrade].bg,
                color: GRADE_BADGE[finalGrade].color,
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 12px',
                borderRadius: 8,
              }}
            >
              {finalGrade}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: K.outlineVariant }}>—</span>
          )}
          <span
            className="tabular-nums"
            style={{ fontSize: 13, fontWeight: 700, color: K.onSurface }}
          >
            {fmtScore(finalScore)}
          </span>
        </div>
      </div>

      {/* 실적 / 역량 */}
      <div
        className="flex flex-col gap-1"
        style={{ borderTop: `1px solid rgba(204,204,212,0.4)`, borderBottom: `1px solid rgba(204,204,212,0.4)`, paddingTop: 10, paddingBottom: 10 }}
      >
        <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
          <span style={{ color: K.outline }}>실적</span>
          <span className="tabular-nums" style={{ fontWeight: 500, color: K.onSurface }}>
            {fmtScore(perfScore)}
          </span>
        </div>
        <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
          <span style={{ color: K.outline }}>역량</span>
          <span className="tabular-nums" style={{ color: K.onSurface }}>
            {compScore == null ? (
              <span aria-hidden>—</span>
            ) : (
              <>
                <span style={{ fontWeight: 500 }}>{fmtScore(compScore)}</span>
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 10,
                    fontWeight: 500,
                    color: K.outline,
                    background: K.surfaceLow,
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}
                >
                  참고용
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* 조직 3줄 */}
      <div className="flex flex-col gap-1">
        <OrgRow label="그룹" value={org.group} changed={orgChanged?.group} />
        <OrgRow label="본부" value={org.division} changed={orgChanged?.division} />
        <OrgRow label="팀" value={org.team} changed={orgChanged?.team} />
      </div>

      {/* RuleSet 칩 */}
      <div className="flex">
        <RuleSetChip
          competencyIncluded={ruleSummary.competencyIncluded}
          perfWeight={ruleSummary.perfWeight}
        />
      </div>
    </div>
  );
}
