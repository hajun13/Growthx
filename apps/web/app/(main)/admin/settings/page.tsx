'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSets, ruleSetCommands } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import type { Grade, RuleSet } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
type TabKey = 'rules' | 'templates' | 'schedule';

export default function SettingsPage() {
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
  const { data, loading, reload } = useRuleSets({ enabled: allowed });
  const ruleSet: RuleSet | null =
    data?.data.find((r) => r.cycleId === cycleId) ?? null;

  const [activeTab, setActiveTab] = useState<TabKey>('rules');
  const [raise, setRaise] = useState<Record<Grade, string>>({
    S: '',
    A: '',
    B: '',
    C: '',
    D: '',
  });
  const [qualMax, setQualMax] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ruleSet) return;
    setRaise({
      S: String(ruleSet.raiseRates.S),
      A: String(ruleSet.raiseRates.A),
      B: String(ruleSet.raiseRates.B),
      C: String(ruleSet.raiseRates.C),
      D: String(ruleSet.raiseRates.D),
    });
    setQualMax(String(ruleSet.weightPolicy.qualitativeMaxPercent));
  }, [ruleSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!ruleSet) return;
    setBusy(true);
    try {
      await ruleSetCommands.update(ruleSet.id, {
        raiseRates: {
          S: Number(raise.S) || 0,
          A: Number(raise.A) || 0,
          B: Number(raise.B) || 0,
          C: Number(raise.C) || 0,
          D: Number(raise.D) || 0,
        },
        weightPolicy: {
          totalMustEqual: ruleSet.weightPolicy.totalMustEqual,
          qualitativeMaxPercent: Number(qualMax) || 30,
        },
      });
      toast.show({ variant: 'success', message: '설정을 저장했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return <Forbidden message="설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading || loading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="주기를 먼저 선택해 주세요." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="관리자 설정"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <InfoBanner tone="info" title="설정 안내">
        등급 기준·풀 비율·KPI 가중치·인상률은 RuleSet으로 관리돼요. 값을 바꾸면
        이후 산정에 반영되니 신중히 적용하세요.
      </InfoBanner>

      <Tabs
        items={[
          { key: 'rules', label: '규칙(RuleSet)' },
          { key: 'templates', label: 'KPI 양식' },
          { key: 'schedule', label: '일정·대상자' },
        ]}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
      />

      {activeTab === 'rules' &&
        (ruleSet ? (
          <>
            <Card title="등급 척도 (점수 → 등급, 읽기)">
              <ul className="flex flex-wrap gap-3 text-sm text-foreground">
                {ruleSet.gradeScale.map((g) => (
                  <li
                    key={g.grade}
                    className="rounded-md border border-border px-3 py-1 tabular-nums"
                  >
                    {g.grade} {g.min}~{g.max}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="인상률">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {GRADES.map((g) => (
                  <TextField
                    key={g}
                    label={`${g} 등급`}
                    type="number"
                    value={raise[g]}
                    onChange={(v) => setRaise((p) => ({ ...p, [g]: v }))}
                    suffix="%"
                  />
                ))}
              </div>
            </Card>

            <Card title="가중치 정책">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="가중치 합계(고정)"
                  type="number"
                  value={String(ruleSet.weightPolicy.totalMustEqual)}
                  onChange={() => {}}
                  readOnly
                  suffix="%"
                />
                <TextField
                  label="정성 KPI 상한"
                  type="number"
                  value={qualMax}
                  onChange={setQualMax}
                  suffix="%"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button loading={busy} onClick={() => void save()}>
                  설정 저장
                </Button>
              </div>
            </Card>
          </>
        ) : (
          <EmptyState
            title="이 주기의 RuleSet이 없어요."
            description="백엔드에서 주기에 RuleSet을 연결해 주세요."
          />
        ))}

      {activeTab === 'templates' && (
        <Card title="KPI 양식 (jobLevel별)">
          <p className="text-sm text-muted-foreground">
            양식 항목(category·group·defaultMeasureType·defaultWeight)은
            jobLevel(본부장·팀장·senior_plus·senior_minus)별로 관리해요. 양식
            편집 UI는 추후 확장 예정이에요.
          </p>
        </Card>
      )}

      {activeTab === 'schedule' && (
        <Card title="평가 일정">
          <dl className="grid grid-cols-1 gap-2 text-sm text-foreground sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">주기</dt>
              <dd>{current.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">상태</dt>
              <dd>{current.status}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">시작일</dt>
              <dd className="tabular-nums">{current.startDate}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">종료일</dt>
              <dd className="tabular-nums">{current.endDate}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            단계별 일정·대상자·알림(D-7/D-1/D-3) 설정은 추후 확장 예정이에요.
          </p>
        </Card>
      )}
    </div>
  );
}
