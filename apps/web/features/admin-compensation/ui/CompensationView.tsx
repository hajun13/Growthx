'use client';

/**
 * CompensationView — 보상 현황 페이지.
 * semantic <table> + sticky-left 2컬럼(이름·직급) + sticky-top <thead>.
 * 컬럼 정의는 ./columns.ts(buildColumns), 행 렌더는 CompensationRow (~200줄 파일상한 준수).
 *
 * 헤더 그룹 구분:
 *  - 경력(입사일~고려대상 열외) / 연봉(전년도~증감) / 보상조정(조정분~비고)
 *  - groupStart 컬럼에 옅은 보라색 좌측 보더로 시각 구분.
 */

import { useState, useCallback } from 'react';
import { Printer, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { downloadExcel } from '@/lib/excel';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { InfoBanner } from '@/components/InfoBanner';
import { isHrAdmin } from '@/lib/nav';
import { getPositionLabel } from '@/lib/ui';
import { usePositions } from '@/hooks/usePositions';
import { gradeColor } from '@/lib/grade';
import type { Grade, GroupTier } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useTeamCompensationSimulationData } from '../hooks';
import { upsertCompensationAdjustment } from '../api';
import type { CompensationSimulation, UpsertCompensationAdjustmentDto } from '../api';
import { CompensationRow } from './CompensationRow';
import { stickyLeft, buildColumns, GROUP_DIVIDER } from './columns';
import { GRADE_SYSTEM_START_YEAR } from './GradeChip';

const K = {
  primary:           '#3f2c80',
  secondary:         '#0054ca',
  tertiary:          '#0e9aa0',
  surface:           '#f8f9fd',
  surfaceLow:        '#f2f3f7',
  onSurface:         '#191c1f',
  onSurfaceVariant:  '#484551',
  outlineVariant:    '#cac4d2',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';
const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 출력용: 원 → "만원" 문자열.
function printManwon(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v / 10000).toLocaleString()}만원`;
}
function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replace(/-/g, '.') : '—';
}
function calcTenureYears(totalCareerMonths: number | null | undefined): string {
  if (totalCareerMonths == null) return '—';
  return String(Math.floor(totalCareerMonths / 12));
}

export function CompensationView() {
  const { user }  = useAuth();
  const toast     = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId   = current?.id;

  const canView = !!user && (user.role === 'hr_admin' || user.role === 'division_head' || user.role === 'team_lead');
  const canEdit = !!user && isHrAdmin(user.role);

  const [divisionFilter, setDivisionFilter] = useState('전체');
  const [downloading,    setDownloading]    = useState(false);

  const { rows, reload }      = useTeamCompensationSimulationData(cycleId, canView && !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: canView });
  const positions = positionsData?.data ?? [];

  if (!canView) return <Forbidden message="보상 정보는 본부장·관리자만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;

  const divisions = ['전체', ...Array.from(new Set(rows.map((r) => r.divisionName).filter((d): d is string => !!d)))];
  const filtered  = rows.filter((r) => divisionFilter === '전체' || r.divisionName === divisionFilter);
  const gradeRaise       = filtered[0]?.byGrade ?? rows[0]?.byGrade ?? [];
  const valid            = filtered.filter((r) => r.finalProjectedSalary != null && r.currentSalary != null);
  const avgRaise         = valid.length > 0 ? valid.reduce((s, r) => s + (r.finalRaiseRate ?? 0), 0) / valid.length : 0;
  const totalIncreaseWon = valid.reduce((s, r) => s + (r.finalProjectedSalary! - r.currentSalary!), 0);
  const totalIncreaseEok = Math.round((totalIncreaseWon / 1e8) * 10) / 10;
  const sCount           = filtered.filter((r) => r.currentGrade === 'S').length;

  // 조회 사이클 연도 — 행 데이터에서 파생(없으면 null → 폴백 라벨).
  const currentCycleYear: number | null = rows[0]?.currentCycleYear ?? null;
  // 동적 헤더 컬럼 (연도 라벨 반영).
  const DYNAMIC_COLS    = buildColumns(currentCycleYear);
  const dynamicMinWidth = DYNAMIC_COLS.reduce((s, c) => s + c.width, 0);

  const handleSave = useCallback(async (dto: UpsertCompensationAdjustmentDto) => {
    try {
      await upsertCompensationAdjustment(dto);
      await reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    }
  }, [reload, toast]);

  // ── 출력 핸들러 — 새 컬럼 순서 반영 ────────────────────────────
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1600,height=900');
    if (!win) return;

    // 헤더 행 (DYNAMIC_COLS 기준)
    const thd = DYNAMIC_COLS.map((c) =>
      `<th>${c.label}${c.sub ? `<br/><small>${c.sub}</small>` : ''}</th>`
    ).join('');

    function printGradeTransition(
      prevGrade: string | null | undefined,
      prevYear: number | null | undefined,
      curGrade: string | null | undefined,
    ): string {
      const prev = prevGrade ?? (prevYear != null && prevYear < GRADE_SYSTEM_START_YEAR ? '도입전' : null);
      const curr = curGrade ?? null;
      if (!prev && !curr) return '—';
      return `${prev ?? '—'} → ${curr ?? '—'}`;
    }

    const body = filtered.map((r) => {
      const salaryA   = r.currentSalaryExclTransfer ?? r.currentSalary;
      const diffBA    = r.salaryDiffBA;
      const diffStr   = diffBA == null ? '—' : `${diffBA > 0 ? '+' : ''}${printManwon(diffBA)}`;
      const pos       = r.position ? getPositionLabel(r.position, positions) : '—';
      const promLabel = r.promotionPositionCode
        ? (positions.find((p) => p.code === r.promotionPositionCode)?.label ?? r.promotionPositionCode)
        : '—';
      const rate      = r.finalRaiseRate != null ? `${r.finalRaiseRate > 0 ? '+' : ''}${r.finalRaiseRate.toFixed(1)}%` : '—';
      const adj       = r.adjustmentAmount != null ? printManwon(r.adjustmentAmount) : '—';
      const inc       = r.incentiveAmount  != null ? printManwon(r.incentiveAmount)  : '—';
      const gradeCell = printGradeTransition(r.previousGrade, r.previousCycleYear, r.currentGrade);
      const tenureYrs = calcTenureYears(r.totalCareerMonths);

      return `<tr>
        <td>${r.userName ?? '—'}<br/><small>${[r.divisionName, r.teamName].filter(Boolean).join(' · ')}</small></td>
        <td>${pos}</td>
        <td>${fmtDate(r.hireDate)}</td>
        <td>${r.tenureMonths ?? '—'}</td>
        <td>${r.priorCareerMonths ?? '—'}</td>
        <td>${r.totalCareerMonths ?? '—'}</td>
        <td>${r.totalCareerLabel ?? '—'}</td>
        <td>${tenureYrs}</td>
        <td>${r.considerationExclusion ?? '—'}</td>
        <td>${printManwon(r.previousSalary)}</td>
        <td>${printManwon(salaryA)}</td>
        <td>${printManwon(r.currentSalary)}</td>
        <td>${diffStr}</td>
        <td>${adj}</td>
        <td><b>${printManwon(r.finalProjectedSalary)}</b></td>
        <td>${gradeCell}</td>
        <td>${rate}</td>
        <td>${promLabel}</td>
        <td>${inc}</td>
        <td>${r.note ?? '—'}</td>
      </tr>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>보상 현황</title>
      <style>
        body { font-family: Pretendard, sans-serif; padding: 20px; font-size: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e5e8eb; padding: 5px 8px; }
        th { background: #f9fafb; font-weight: 600; white-space: nowrap; }
        small { color: #797582; }
        b { color: #3f2c80; }
        .grp { border-left: 2px solid #cac4d2; }
      </style>
    </head><body>
      <h2 style="margin-bottom:12px;font-size:14px">에너지엑스 차기년도 보상 현황</h2>
      <table><thead><tr>${thd}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  async function handleDownload() {
    if (!cycleId) return;
    setDownloading(true);
    try {
      await downloadExcel(`/excel/export/compensation?cycleId=${cycleId}`, `compensation-${cycleId}.xlsx`);
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '내보내기에 실패했어요.' });
    } finally {
      setDownloading(false);
    }
  }

  // ── 헤더 th 스타일 ────────────────────────────────────────────────
  const thStyle = (idx: number): React.CSSProperties => {
    const col  = DYNAMIC_COLS[idx];
    const base: React.CSSProperties = {
      position:    'sticky',
      top:          0,
      zIndex:       col.sticky ? 20 : 10,
      background:   K.surfaceLow,
      padding:      '9px 10px',
      borderBottom: `1px solid rgba(202,196,210,0.4)`,
      fontSize:     10,
      fontWeight:   600,
      color:        '#797582',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      whiteSpace:   'nowrap',
      minWidth:     col.width,
      textAlign:    col.numeric ? 'right' : 'left',
      ...(col.groupStart ? { borderLeft: `2px solid ${GROUP_DIVIDER}` } : {}),
    };
    if (col.sticky) {
      base.left      = stickyLeft(idx);
      // sticky 마지막 컬럼(idx=1)에 그림자
      base.boxShadow = idx === 1 ? '2px 0 8px rgba(0,0,0,0.06)' : undefined;
    }
    return base;
  };

  return (
    <PageContainer>
      <PageHeader
        title="보상 현황"
        subtitle="평가 결과 기반 차기년도 연봉 산정. 조정분·승격·인센티브는 관리자가 수기 입력 후 자동 저장됩니다."
        right={
          <>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 transition-colors"
              style={{ fontSize: 12.5, color: '#484551', border: '1px solid rgba(202,196,210,0.7)', borderRadius: 8, background: '#fff' }}>
              <Printer size={13} /> 출력
            </button>
            <button onClick={() => void handleDownload()} disabled={!cycleId || downloading}
              className="flex items-center gap-1.5 px-4 py-2 transition-colors disabled:opacity-50"
              style={{ fontSize: 12.5, color: '#fff', background: K.primary, borderRadius: 8 }}>
              <Download size={13} /> {downloading ? '내려받는 중…' : '다운로드'}
            </button>
          </>
        }
      />

      <InfoBanner tone="warning">
        보상 정보는 <strong>본인 · 그룹대표 · 본부장 · 관리자</strong>만 열람할 수 있습니다.
        조정분·승격·인센티브·비고는 <strong>hr_admin</strong>만 입력 가능합니다.
      </InfoBanner>

      {/* 등급별 인상률 기준 */}
      {gradeRaise.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span style={{ fontSize: 11.5, color: '#797582', fontWeight: 500 }}>등급별 인상률 기준:</span>
          {[...gradeRaise]
            .sort((a, b) => GRADE_ORDER.indexOf(a.grade as Grade) - GRADE_ORDER.indexOf(b.grade as Grade))
            .map((g) => {
              const gc = gradeColor(g.grade as Grade);
              return (
                <span key={g.grade} className="flex items-center gap-1">
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: gc.fg, background: gc.bg, padding: '2px 8px', borderRadius: 6 }}>{g.grade}</span>
                  <span className="tabular-nums" style={{ fontSize: 11.5, color: K.onSurfaceVariant, fontWeight: 600 }}>
                    {g.raiseRate > 0 ? '+' : ''}{g.raiseRate}%
                  </span>
                </span>
              );
            })}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[
          { label: '총 인원',      value: `${filtered.length}명`,      color: K.onSurface },
          { label: '평균 인상률',  value: `${avgRaise.toFixed(1)}%`,   color: K.tertiary },
          { label: '총 인건비 증가', value: `${totalIncreaseEok}억원`, color: K.secondary },
          { label: 'S등급 인원',   value: `${sCount}명`,               color: K.primary },
        ].map((c) => (
          <div key={c.label}
            className="bg-white p-5 rounded-xl border border-[#cac4d2]/50 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] cursor-default"
            style={{ boxShadow: CARD_SHADOW }}>
            <span className="text-[#484551] text-[13px] font-semibold tracking-[0.01em] mb-1.5">{c.label}</span>
            <span className="tabular-nums text-[34px] font-extrabold leading-[1.2] tracking-[-0.02em]" style={{ color: c.color }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* 본부 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 12, color: '#605d67' }}>본부:</span>
        {divisions.map((d) => (
          <button key={d} onClick={() => setDivisionFilter(d)}
            style={{ fontSize: 12, padding: '4px 12px', fontWeight: 500, borderRadius: 999,
              background: divisionFilter === d ? K.primary : '#fff',
              color: divisionFilter === d ? '#fff' : '#605d67',
              border: `1px solid ${divisionFilter === d ? K.primary : 'rgba(202,196,210,0.5)'}` }}>
            {d}
          </button>
        ))}
      </div>

      {/* 표 래퍼 — overflow-x: auto, sticky-left 동작을 위해 position: relative */}
      <div className="bg-white overflow-x-auto"
        style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, boxShadow: CARD_SHADOW, position: 'relative' }}>
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title="표시할 보상 데이터가 없어요." description="평가 주기가 완료되면 보상 시뮬레이션 결과가 여기에 표시됩니다." />
          </div>
        ) : (
          <table style={{ minWidth: dynamicMinWidth, width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {DYNAMIC_COLS.map((col, idx) => (
                  <th key={idx} style={thStyle(idx)}>
                    {col.label}
                    {col.sub && (
                      <><br /><span style={{ fontSize: 9, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>{col.sub}</span></>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <CompensationRow
                  key={r.userId}
                  row={r}
                  isLast={i === filtered.length - 1}
                  cycleId={cycleId!}
                  canEdit={canEdit}
                  positions={positions}
                  onSave={handleSave}
                  columns={DYNAMIC_COLS}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
