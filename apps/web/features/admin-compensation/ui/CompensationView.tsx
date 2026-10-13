'use client';

/**
 * CompensationView — 보상 현황 페이지.
 * semantic <table> + sticky-left 2컬럼(이름·직급) + sticky-top <thead>.
 * 컬럼 정의는 ./columns.ts(buildColumns), 행 렌더는 CompensationRow (~200줄 파일상한 준수).
 *
 * DS 컴포넌트:
 *  - PageContainer, PageHeader — 페이지 골격
 *  - Button — 출력·다운로드 (raw <button> 제거)
 *  - HeaderMetrics — 헤더 문맥 메타데이터
 *  - FilterChipBar — 그룹 필터 (인라인 raw button 제거)
 *  - GradeChip — 등급별 인상률 칩 (lib/grade gradeColor 직접 참조 제거)
 * 로컬 `const K = {...}` 팔레트 상수·CARD_SHADOW 인라인 → 제거.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { ApiError } from '@/lib/api';
import { downloadExcel } from '@/lib/excel';
import { Skeleton } from '@/components/ui/skeleton';
import { isHrAdmin } from '@/lib/nav';
import { usePositions } from '@/hooks/usePositions';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Grade } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useTeamCompensationSimulationData } from '../hooks';
import { upsertCompensationAdjustment } from '../api';
import type { UpsertCompensationAdjustmentDto } from '../api';
import { buildColumns, type SortKey } from './columns';
import { printCompensation, printMoney } from './compensationPrint';
import { CompensationTable, type SortState } from './CompensationTable';
import { EmptyState, Forbidden } from './StateViews';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const KO_COLLATOR = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });

export function CompensationView() {
  const { user }  = useAuth();
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

  const [groupFilter, setGroupFilter] = useState('전체');
  const [search,         setSearch]         = useState('');
  const [sort,           setSort]           = useState<SortState | null>(null);
  const [downloading,    setDownloading]    = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const { rows, loading: rowsLoading, reload } = useTeamCompensationSimulationData(cycleId, canView && !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: canView });
  const positions = positionsData?.data ?? [];

  useEffect(() => {
    setGroupFilter('전체');
    setSearch('');
    setSort(null);
  }, [cycleId]);

  const groups = ['전체', ...Array.from(new Set(rows.map((r) => r.groupName).filter((g): g is string => !!g)))];
  const searchTerm = search.trim();
  const filtered  = [...rows.filter(
    (r) =>
      (groupFilter === '전체' || r.groupName === groupFilter) &&
      (searchTerm === '' || (r.userName ?? '').includes(searchTerm)),
  )]
    .sort((a, b) => {
      const byName = KO_COLLATOR.compare(a.userName ?? '', b.userName ?? '');
      if (byName !== 0) return byName;
      const byGroup = KO_COLLATOR.compare(a.groupName ?? '', b.groupName ?? '');
      if (byGroup !== 0) return byGroup;
      return KO_COLLATOR.compare(a.teamName ?? '', b.teamName ?? '');
    });
  // 헤더 클릭 정렬(수치·등급) — 기본은 이름순, null 값은 항상 마지막.
  if (sort) {
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sort.key === 'currentGrade') {
        // GRADE_ORDER 인덱스: S=0 … D=4. desc(첫 클릭)=S 우선이므로 부호를 반전, 미부여는 항상 마지막.
        if (a.currentGrade == null && b.currentGrade == null) return 0;
        if (a.currentGrade == null) return 1;
        if (b.currentGrade == null) return -1;
        const ai = GRADE_ORDER.indexOf(a.currentGrade as Grade);
        const bi = GRADE_ORDER.indexOf(b.currentGrade as Grade);
        return (ai - bi) * -dirMul;
      }
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dirMul;
    });
  }
  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  }
  const gradeRaise       = rows[0]?.baseByGrade ?? [];
  const valid            = filtered.filter((r) => r.finalProjectedSalary != null && r.currentSalary != null);
  const avgRaise         = valid.length > 0 ? valid.reduce((s, r) => s + (r.finalRaiseRate ?? 0), 0) / valid.length : 0;
  const totalIncreaseWon = valid.reduce((s, r) => s + (r.finalProjectedSalary! - r.currentSalary!), 0);
  const sCount           = filtered.filter((r) => r.currentGrade === 'S').length;

  const currentCycleYear: number | null = rows[0]?.currentCycleYear ?? selectedCycle?.year ?? null;
  const compensationYear = currentCycleYear != null ? currentCycleYear + 1 : null;
  const DYNAMIC_COLS    = buildColumns(currentCycleYear);
  const dynamicMinWidth = DYNAMIC_COLS.reduce((s, c) => s + c.width, 0);

  const syncHorizontalScroll = useCallback((source: 'top' | 'table') => {
    const top = topScrollRef.current;
    const table = tableScrollRef.current;
    if (!top || !table) return;
    if (source === 'top') table.scrollLeft = top.scrollLeft;
    else top.scrollLeft = table.scrollLeft;
  }, []);

  // 성공 여부를 행(CompensationRow)에 반환 — 저장됨 표시/실패 시 원값 복원 판단용.
  const handleSave = useCallback(async (dto: UpsertCompensationAdjustmentDto): Promise<boolean> => {
    try {
      await upsertCompensationAdjustment(dto);
      await reload();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
      return false;
    }
  }, [reload]);

  if (!canView) return <Forbidden message="보상 정보는 본부장·관리자만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!selectedCycle) return <EmptyState title="조회할 보상 기준년도가 없어요." description="평가 운영에서 평가 주기를 먼저 만들어 주세요." />;

  const handlePrint = () => printCompensation(DYNAMIC_COLS, filtered, positions);

  async function handleDownload() {
    if (!cycleId) return;
    setDownloading(true);
    try {
      await downloadExcel(`/excel/export/compensation?cycleId=${cycleId}`, `compensation-${selectedCycle?.year ?? cycleId}.xlsx`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '내보내기에 실패했어요.', { duration: 8000 });
    } finally {
      setDownloading(false);
    }
  }

  // 필터 칩 옵션
  const groupChipOptions = groups.map((g) => ({ value: g, label: g }));

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
            <span className="rounded-md border border-border bg-muted px-3 py-2 text-12 font-semibold text-muted-foreground">
              보상 기준 {currentCycleYear ?? '—'}년
            </span>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer aria-hidden />
              출력
            </Button>
            <Button
              size="sm"
              loading={downloading}
              disabled={!cycleId}
              onClick={() => void handleDownload()}
            >
              {!downloading && <Download aria-hidden />}
              다운로드
            </Button>
          </>
        }
      />

      {/* 등급별 기본 인상률 */}
      {gradeRaise.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-11h text-muted-foreground font-medium">등급별 기본 인상률:</span>
          {[...gradeRaise]
            .sort((a, b) => GRADE_ORDER.indexOf(a.grade as Grade) - GRADE_ORDER.indexOf(b.grade as Grade))
            .map((g) => {
              return (
                <span key={g.grade} className="flex items-center gap-1">
                  <GradeChip grade={g.grade as Grade} />
                  <span className="tabular-nums text-11h text-muted-foreground font-semibold">
                    {g.raiseRate > 0 ? '+' : ''}{g.raiseRate}%
                  </span>
                </span>
              );
            })}
          <span className="text-11h text-muted-foreground">
            그룹 실적 가산은 개인별 인상률에 별도 반영됩니다.
          </span>
        </div>
      )}

      {/* 그룹 필터 — FilterChipBar + 이름 검색 */}
      <div className="gx-toolbar">
        <span className="gx-muted-label">그룹</span>
        <FilterChipBar
          options={groupChipOptions}
          value={groupFilter}
          onChange={setGroupFilter}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 검색"
          aria-label="이름 검색"
          className="h-8 w-44 text-12"
        />
        <span className="ml-auto text-12 font-semibold text-muted-foreground">
          {filtered.length}명
        </span>
      </div>

      {filtered.length > 0 && (
        <div className="sticky top-15 z-30 -mb-2 border border-border bg-card px-2 py-1">
          <div
            ref={topScrollRef}
            className="overflow-x-auto overflow-y-hidden"
            onScroll={() => syncHorizontalScroll('top')}
            aria-label="보상 현황 표 가로 스크롤"
          >
            <div className="h-px w-(--tw)" style={{ '--tw': `${dynamicMinWidth}px` } as React.CSSProperties} />
          </div>
        </div>
      )}

      {/* 표 — sticky-left 동작을 위해 내부 스크롤 컨테이너를 표 컴포넌트가 소유 */}
      <CompensationTable
        columns={DYNAMIC_COLS}
        minWidth={dynamicMinWidth}
        rows={filtered}
        totalRows={rows.length}
        rowsLoading={rowsLoading}
        cycleId={cycleId!}
        canEdit={canEdit}
        positions={positions}
        sort={sort}
        onToggleSort={toggleSort}
        onSave={handleSave}
        filtered={groupFilter !== '전체' || searchTerm !== ''}
        scrollRef={tableScrollRef}
        onScroll={() => syncHorizontalScroll('table')}
      />
    </PageContainer>
  );
}
