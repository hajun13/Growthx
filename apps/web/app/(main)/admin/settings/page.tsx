'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSets, ruleSetCommands } from '@/hooks/useRuleSets';
import {
  useKpiTemplates,
  kpiTemplateCommands,
} from '@/hooks/useKpiTemplates';
import { useSchedules, scheduleCommands } from '@/hooks/useSchedules';
import {
  useKpiCategoryPolicy,
  kpiCategoryPolicyCommands,
} from '@/hooks/useKpiCategoryPolicy';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Tabs } from '@/components/Tabs';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { FileDropzone } from '@/components/FileDropzone';
import {
  RuleSetEditor,
  validateRuleSet,
  type RuleSetDraft,
} from '@/components/RuleSetEditor';
import {
  TemplateEditor,
  templateValid,
  type TemplateItemDraft,
} from '@/components/TemplateEditor';
import { ScheduleEditor, type PhaseDraft } from '@/components/ScheduleEditor';
import { CategoryPolicyMatrix } from '@/components/CategoryPolicyMatrix';
import { RosterImportPanel } from '@/components/RosterImportPanel';
import { EmptyState, Forbidden, Skeleton } from '@/components/States';
import { useSetPrimaryAction } from '@/hooks/usePrimaryAction';
import { isHrAdmin } from '@/lib/nav';
import type {
  Grade,
  JobLevel,
  RuleSet,
  ImportResult,
  KpiTemplateItemInput,
  ScheduleItemInput,
  Position,
  KpiCategory,
  KpiCategoryPolicyEntry,
} from '@/lib/types';

type TabKey =
  | 'rules'
  | 'templates'
  | 'schedule'
  | 'kpi-category-policy'
  | 'onboarding';
const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const DEFAULT_PHASES = ['prep', 'self', 'downward1', 'downward2', 'result'];
const SETTINGS_TABS = [
  { key: 'rules', label: '규칙(RuleSet)' },
  { key: 'templates', label: 'KPI 양식' },
  { key: 'schedule', label: '일정·대상자' },
  { key: 'kpi-category-policy', label: 'KPI 권한' },
  { key: 'onboarding', label: '명부 온보딩' },
];

// Item3: 직급 자동기본 — 직책자=전부, 비직책자=construction/collaboration/development.
const ALL_CATEGORIES: KpiCategory[] = [
  'revenue',
  'construction',
  'orders',
  'collaboration',
  'development',
];
const POSITION_HOLDERS: Position[] = [
  'ceo',
  'vice_president',
  'executive',
  'director',
  'division_head',
  'team_lead',
];
function defaultAllowedFor(position: Position): KpiCategory[] {
  return POSITION_HOLDERS.includes(position)
    ? [...ALL_CATEGORIES]
    : ['construction', 'collaboration', 'development'];
}
function policyEqual(
  a: KpiCategoryPolicyEntry[],
  b: KpiCategoryPolicyEntry[],
): boolean {
  if (a.length !== b.length) return false;
  const sort = (xs: KpiCategory[]) => [...xs].sort().join(',');
  return a.every((ea) => {
    const eb = b.find((x) => x.position === ea.position);
    return eb && sort(ea.allowed) === sort(eb.allowed);
  });
}

function ruleSetToDraft(rs: RuleSet): RuleSetDraft {
  return {
    gradeScale: GRADES.map((g) => {
      const e = rs.gradeScale.find((x) => x.grade === g);
      return { grade: g, min: e?.min ?? 0, max: e?.max ?? 0 };
    }),
    gradingScales: {
      amount: GRADES.map((g) => {
        const e = rs.gradingScales.amount.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
      rate: GRADES.map((g) => {
        const e = rs.gradingScales.rate.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
    },
    poolRatios: {
      excellent: { ...rs.poolRatios.excellent },
      standard: { ...rs.poolRatios.standard },
      poor: { ...rs.poolRatios.poor },
    },
    raiseRates: { ...rs.raiseRates },
    weightPolicy: { ...rs.weightPolicy },
  };
}

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
  const [activeTab, setActiveTab] = useState<TabKey>('rules');

  // ── RuleSet ──
  const { data: rsData, loading: rsLoading, reload: reloadRs } = useRuleSets({
    enabled: allowed,
  });
  const ruleSet: RuleSet | null =
    rsData?.data.find((r) => r.cycleId === cycleId) ?? null;
  const [draft, setDraft] = useState<RuleSetDraft | null>(null);
  const [measureTab, setMeasureTab] = useState<'amount' | 'rate'>('amount');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rsBusy, setRsBusy] = useState(false);

  useEffect(() => {
    if (ruleSet) setDraft(ruleSetToDraft(ruleSet));
    else setDraft(null);
  }, [ruleSet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rsValid = draft ? validateRuleSet(draft).ok : false;
  const qualMax = draft?.weightPolicy.qualitativeMaxPercent ?? 30;

  async function saveRuleSet() {
    if (!ruleSet || !draft || !rsValid) return;
    setRsBusy(true);
    try {
      await ruleSetCommands.update(ruleSet.id, {
        gradeScale: draft.gradeScale,
        gradingScales: draft.gradingScales,
        poolRatios: draft.poolRatios,
        raiseRates: draft.raiseRates,
        weightPolicy: draft.weightPolicy,
      });
      toast.show({ variant: 'success', message: '설정을 저장했어요.' });
      setPreviewOpen(false);
      reloadRs();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setRsBusy(false);
    }
  }

  // ── KPI 양식 ──
  const [jobLevel, setJobLevel] = useState<JobLevel>('division_head');
  const {
    data: tplData,
    loading: tplLoading,
    reload: reloadTpl,
  } = useKpiTemplates({ cycleId }, { enabled: allowed && !!cycleId });
  const currentTemplate = useMemo(
    () => tplData?.data.find((t) => t.jobLevel === jobLevel) ?? null,
    [tplData, jobLevel],
  );
  const [tplItems, setTplItems] = useState<TemplateItemDraft[]>([]);
  const [tplBusy, setTplBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (currentTemplate) {
      setTplItems(
        currentTemplate.items.map((it, i) => ({
          key: `${it.id}-${i}`,
          category: it.category,
          group: it.group,
          defaultMeasureType: it.defaultMeasureType,
          defaultWeight: it.defaultWeight,
          isQualitative: it.isQualitative,
        })),
      );
    } else {
      setTplItems([]);
    }
  }, [currentTemplate?.id, jobLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  const tplOk = templateValid(tplItems, qualMax);

  async function saveTemplate() {
    if (!cycleId || !tplOk) return;
    setTplBusy(true);
    const items: KpiTemplateItemInput[] = tplItems.map((it) => ({
      category: it.category,
      group: it.group,
      defaultMeasureType: it.defaultMeasureType,
      defaultWeight: it.defaultWeight,
      isQualitative: it.isQualitative,
    }));
    try {
      if (currentTemplate) {
        await kpiTemplateCommands.update(currentTemplate.id, items);
      } else {
        await kpiTemplateCommands.create({ cycleId, jobLevel, items });
      }
      toast.show({ variant: 'success', message: '양식을 저장했어요.' });
      reloadTpl();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setTplBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (!cycleId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await uploadExcel(
        `/excel/import/templates?cycleId=${cycleId}`,
        file,
      );
      setImportResult(res);
      if (res.ok) {
        toast.show({
          variant: 'success',
          message: `${res.imported}건을 반영했어요.`,
        });
        reloadTpl();
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : '업로드에 실패했어요.',
      });
    } finally {
      setImporting(false);
    }
  }

  // ── 일정 ──
  const {
    data: schedData,
    loading: schedLoading,
    reload: reloadSched,
  } = useSchedules(cycleId, { enabled: allowed });
  const [phases, setPhases] = useState<PhaseDraft[]>([]);
  const [channels, setChannels] = useState({ inApp: true, email: true });
  const [schedBusy, setSchedBusy] = useState(false);

  // ── 조직/실적 엑셀 임포트 (요구 C-1) ──
  const [orgImporting, setOrgImporting] = useState(false);
  const [orgResult, setOrgResult] = useState<ImportResult | null>(null);
  const [achImporting, setAchImporting] = useState(false);
  const [achResult, setAchResult] = useState<ImportResult | null>(null);

  async function handleOrgImport(file: File) {
    setOrgImporting(true);
    setOrgResult(null);
    try {
      const res = await uploadExcel('/excel/import/org', file);
      setOrgResult(res);
      if (res.ok) {
        toast.show({
          variant: 'success',
          message: `조직·대상자 ${res.imported}건을 반영했어요.`,
        });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '업로드에 실패했어요.',
      });
    } finally {
      setOrgImporting(false);
    }
  }

  async function handleAchievementsImport(file: File) {
    setAchImporting(true);
    setAchResult(null);
    try {
      const res = await uploadExcel('/excel/import/achievements', file);
      setAchResult(res);
      if (res.ok) {
        toast.show({
          variant: 'success',
          message: `KPI 실적 ${res.imported}건을 반영했어요.`,
        });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '업로드에 실패했어요.',
      });
    } finally {
      setAchImporting(false);
    }
  }

  // ── KPI 카테고리 정책 (Item3) ──
  const {
    data: policyData,
    loading: policyLoading,
    reload: reloadPolicy,
  } = useKpiCategoryPolicy({ enabled: allowed });
  const [policyDraft, setPolicyDraft] = useState<KpiCategoryPolicyEntry[] | null>(
    null,
  );
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    if (policyData) setPolicyDraft(policyData.data);
  }, [policyData]);

  const policyDirty = useMemo(
    () =>
      !!policyDraft &&
      !!policyData &&
      !policyEqual(policyDraft, policyData.data),
    [policyDraft, policyData],
  );

  function togglePolicy(
    position: Position,
    category: KpiCategory,
    allow: boolean,
  ) {
    setPolicyDraft((prev) =>
      prev
        ? prev.map((e) =>
            e.position === position
              ? {
                  ...e,
                  allowed: allow
                    ? Array.from(new Set([...e.allowed, category]))
                    : e.allowed.filter((c) => c !== category),
                }
              : e,
          )
        : prev,
    );
  }
  function togglePolicyColumn(category: KpiCategory, allow: boolean) {
    setPolicyDraft((prev) =>
      prev
        ? prev.map((e) => ({
            ...e,
            allowed: allow
              ? Array.from(new Set([...e.allowed, category]))
              : e.allowed.filter((c) => c !== category),
          }))
        : prev,
    );
  }
  function resetPolicyDefaults() {
    setPolicyDraft((prev) =>
      prev
        ? prev.map((e) => ({ ...e, allowed: defaultAllowedFor(e.position) }))
        : prev,
    );
  }
  async function savePolicy() {
    if (!policyDraft) return;
    setPolicySaving(true);
    try {
      await kpiCategoryPolicyCommands.update(
        policyDraft.map((e) => ({ position: e.position, allowed: e.allowed })),
      );
      toast.show({
        variant: 'success',
        message: '권한 정책을 저장했어요. 다음 KPI 작성부터 적용돼요.',
      });
      reloadPolicy();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setPolicySaving(false);
    }
  }

  // ── 온보딩: 명부 일괄 등록 (Item1) ──
  const [rosterImporting, setRosterImporting] = useState(false);
  const [rosterResult, setRosterResult] = useState<ImportResult | null>(null);
  async function handleRosterImport(file: File) {
    setRosterImporting(true);
    setRosterResult(null);
    try {
      const res = await uploadExcel('/excel/import/roster', file);
      setRosterResult(res);
      if (res.ok) {
        toast.show({
          variant: 'success',
          message: `구성원 ${res.imported}명과 조직을 반영했어요.`,
        });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '업로드에 실패했어요.',
      });
    } finally {
      setRosterImporting(false);
    }
  }

  useEffect(() => {
    const existing = schedData?.data ?? [];
    const byPhase = new Map(existing.map((s) => [s.phase, s]));
    const merged: PhaseDraft[] = DEFAULT_PHASES.map((phase) => {
      const s = byPhase.get(phase);
      return {
        phase,
        startDate: s?.startDate ? s.startDate.slice(0, 10) : '',
        dueDate: s?.dueDate ? s.dueDate.slice(0, 10) : '',
        notifyOffsets: s?.notifyOffsets ?? [7, 3, 1],
        notifyEnabled: s?.notifyEnabled ?? true,
        isLocked: s?.isLocked ?? false,
      };
    });
    setPhases(merged);
  }, [schedData]);

  async function saveSchedule() {
    if (!cycleId) return;
    setSchedBusy(true);
    const payload: ScheduleItemInput[] = phases
      .filter((p) => p.dueDate)
      .map((p) => ({
        phase: p.phase,
        startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
        dueDate: new Date(p.dueDate).toISOString(),
        notifyOffsets: p.notifyOffsets,
        notifyEnabled: channels.inApp || channels.email ? p.notifyEnabled : false,
        isLocked: p.isLocked ?? false,
      }));
    if (payload.length === 0) {
      toast.show({
        variant: 'danger',
        message: '단계별 마감일을 하나 이상 입력해 주세요.',
      });
      setSchedBusy(false);
      return;
    }
    try {
      await scheduleCommands.upsert(cycleId, payload);
      toast.show({ variant: 'success', message: '일정을 저장했어요.' });
      reloadSched();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setSchedBusy(false);
    }
  }

  // 우하단 고정 Primary — 탭별 1개.
  const primaryAction = !allowed
    ? null
    : activeTab === 'kpi-category-policy' && policyDraft
      ? {
          label: '정책 저장',
          onClick: () => void savePolicy(),
          disabled: !policyDirty || policySaving,
          loading: policySaving,
        }
      : !current
        ? null
        : activeTab === 'rules' && ruleSet && draft
        ? {
            label: '설정 저장',
            onClick: () => setPreviewOpen(true),
            disabled: !rsValid || rsBusy,
            loading: rsBusy,
          }
        : activeTab === 'templates' && cycleId
          ? {
              label: '양식 저장',
              onClick: () => void saveTemplate(),
              disabled: !tplOk || tplBusy,
              loading: tplBusy,
            }
          : activeTab === 'schedule' && cycleId
            ? {
                label: '일정 저장',
                onClick: () => void saveSchedule(),
                disabled: schedBusy,
                loading: schedBusy,
              }
            : null;

  useSetPrimaryAction(primaryAction, [
    allowed,
    current,
    activeTab,
    ruleSet?.id,
    draft,
    rsValid,
    rsBusy,
    cycleId,
    tplItems,
    tplOk,
    tplBusy,
    phases,
    channels,
    schedBusy,
    policyDraft,
    policyDirty,
    policySaving,
  ]);

  if (!allowed) return <Forbidden message="설정은 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  // 주기 의존 탭(rules/templates/schedule)만 주기 필요. 정책·온보딩은 주기 없이 동작.
  const cycleIndependent =
    activeTab === 'kpi-category-policy' || activeTab === 'onboarding';
  if (!current && !cycleIndependent)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="관리자 설정"
          cycles={cycles}
          selectedId={selectedId}
          onSelectCycle={setSelectedId}
        />
        <Tabs
          items={SETTINGS_TABS}
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
        />
        <EmptyState title="이 탭은 평가 주기를 먼저 선택해 주세요." />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="관리자 설정"
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
      />

      <InfoBanner tone="info" title="설정 안내">
        등급 척도·달성률표·풀 비율·인상률·가중치는 RuleSet으로, KPI 양식과
        일정·알림은 주기별로 관리돼요. 저장하면 이후 산정·알림에 반영돼요.
      </InfoBanner>

      <Tabs
        items={SETTINGS_TABS}
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
      />

      {/* 규칙 탭 */}
      {activeTab === 'rules' &&
        (rsLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : ruleSet && draft ? (
          <RuleSetEditor
            value={draft}
            onChange={setDraft}
            measureTab={measureTab}
            onMeasureTabChange={setMeasureTab}
          />
        ) : (
          <EmptyState
            title="이 주기의 RuleSet이 없어요."
            description="주기를 활성화하면 기본 RuleSet이 연결돼요."
          />
        ))}

      {/* KPI 양식 탭 */}
      {activeTab === 'templates' &&
        (tplLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setImportResult(null);
                  setImportOpen(true);
                }}
              >
                엑셀로 일괄 등록
              </Button>
            </div>
            <TemplateEditor
              jobLevel={jobLevel}
              onJobLevelChange={setJobLevel}
              items={tplItems}
              qualitativeMax={qualMax}
              onAdd={() =>
                setTplItems((prev) => [
                  ...prev,
                  {
                    key: `new-${Date.now()}-${prev.length}`,
                    category: 'revenue',
                    group: 'performance_core',
                    defaultMeasureType: 'amount',
                    defaultWeight: 0,
                    isQualitative: false,
                  },
                ])
              }
              onChange={(key, patch) =>
                setTplItems((prev) =>
                  prev.map((it) =>
                    it.key === key ? { ...it, ...patch } : it,
                  ),
                )
              }
              onRemove={(key) =>
                setTplItems((prev) => prev.filter((it) => it.key !== key))
              }
            />
          </>
        ))}

      {/* 일정 탭 */}
      {activeTab === 'schedule' &&
        (schedLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <ScheduleEditor
              phases={phases}
              onPhaseChange={(phase, patch) =>
                setPhases((prev) =>
                  prev.map((p) =>
                    p.phase === phase ? { ...p, ...patch } : p,
                  ),
                )
              }
              channels={channels}
              onChannelsChange={setChannels}
            />

            <Card title="조직·대상자 엑셀 임포트">
              <p className="mb-4 text-sm text-muted-foreground">
                양식을 내려받아 본부·팀·임직원과 평가 대상자를 한 번에 등록해요.
              </p>
              <FileDropzone
                uploading={orgImporting}
                result={orgResult}
                showCommit={false}
                templateHref="/excel/template/org"
                templateLabel="조직 양식 받기"
                onSelect={(file) => void handleOrgImport(file)}
                onClear={() => setOrgResult(null)}
              />
            </Card>

            <Card title="KPI 실적 엑셀 임포트">
              <p className="mb-4 text-sm text-muted-foreground">
                양식을 내려받아 분기별 KPI 실적(달성값)을 일괄로 올려요.
              </p>
              <FileDropzone
                uploading={achImporting}
                result={achResult}
                showCommit={false}
                templateHref="/excel/template/achievements"
                templateLabel="실적 양식 받기"
                onSelect={(file) => void handleAchievementsImport(file)}
                onClear={() => setAchResult(null)}
              />
            </Card>
          </>
        ))}

      {/* KPI 카테고리 권한 탭 (Item3) */}
      {activeTab === 'kpi-category-policy' &&
        (policyLoading || !policyDraft ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <CategoryPolicyMatrix
            value={policyDraft}
            onToggle={togglePolicy}
            onToggleColumn={togglePolicyColumn}
            onSave={() => void savePolicy()}
            onResetDefaults={resetPolicyDefaults}
            saving={policySaving}
            dirty={policyDirty}
          />
        ))}

      {/* 명부 온보딩 탭 (Item1) */}
      {activeTab === 'onboarding' && (
        <Card title="임직원 명부 일괄 등록">
          <RosterImportPanel
            uploading={rosterImporting}
            result={rosterResult}
            onSelect={(file) => void handleRosterImport(file)}
            onClear={() => setRosterResult(null)}
          />
        </Card>
      )}

      {/* RuleSet 변경 미리보기 → 저장 */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="설정 저장 확인"
        secondaryAction={{ label: '취소', onClick: () => setPreviewOpen(false) }}
        primaryAction={{
          label: '저장',
          onClick: () => void saveRuleSet(),
          loading: rsBusy,
          disabled: !rsValid,
        }}
      >
        활성 주기의 규칙을 변경하면 점수·등급·풀·인상률이 다시 산정돼요. 저장할까요?
      </Modal>

      {/* KPI 양식 엑셀 일괄 등록 */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="엑셀로 일괄 등록 — KPI 양식"
        size="lg"
        secondaryAction={{ label: '닫기', onClick: () => setImportOpen(false) }}
      >
        <FileDropzone
          uploading={importing}
          result={importResult}
          showCommit={false}
          templateHref="/excel/template/templates"
          templateLabel="KPI 양식 받기"
          onSelect={(file) => void handleImport(file)}
          onClear={() => setImportResult(null)}
        />
      </Modal>
    </div>
  );
}
