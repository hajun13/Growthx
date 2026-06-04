'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  compensationCommands,
  useCompensationSimulation,
  useTeamCompensationSimulation,
} from '@/hooks/useCompensations';
import { useRuleSets } from '@/hooks/useRuleSets';
import { useUsers } from '@/hooks/useUsers';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { ExportButton } from '@/components/ExportButton';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { GradeChip } from '@/components/GradeChip';
import { SalarySimCard } from '@/components/SalarySimCard';
import { ResultTable, type ResultTableColumn } from '@/components/ResultTable';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { fmtSalary } from '@/lib/ui';
import type { Compensation, CompensationMeta } from '@/lib/types';

const COLUMNS: ResultTableColumn[] = [
  { key: 'userId', label: '대상자' },
  { key: 'grade', label: '등급', align: 'center' },
  { key: 'raiseRate', label: '인상률', align: 'right' },
  { key: 'simulated', label: '구분', align: 'center' },
];

export default function CompensationPage() {
  const { user } = useAuth();
  const toast = useToast();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && isHrAdmin(user.role);
  const { data: ruleSets } = useRuleSets({ enabled: allowed });
  const ruleSet = ruleSets?.data.find((r) => r.cycleId === cycleId) ?? null;

  const [comps, setComps] = useState<Compensation[]>([]);
  const [meta, setMeta] = useState<CompensationMeta | null>(null);
  const [busy, setBusy] = useState(false);

  // M3 Item 8: 개인 연봉 시뮬레이션 — 대상자 선택.
  const { data: usersData } = useUsers({}, { enabled: allowed });
  const userOptions = useMemo(
    () =>
      (usersData?.data ?? []).map((u) => ({
        value: u.id,
        label: u.name,
      })),
    [usersData],
  );
  const [simUserId, setSimUserId] = useState<string>('');
  const { data: sim } = useCompensationSimulation(
    { cycleId, userId: simUserId },
    { enabled: allowed && !!cycleId && !!simUserId },
  );

  // M3 Item 8: 팀 전체 시뮬레이션.
  const { data: teamSim } = useTeamCompensationSimulation(
    { cycleId },
    { enabled: allowed && !!cycleId },
  );

  async function compute(simulated: boolean) {
    if (!cycleId) return;
    setBusy(true);
    try {
      const res = await compensationCommands.compute({ cycleId, simulated });
      setComps(res.data);
      setMeta(res.meta);
      toast.show({
        variant: 'success',
        message: simulated ? '시뮬레이션을 산출했어요.' : '인상률을 확정 산출했어요.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '산출에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return <Forbidden message="보상 시뮬레이션은 HR만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const teamSimRows = (teamSim?.data ?? []).map((s) => ({
    _key: s.userId,
    name: (
      <div className="flex flex-col">
        <span className="text-foreground">{s.userName ?? '-'}</span>
        {s.departmentName && (
          <span className="text-xs text-muted-foreground">
            {s.departmentName}
          </span>
        )}
      </div>
    ),
    currentSalary: fmtSalary(s.currentSalary),
    grade: <GradeChip grade={s.currentGrade} size="sm" />,
    raiseRate: s.raiseRate !== null ? `+${s.raiseRate}%` : '—',
    projectedSalary: fmtSalary(s.projectedSalary),
  }));

  const rows = comps.map((c) => ({
    _key: c.id,
    userId: (
      <div className="flex flex-col">
        <span className="text-foreground">{c.userName ?? '-'}</span>
        {c.departmentName && (
          <span className="text-xs text-muted-foreground">
            {c.departmentName}
          </span>
        )}
      </div>
    ),
    grade: <GradeChip grade={c.finalGrade} size="sm" />,
    raiseRate: `+${c.raiseRate}%`,
    simulated: c.simulated ? '시뮬' : '확정',
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="보상 시뮬레이션"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-3">
            {meta && (
              <span className="text-sm text-foreground">
                전사 평균 +{meta.companyAvgRaise}%
              </span>
            )}
            {cycleId && (
              <>
                <ExportButton
                  path={`/excel/export/results?cycleId=${cycleId}`}
                  filename={`results-${cycleId}.xlsx`}
                  label="전체 결과 Excel"
                />
                <ExportButton
                  path={`/excel/export/compensation?cycleId=${cycleId}`}
                  filename={`compensation-${cycleId}.xlsx`}
                />
              </>
            )}
          </div>
        }
      />

      <Card title="인상률 규칙 (RuleSet, 읽기)">
        {ruleSet ? (
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            {(['S', 'A', 'B', 'C', 'D'] as const).map((g) => (
              <span key={g} className="tabular-nums">
                {g} +{ruleSet.raiseRates[g]}%
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            이 주기의 RuleSet 인상률이 설정되지 않았어요.
          </p>
        )}
      </Card>

      {/* M3 Item 8: 개인 연봉 시뮬레이션 */}
      <Card title="개인 연봉 시뮬레이션 — 대상자 선택">
        <div className="max-w-xs">
          <Select
            label="대상자"
            value={simUserId}
            options={userOptions}
            onChange={setSimUserId}
            placeholder="임직원 선택"
          />
        </div>
      </Card>

      {sim && (
        <SalarySimCard sim={sim} raiseRates={ruleSet?.raiseRates} />
      )}

      {/* M3 Item 8: 팀 연봉 영향 테이블 */}
      <Card title="팀 연봉 영향 (예상)">
        <ResultTable
          columns={[
            { key: 'name', label: '이름' },
            { key: 'currentSalary', label: '현재 연봉', align: 'right' },
            { key: 'grade', label: '등급', align: 'center' },
            { key: 'raiseRate', label: '예상 인상', align: 'right' },
            { key: 'projectedSalary', label: '예상 연봉', align: 'right' },
          ]}
          rows={teamSimRows}
          emptyLabel="시뮬레이션 데이터가 없어요. 결과 확정 후 표시돼요."
        />
      </Card>

      {meta?.exceedsTarget && (
        <div className="flex items-center gap-2 rounded-lg border border-warning-100 bg-warning-50 px-5 py-3 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>전사 평균 인상률이 목표(3%)를 초과했어요.</span>
        </div>
      )}

      <Card
        title="대상자 인상률"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => void compute(true)}
            >
              시뮬레이션
            </Button>
            <Button size="sm" loading={busy} onClick={() => void compute(false)}>
              확정 산출
            </Button>
          </div>
        }
      >
        <ResultTable
          columns={COLUMNS}
          rows={rows}
          emptyLabel="산출 버튼을 눌러 인상률을 계산해 주세요."
        />
      </Card>
    </div>
  );
}
