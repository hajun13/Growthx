'use client';

// 평가자정리 표 — 1차(팀장)·2차(본부장)·최종(그룹대표) × 실적/역량 + 합산 + 최종점수/등급.
// 데이터: GET /results/summary?cycleId= (EvaluationResult byType 정규화). 엑셀 "평가자정리" 레이아웃.
import { useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useEvaluationSummary } from '@/hooks/useResults';
import { usePositions } from '@/hooks/usePositions';
import { ErrorState, Skeleton, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { getPositionLabel, roleLabel, fmtScore } from '@/lib/ui';
import { T, gradeChipColor } from '@/lib/toss';
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

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(202,196,210,0.5)',
  borderRadius: 12,
  boxShadow: CARD_SHADOW,
};
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
  const c = gradeChipColor[grade] ?? gradeChipColor.B;
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

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="평가 결과표"
        subtitle="1차(팀장)·2차(본부장)·최종(그룹대표) 평가를 합산한 최종 점수·등급을 한눈에 확인하세요."
      />

      {/* 필터 바 — 흰 카드로 정돈 */}
      <div
        className="bg-white rounded-xl p-4 flex items-center gap-3 flex-wrap"
        style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: K.onSurfaceVariant }}>평가 주기</span>
        <select
          value={cycleId ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg"
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            padding: '6px 10px',
            fontSize: 12.5,
            background: '#fff',
            color: K.onSurface,
            outline: 'none',
          }}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div
          className="flex items-center gap-2 rounded-full"
          style={{
            border: '1px solid rgba(202,196,210,0.5)',
            padding: '6px 12px',
            background: '#fff',
            minWidth: 180,
          }}
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
              >
                {g}
              </button>
            );
          })}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: K.onSurfaceVariant }}>{filtered.length}명</span>
      </div>

      {/* 등급 분포 요약 칩 */}
      <div className="flex flex-wrap gap-3">
        {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
          const c = gradeChipColor[g];
          return (
            <div
              key={g}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white"
              style={{ border: '1px solid rgba(202,196,210,0.5)', boxShadow: CARD_SHADOW }}
            >
              <span style={{ background: c.bg, color: c.color, fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 999 }}>{g}</span>
              <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: K.onSurface }}>{gradeCounts[g]}</span>
              <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>명</span>
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
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
            <thead>
              <tr>
                {['NO', '성명', '그룹', '본부', '팀', '직급', '직책'].map((h) => (
                  <th key={h} rowSpan={2} style={th}>{h}</th>
                ))}
                <th colSpan={2} style={{ ...th, background: 'rgba(0,84,202,0.06)', color: K.secondary }}>1차 (팀장)</th>
                <th colSpan={2} style={{ ...th, background: 'rgba(14,154,160,0.06)', color: K.tertiary }}>2차 (본부장)</th>
                <th colSpan={2} style={{ ...th, background: 'rgba(63,44,128,0.06)', color: K.primary }}>최종 (그룹대표)</th>
                <th colSpan={2} style={{ ...th, background: K.surfaceLow }}>평가합산</th>
                <th rowSpan={2} style={th}>최종점수</th>
                <th rowSpan={2} style={th}>최종등급</th>
              </tr>
              <tr>
                {['실적', '역량', '실적', '역량', '실적', '역량', '실적', '역량'].map((h, i) => (
                  <th key={i} style={{ ...th, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.userId}>
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
