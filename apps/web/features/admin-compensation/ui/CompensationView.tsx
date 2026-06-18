'use client';

/**
 * CompensationView — 보상 현황 페이지.
 * semantic <table> + sticky-left 2컬럼(이름·직급) + sticky-top <thead>.
 * 컬럼 정의는 ./columns.ts(buildColumns), 행 렌더는 CompensationRow (~200줄 파일상한 준수).
 *
 * DS 컴포넌트:
 *  - PageContainer, PageHeader — 페이지 골격
 *  - Button — 출력·다운로드 (raw <button> 제거)
 *  - HeaderMetrics — 요약 스트립 4항목 (StatCard 그리드 대체)
 *  - FilterChipBar — 본부 필터 (인라인 raw button 제거)
 *  - GradeChip — 등급별 인상률 칩 (lib/grade gradeColor 직접 참조 제거)
 * 로컬 `const K = {...}` 팔레트 상수·CARD_SHADOW 인라인 → 제거.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Printer, Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { downloadExcel } from '@/lib/excel';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { getPositionLabel } from '@/lib/ui';
import { usePositions } from '@/hooks/usePositions';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Button } from '@/components/Button';
import type { Grade } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useTeamCompensationSimulationData } from '../hooks';
import { upsertCompensationAdjustment } from '../api';
import type { UpsertCompensationAdjustmentDto } from '../api';
import { CompensationRow } from './CompensationRow';
import { stickyLeft, buildColumns, GROUP_DIVIDER } from './columns';
import { GRADE_SYSTEM_START_YEAR } from './GradeChip';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 출력용: 금액을 원 단위 끝자리까지 표시.
function printMoney(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v).toLocaleString()}원`;
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
  const { cycles, current, loading: cyclesLoading } = useCurrentCycle();
  const [compensationCycleId, setCompensationCycleId] = useState<string | null>(null);
  const selectedCycle = useMemo(
    () =>
      cycles.find((cycle) => cycle.id === compensationCycleId) ??
      current ??
      cycles[0] ??
      null,
    [compensationCycleId, current, cycles],
  );
  const cycleId = selectedCycle?.id;

  const canView = !!user && (user.role === 'hr_admin' || user.role === 'division_head' || user.role === 'team_lead');
  const canEdit = !!user && isHrAdmin(user.role);

  const [divisionFilter, setDivisionFilter] = useState('전체');
  const [downloading,    setDownloading]    = useState(false);

  const { rows, loading: rowsLoading, reload } = useTeamCompensationSimulationData(cycleId, canView && !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: canView });
  const positions = positionsData?.data ?? [];

  useEffect(() => {
    setDivisionFilter('전체');
  }, [cycleId]);

  if (!canView) return <Forbidden message="보상 정보는 본부장·관리자만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!selectedCycle) return <EmptyState title="조회할 보상 기준년도가 없어요." description="평가 운영에서 평가 주기를 먼저 만들어 주세요." />;

  const divisions = ['전체', ...Array.from(new Set(rows.map((r) => r.divisionName).filter((d): d is string => !!d)))];
  const filtered  = rows.filter((r) => divisionFilter === '전체' || r.divisionName === divisionFilter);
  const gradeRaise       = filtered[0]?.byGrade ?? rows[0]?.byGrade ?? [];
  const valid            = filtered.filter((r) => r.finalProjectedSalary != null && r.currentSalary != null);
  const avgRaise         = valid.length > 0 ? valid.reduce((s, r) => s + (r.finalRaiseRate ?? 0), 0) / valid.length : 0;
  const totalIncreaseWon = valid.reduce((s, r) => s + (r.finalProjectedSalary! - r.currentSalary!), 0);
  const sCount           = filtered.filter((r) => r.currentGrade === 'S').length;

  const currentCycleYear: number | null = rows[0]?.currentCycleYear ?? selectedCycle?.year ?? null;
  const compensationYear = currentCycleYear != null ? currentCycleYear + 1 : null;
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

  // 출력 핸들러 — 새 컬럼 순서 반영
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1600,height=900');
    if (!win) return;

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
      const pos       = r.position ? getPositionLabel(r.position, positions) : '—';
      const promLabel = r.promotionPositionCode
        ? (positions.find((p) => p.code === r.promotionPositionCode)?.label ?? r.promotionPositionCode)
        : '—';
      const rate      = r.finalRaiseRate != null ? `${r.finalRaiseRate > 0 ? '+' : ''}${r.finalRaiseRate.toFixed(1)}%` : '—';
      const raiseAmount = r.finalProjectedSalary != null && r.currentSalary != null
        ? printMoney(r.finalProjectedSalary - r.currentSalary)
        : '—';
      const adj       = r.adjustmentAmount != null ? printMoney(r.adjustmentAmount) : '—';
      const inc       = r.incentiveAmount  != null ? printMoney(r.incentiveAmount)  : '—';
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
        <td>${printMoney(r.previousSalary)}</td>
        <td>${printMoney(r.currentSalary)}</td>
        <td>${adj}</td>
        <td><b>${printMoney(r.finalProjectedSalary)}</b></td>
        <td>${gradeCell}</td>
        <td>${rate}</td>
        <td>${raiseAmount}</td>
        <td>${promLabel}</td>
        <td>${inc}</td>
        <td>${r.note ?? '—'}</td>
      </tr>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>보상 현황</title>
      <style>
        body { font-family: Pretendard, sans-serif; padding: 20px; font-size: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e3e3e8; padding: 5px 8px; }
        th { background: #f7f7f9; font-weight: 600; white-space: nowrap; }
        small { color: #74747f; }
        b { color: #7a37d8; }
        .grp { border-left: 2px solid #ccccd4; }
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
      await downloadExcel(`/excel/export/compensation?cycleId=${cycleId}`, `compensation-${selectedCycle?.year ?? cycleId}.xlsx`);
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '내보내기에 실패했어요.' });
    } finally {
      setDownloading(false);
    }
  }

  // 헤더 th 스타일 — sticky 좌·상단 제어는 인라인이 필수 (동적 left 계산)
  const thStyle = (idx: number): React.CSSProperties => {
    const col = DYNAMIC_COLS[idx];
    const base: React.CSSProperties = {
      position:    'sticky',
      top:          0,
      zIndex:       col.sticky ? 20 : 10,
      background:   '#efeff2',
      padding:      '10px 12px',
      borderBottom: '1px solid #CCCCD4',
      fontSize:     11,
      fontWeight:   700,
      color:        '#565660',
      letterSpacing: 0,
      whiteSpace:   'nowrap',
      minWidth:     col.width,
      textAlign:    col.numeric ? 'right' : 'left',
      ...(col.groupStart ? { borderLeft: `2px solid ${GROUP_DIVIDER}` } : {}),
    };
    if (col.sticky) {
      base.left      = stickyLeft(idx);
      base.boxShadow = idx === 1 ? '2px 0 8px rgba(0,0,0,0.06)' : undefined;
    }
    return base;
  };

  // 필터 칩 옵션
  const divisionChipOptions = divisions.map((d) => ({ value: d, label: d }));

  return (
    <PageContainer>
      <PageHeader
        title="보상 현황"
        subtitle="선택한 보상 기준년도별로 차기년도 연봉 산정을 확인합니다. 조정분·승격·인센티브는 관리자가 수기 입력 후 자동 저장됩니다."
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={cycleId ?? null}
        onSelectCycle={setCompensationCycleId}
        right={
          <>
            <HeaderMetrics
              items={[
                { label: '총 인원', value: `${filtered.length}명` },
                { label: '평균 인상률', value: `${avgRaise.toFixed(1)}%`, accent: 'text-info-700' },
                { label: `${compensationYear ?? '차기'}년도 총 인건비 증가`, value: printMoney(totalIncreaseWon), accent: 'text-primary' },
                { label: 'S등급 인원', value: `${sCount}명`, accent: 'text-primary' },
              ]}
            />
            <span className="rounded-md border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground">
              보상 기준 {currentCycleYear ?? '—'}년
            </span>
            <Button variant="secondary" size="sm" leftIcon={<Printer size={13} aria-hidden />} onClick={handlePrint}>
              출력
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download size={13} aria-hidden />}
              loading={downloading}
              disabled={!cycleId}
              onClick={() => void handleDownload()}
            >
              다운로드
            </Button>
          </>
        }
      />

      {/* 등급별 인상률 기준 */}
      {gradeRaise.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11.5px] text-muted-foreground font-medium">등급별 인상률 기준:</span>
          {[...gradeRaise]
            .sort((a, b) => GRADE_ORDER.indexOf(a.grade as Grade) - GRADE_ORDER.indexOf(b.grade as Grade))
            .map((g) => {
              return (
                <span key={g.grade} className="flex items-center gap-1">
                  <GradeChip grade={g.grade as Grade} />
                  <span className="tabular-nums text-[11.5px] text-muted-foreground font-semibold">
                    {g.raiseRate > 0 ? '+' : ''}{g.raiseRate}%
                  </span>
                </span>
              );
            })}
        </div>
      )}

      {/* 본부 필터 — FilterChipBar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">본부:</span>
        <FilterChipBar
          options={divisionChipOptions}
          value={divisionFilter}
          onChange={setDivisionFilter}
        />
      </div>

      {/* 표 래퍼 — sticky-left 동작을 위해 내부 스크롤 컨테이너를 분리 */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
        {rowsLoading && rows.length > 0 && (
          <div className="absolute right-3 top-3 z-30 rounded-md border border-border bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
            갱신 중
          </div>
        )}
        <div className="overflow-x-auto">
        {rowsLoading && rows.length === 0 ? (
          <div className="p-4">
            <Skeleton className="h-80 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState title="표시할 보상 데이터가 없어요." description="평가 주기가 완료되면 보상 시뮬레이션 결과가 여기에 표시됩니다." />
          </div>
        ) : (
          <table style={{ minWidth: dynamicMinWidth, width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <colgroup>
              {DYNAMIC_COLS.map((col, idx) => (
                <col key={idx} style={{ width: col.width }} />
              ))}
            </colgroup>
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
                  rowIndex={i}
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
      </div>
    </PageContainer>
  );
}
