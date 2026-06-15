'use client';

// 평가자정리 표 — 1차(팀장)·2차(본부장)·최종(그룹대표) × 실적/역량 + 합산 + 최종점수/등급.
// 데이터: GET /results/summary?cycleId= (EvaluationResult byType 정규화). 엑셀 "평가자정리" 레이아웃.
import { useMemo, useRef, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useEvaluationSummary } from '@/hooks/useResults';
import { usePositions } from '@/hooks/usePositions';
import { ErrorState, Skeleton, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { ExportButton } from '@/components/ExportButton';
import { getPositionLabel, roleLabel, fmtScore } from '@/lib/ui';
import type { EvaluationSummaryRow, Grade, SummaryStage } from '@/lib/types';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  primary: '#3f2c80',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#797582',
  outlineVariant: '#cac4d2',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

// GRADE_BADGE — 브리프 §4-1 기준 (S=purple, A=blue)
const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#3f2c80', color: '#fff' },
  A: { bg: '#0054ca', color: '#fff' },
  B: { bg: '#4CAF50', color: '#fff' },
  C: { bg: '#FF9800', color: '#fff' },
  D: { bg: '#F44336', color: '#fff' },
};

const card: React.CSSProperties = {
  background: K.white,
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};

// sticky thead th — 위치는 컨테이너에서 결정, 색은 surfaceLow
const th: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: K.onSurfaceVariant,
  background: K.surfaceLow,
  borderBottom: `1px solid rgba(202,196,210,0.4)`,
  borderRight: `1px solid rgba(202,196,210,0.3)`,
  padding: '8px 10px',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};
const stickyTh: React.CSSProperties = {
  ...th,
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

const td: React.CSSProperties = {
  fontSize: 12.5,
  color: K.onSurface,
  borderBottom: `1px solid rgba(202,196,210,0.2)`,
  borderRight: `1px solid rgba(202,196,210,0.2)`,
  padding: '8px 10px',
  whiteSpace: 'nowrap',
};
const numTd: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

function num(v: number | null): string {
  return v == null ? '-' : fmtScore(v);
}

function GradeBadge({ grade }: { grade: Grade }) {
  const c = GRADE_BADGE[grade] ?? GRADE_BADGE.B;
  return (
    <span style={{ background: c.bg, color: c.color, fontWeight: 700, fontSize: 12, padding: '3px 12px', borderRadius: 999 }}>
      {grade}
    </span>
  );
}

// 단계 2칸(실적·역량) 셀 — 옅은 구분 배경.
function StageCells({ s, tint }: { s: SummaryStage; tint: string }) {
  return (
    <>
      <td style={{ ...numTd, background: tint }}>{num(s.perf)}</td>
      <td style={{ ...numTd, background: tint }}>{num(s.comp)}</td>
    </>
  );
}

export default function EvaluationSummaryPage() {
  const { user } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = selectedId ?? current?.id;

  const { data, loading, error, reload } = useEvaluationSummary(cycleId, { enabled: !!cycleId });
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);
  const rows = useMemo<EvaluationSummaryRow[]>(() => data?.data ?? [], [data]);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('전체');

  const groupOptions = useMemo(
    () => ['전체', ...Array.from(new Set(rows.map((r) => r.group).filter((g): g is string => !!g)))],
    [rows],
  );
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (groupFilter !== '전체' && r.group !== groupFilter) return false;
        if (search && !(r.name ?? '').includes(search)) return false;
        return true;
      }),
    [rows, groupFilter, search],
  );

  // 등급 분포 요약.
  const gradeCounts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of filtered) if (r.finalGrade) c[r.finalGrade] += 1;
    return c;
  }, [filtered]);

  // 적용된 필터 칩 표시 — 그룹 필터가 '전체'가 아닐 때.
  const activeGroupFilter = groupFilter !== '전체' ? groupFilter : null;

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="평가 결과표"
        subtitle="1차(팀장)·2차(본부장)·최종(그룹대표) 평가를 합산한 최종 점수·등급을 한눈에 확인하세요."
        cycles={cycles}
        selectedId={cycleId ?? ''}
        onSelectCycle={setSelectedId}
        right={
          cycleId ? (
            <ExportButton
              path={`/excel/export/evaluation-summary?cycleId=${cycleId}`}
              filename={`evaluation-summary-${cycleId}.xlsx`}
            />
          ) : undefined
        }
      />

      {/* 필터 바 */}
      <div
        className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-3"
        style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
      >
        {/* 검색 바 — Pill */}
        <div
          className="flex items-center gap-2"
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            borderRadius: 999,
            padding: '6px 12px',
            background: K.white,
            minWidth: 180,
          }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = K.secondary; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
          onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(202,196,210,0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
        >
          <Search size={13} color={K.onSurfaceVariant} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색"
            className="outline-none flex-1"
            style={{ fontSize: 12.5, background: 'transparent', color: K.onSurface, border: 'none' }}
          />
        </div>

        {/* 그룹 필터 칩 */}
        <div className="flex gap-1.5 flex-wrap">
          {groupOptions.map((g) => {
            const active = groupFilter === g;
            return (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className="rounded-lg transition-colors"
                style={{
                  padding: '6px 12px', fontSize: 11.5, fontWeight: 600,
                  background: active ? K.primary : K.surfaceLow,
                  color: active ? '#fff' : K.onSurfaceVariant,
                  border: `1px solid ${active ? K.primary : K.outlineVariant}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.borderColor = K.primary;
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.borderColor = K.outlineVariant;
                }}
              >
                {g}
              </button>
            );
          })}
        </div>

        {/* 적용된 필터 칩 */}
        {activeGroupFilter && (
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 11, color: K.outline }}>적용:</span>
            <button
              onClick={() => setGroupFilter('전체')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
                background: 'rgba(63,44,128,0.10)',
                color: K.primary,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {activeGroupFilter} ✕
            </button>
          </div>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: K.onSurfaceVariant }}>
          {filtered.length}명
        </span>
      </div>

      {/* 등급 분포 요약 카드 (브리프 §3-1 패턴) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
          const c = GRADE_BADGE[g];
          return (
            <div
              key={g}
              className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-white transition-transform hover:scale-[1.01]"
              style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
            >
              <span
                style={{ background: c.bg, color: c.color, fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 8 }}
              >
                {g}
              </span>
              <div>
                <span
                  className="tabular-nums"
                  style={{ fontSize: 26, fontWeight: 800, color: c.bg, lineHeight: 1.1 }}
                >
                  {gradeCounts[g]}
                </span>
                <span style={{ fontSize: 12, color: K.onSurfaceVariant, marginLeft: 3 }}>명</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 표 */}
      {cyclesLoading || loading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="표시할 평가 결과가 없어요."
          description="선택한 주기에 확정된 평가 결과가 없거나, 아직 집계되지 않았어요."
        />
      ) : (
        <div style={{ ...card, overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                {['NO', '성명', '그룹', '본부', '팀', '직급', '직책'].map((h) => (
                  <th key={h} rowSpan={2} style={stickyTh}>{h}</th>
                ))}
                <th colSpan={2} style={{ ...stickyTh, background: 'rgba(0,84,202,0.06)', color: K.secondary }}>1차 (팀장)</th>
                <th colSpan={2} style={{ ...stickyTh, background: 'rgba(14,154,160,0.06)', color: K.tertiary }}>2차 (본부장)</th>
                <th colSpan={2} style={{ ...stickyTh, background: 'rgba(63,44,128,0.06)', color: K.primary }}>최종 (그룹대표)</th>
                <th colSpan={2} style={{ ...stickyTh, background: K.surfaceLow }}>평가합산</th>
                <th rowSpan={2} style={stickyTh}>최종점수</th>
                <th rowSpan={2} style={stickyTh}>최종등급</th>
              </tr>
              <tr>
                {['실적', '역량', '실적', '역량', '실적', '역량', '실적', '역량'].map((h, i) => (
                  <th key={i} style={{ ...stickyTh, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, rowIdx) => (
                <tr
                  key={r.userId}
                  style={{ background: K.white }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = K.surfaceLow; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = K.white; }}
                >
                  <td style={{ ...numTd, color: K.onSurfaceVariant }}>{r.no}</td>
                  <td style={{ ...td, fontWeight: 600, color: K.onSurface }}>{r.name ?? '-'}</td>
                  <td style={td}>{r.group ?? '-'}</td>
                  <td style={td}>{r.division ?? '-'}</td>
                  <td style={td}>{r.team ?? '-'}</td>
                  <td style={td}>{r.position ? getPositionLabel(r.position, positions) : '-'}</td>
                  <td style={td}>{r.role ? roleLabel[r.role] : '-'}</td>
                  <StageCells s={r.stage1} tint="rgba(0,84,202,0.03)" />
                  <StageCells s={r.stage2} tint="rgba(14,154,160,0.03)" />
                  <StageCells s={r.stageFinal} tint="rgba(63,44,128,0.03)" />
                  <StageCells s={r.sum} tint={K.surfaceLow} />
                  <td style={{ ...numTd, fontWeight: 700, color: K.secondary }}>{num(r.finalScore)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {r.finalGrade ? <GradeBadge grade={r.finalGrade} /> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12, color: K.onSurfaceVariant }}>
        <Download size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
        최종점수·등급은 확정된 값을 그대로 표시해요. 평가합산은 단계 가중치(1차 0.5·2차 0.3·최종 0.2)로 계산돼요.
      </p>
    </PageContainer>
  );
}
