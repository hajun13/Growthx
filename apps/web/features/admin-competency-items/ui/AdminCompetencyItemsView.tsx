'use client';

import { Suspense, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Copy, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import {
  useCompetencyQuestionsData,
  useCompetencyCategoriesData,
  competencyQuestionCommands,
  competencyCategoryCommands,
} from '../hooks';
import type { CompetencyQuestion, CompetencyQuestionInput, CompetencyQuestionPatch, CompetencyCategory } from '../api';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TextField } from '@/components/TextField';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Input } from '@/components/ui/input';
import { isHrAdmin } from '@/lib/nav';

const TARGET_GROUP_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'manager', label: '직책자' },
  { value: 'non_manager', label: '비직책자' },
] as const;
const targetGroupLabel = (v: string) =>
  TARGET_GROUP_OPTIONS.find((o) => o.value === v)?.label ?? v;

const DEFAULT_OPTIONS = ['매우미흡', '미흡', '보통', '우수', '매우우수'];
const GRID = '1fr 100px 90px 80px 80px 80px';

interface QuestionDraft {
  text: string;
  hint: string;
  categoryId: string;
  weight: string;
  targetGroup: string;
  options: string[];
  isActive: boolean;
}

const emptyDraft: QuestionDraft = {
  text: '', hint: '', categoryId: '', weight: '0',
  targetGroup: 'all', options: [...DEFAULT_OPTIONS], isActive: true,
};

// useCycleParam 이 useSearchParams 를 쓰므로 Suspense 경계 필수(정적 빌드 CSR bailout 방지).
export function AdminCompetencyItemsView() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <AdminCompetencyItemsViewInner />
    </Suspense>
  );
}

function AdminCompetencyItemsViewInner() {
  const { user } = useAuth();
  const toast = useToast();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const cycleId = current?.id;
  const allowed = !!user && isHrAdmin(user.role);

  const { items: categories, reload: reloadCats } = useCompetencyCategoriesData({ enabled: allowed });
  const { items: questions, loading, error, reload } = useCompetencyQuestionsData(
    { cycleId },
    { enabled: allowed },
  );

  const [catFilter, setCatFilter] = useState<string>('전체');
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => questions.filter((q) =>
      (catFilter === '전체' || q.categoryName === catFilter || q.categoryId === catFilter) &&
      (!search || q.text.includes(search)),
    ),
    [questions, catFilter, search],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CompetencyQuestion | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompetencyQuestion | null>(null);
  const [copying, setCopying] = useState(false);

  const prevCycle = cycles.find((c) => c.id !== cycleId);
  const canCopy = !!prevCycle && questions.length === 0;

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft, categoryId: categories[0]?.id ?? '' });
    setEditOpen(true);
  }

  function openEdit(q: CompetencyQuestion) {
    setEditing(q);
    setDraft({
      text: q.text, hint: q.hint ?? '', categoryId: q.categoryId,
      weight: String(q.weight), targetGroup: q.targetGroup ?? 'all',
      options: q.options.length === 5 ? [...q.options] : [...DEFAULT_OPTIONS],
      isActive: q.isActive,
    });
    setEditOpen(true);
  }

  async function save() {
    if (!cycleId) return;
    if (!draft.text.trim()) { toast.show({ variant: 'danger', message: '문항명을 입력해 주세요.' }); return; }
    if (!draft.categoryId) { toast.show({ variant: 'danger', message: '카테고리를 선택해 주세요.' }); return; }
    const options = draft.options.map((o) => o.trim());
    if (options.some((o) => !o)) { toast.show({ variant: 'danger', message: '보기 5개를 모두 입력해 주세요.' }); return; }
    setBusy(true);
    try {
      const weight = Number(draft.weight) || 0;
      if (editing) {
        await competencyQuestionCommands.update(editing.id, {
          text: draft.text.trim(), hint: draft.hint.trim() || undefined,
          categoryId: draft.categoryId, weight,
          targetGroup: draft.targetGroup as CompetencyQuestionPatch['targetGroup'],
          options, isActive: draft.isActive,
        });
      } else {
        await competencyQuestionCommands.create({
          cycleId, order: (questions.at(-1)?.order ?? 0) + 1,
          text: draft.text.trim(), hint: draft.hint.trim() || undefined,
          categoryId: draft.categoryId, weight,
          targetGroup: draft.targetGroup as CompetencyQuestionInput['targetGroup'],
          options, isActive: draft.isActive,
        });
      }
      toast.show({ variant: 'success', message: '문항을 저장했어요.' });
      setEditOpen(false);
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally { setBusy(false); }
  }

  async function toggleActive(q: CompetencyQuestion) {
    try { await competencyQuestionCommands.update(q.id, { isActive: !q.isActive }); reload(); }
    catch (err) { toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '변경에 실패했어요.' }); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await competencyQuestionCommands.remove(deleteTarget.id);
      toast.show({ variant: 'success', message: '문항을 삭제했어요.' });
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '삭제에 실패했어요.' });
    } finally { setDeleteTarget(null); }
  }

  async function addCategory(name: string) {
    const n = name.trim();
    if (!n) return;
    try {
      await competencyCategoryCommands.create({ name: n, order: categories.length, isActive: true });
      toast.show({ variant: 'success', message: `카테고리 "${n}"를 추가했어요.` });
      reloadCats();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '카테고리 추가에 실패했어요.' });
    }
  }

  async function deleteCategory(cat: CompetencyCategory) {
    try {
      await competencyCategoryCommands.remove(cat.id);
      toast.show({ variant: 'success', message: `카테고리 "${cat.name}"를 삭제했어요.` });
      if (draft.categoryId === cat.id) setDraft((d) => ({ ...d, categoryId: '' }));
      reloadCats();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '삭제에 실패했어요.';
      toast.show({
        variant: 'danger',
        message:
          msg.includes('400') || msg.toLowerCase().includes('in use')
            ? `"${cat.name}"은 사용 중인 카테고리라 삭제할 수 없어요.`
            : msg,
      });
    }
  }

  async function handleCopyFromCycle() {
    if (!prevCycle || !cycleId) return;
    setCopying(true);
    try {
      await competencyCategoryCommands.copyFromCycle({ sourceCycleId: prevCycle.id, targetCycleId: cycleId });
      toast.show({ variant: 'success', message: `이전 사이클(${prevCycle.name})에서 문항을 복사했어요.` });
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '복사에 실패했어요.' });
    } finally { setCopying(false); }
  }

  if (!allowed) return <Forbidden message="역량평가 문항 관리는 HR만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const activeCount = questions.filter((q) => q.isActive).length;
  const catNames = Array.from(new Set(questions.map((q) => q.categoryName ?? q.categoryId)));
  const inactiveCount = questions.length - activeCount;
  const managerCount = questions.filter((q) => q.targetGroup === 'manager').length;
  const nonManagerCount = questions.filter((q) => q.targetGroup === 'non_manager').length;
  const activeWeight = questions
    .filter((q) => q.isActive)
    .reduce((sum, q) => sum + q.weight, 0);
  const categoryWithoutQuestion = categories.filter(
    (cat) => !questions.some((q) => q.categoryId === cat.id),
  );
  const catFilterOptions = [
    { value: '전체', label: '전체' },
    ...catNames.map((n) => ({ value: n, label: n })),
  ];

  return (
    <PageContainer>
      <PageHeader
        title="역량평가 문항"
        subtitle="역량평가에 사용되는 문항을 관리합니다. (연봉 미반영 · 참고용)"
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-2.5 flex-wrap">
            <HeaderMetrics
              items={[
                { label: '전체 문항', value: questions.length },
                { label: '활성 문항', value: activeCount },
                {
                  label: '비활성',
                  value: inactiveCount,
                  accent: inactiveCount > 0 ? 'text-foreground' : undefined,
                },
                { label: '카테고리', value: catNames.length },
              ]}
            />
            {canCopy && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Copy size={13} aria-hidden />}
                loading={copying}
                onClick={() => void handleCopyFromCycle()}
              >
                이전 사이클 복사
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={openCreate}
            >
              문항 추가
            </Button>
          </div>
        }
      />

      <div className="gx-workbench-grid">
        <Card title="문항 구성 점검">
          <div className="grid gap-3 sm:grid-cols-4">
            <QuestionMetric label="활성 가중치" value={`${activeWeight}%`} />
            <QuestionMetric label="직책자 문항" value={`${managerCount}개`} />
            <QuestionMetric label="비직책자 문항" value={`${nonManagerCount}개`} />
            <QuestionMetric label="비어 있는 카테고리" value={`${categoryWithoutQuestion.length}개`} muted={categoryWithoutQuestion.length === 0} />
          </div>
          <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
            역량평가는 연봉·등급에 반영되지 않는 참고 데이터입니다. 다만 문항 수와 대상군이 치우치면 평가 이력의 해석 품질이 낮아지므로,
            활성 문항과 카테고리 공백을 먼저 정리하세요.
          </p>
        </Card>
        <Card title="작업 순서">
          <div className="space-y-2.5">
            {[
              ['카테고리', categoryWithoutQuestion.length > 0 ? `${categoryWithoutQuestion.length}개 카테고리에 문항 없음` : '카테고리 구성 완료'],
              ['대상군', managerCount === 0 || nonManagerCount === 0 ? '직책자/비직책자 문항 균형 확인' : '대상군 문항 분리 완료'],
              ['노출', inactiveCount > 0 ? '비활성 문항은 응답 화면에 숨김' : '모든 문항 활성 상태'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-b-0 last:pb-0">
                <span className="text-[12px] font-semibold text-foreground">{label}</span>
                <span className="text-right text-[12px] leading-5 text-muted-foreground">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 필터 바 */}
      <div className="gx-toolbar">
        <FilterChipBar
          options={catFilterOptions}
          value={catFilter}
          onChange={setCatFilter}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="문항 검색..."
          className="w-full md:w-56"
        />
        <span className="ml-auto inline-flex h-8 items-center rounded-[4px] bg-muted px-3 text-[12px] font-bold text-muted-foreground">
          {filtered.length}개
        </span>
      </div>

      {/* 테이블 */}
      <Card padding="sm">
        <div
          className="sticky top-0 z-10 grid px-4 py-2.5 bg-muted border-b border-border"
          style={{ gridTemplateColumns: GRID }}
        >
          {['문항명', '카테고리', '대상', '가중치', '상태', ''].map((h, i) => (
            <div
              key={i}
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-4"><Skeleton className="h-40 w-full" /></div>
        ) : error ? (
          <div className="p-4"><ErrorState onRetry={reload} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState title="문항이 없어요." description="문항 추가 버튼으로 첫 역량평가 문항을 등록해 주세요." />
          </div>
        ) : (
          filtered.map((q) => (
            <div
              key={q.id}
              className="grid items-center px-4 py-3.5 transition-colors hover:bg-muted/60 border-b border-border/40 last:border-b-0"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="min-w-0 pr-3">
                <div className="text-[13px] font-semibold text-foreground">{q.text}</div>
                {q.hint && <div className="text-[11.5px] text-muted-foreground mt-0.5">{q.hint}</div>}
              </div>
              <div>
                <span className="rounded-[4px] bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  {q.categoryName ?? q.categoryId}
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground">{targetGroupLabel(q.targetGroup)}</div>
              <div className="text-[12.5px] font-semibold text-foreground tabular-nums">{q.weight}%</div>
              <div>
                <Button
                  variant={q.isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => void toggleActive(q)}
                >
                  {q.isActive ? '활성' : '비활성'}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(q)}
                  aria-label="편집"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60"
                >
                  <Edit2 size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(q)}
                  aria-label="삭제"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* 추가/편집 모달 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? '문항 편집' : '문항 추가'}
        size="md"
        secondaryAction={{ label: '취소', onClick: () => setEditOpen(false) }}
        primaryAction={{ label: '저장', onClick: () => void save(), loading: busy, disabled: !draft.text.trim() }}
      >
        <QuestionForm
          draft={draft}
          setDraft={setDraft}
          categories={categories}
          onAddCategory={addCategory}
          onDeleteCategory={deleteCategory}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="문항을 삭제할까요?"
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
        primaryAction={{ label: '삭제', variant: 'danger', onClick: () => void confirmDelete() }}
      >
        삭제하면 해당 문항과 응답이 함께 사라질 수 있어요.
      </Modal>
    </PageContainer>
  );
}

// ── 문항 폼 ──────────────────────────────────────────────────────

function QuestionMetric({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="border border-border bg-card px-3 py-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums text-[18px] font-bold ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

interface FormProps {
  draft: QuestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  categories: CompetencyCategory[];
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (cat: CompetencyCategory) => Promise<void>;
}

function QuestionForm({ draft, setDraft, categories, onAddCategory, onDeleteCategory }: FormProps) {
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  async function handleAddCat() {
    if (!newCat.trim() || addingCat) return;
    setAddingCat(true);
    await onAddCategory(newCat);
    setNewCat('');
    setAddingCat(false);
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <TextField
        label="문항명"
        value={draft.text}
        onChange={(v) => setDraft((d) => ({ ...d, text: v }))}
        required
        placeholder="예) 방향 제시 및 비전 공유"
      />
      <TextField
        label="설명 (선택)"
        value={draft.hint}
        onChange={(v) => setDraft((d) => ({ ...d, hint: v }))}
        multiline
        rows={2}
        placeholder="문항에 대한 보조 설명"
      />

      {/* 카테고리 — 선택 + 추가/삭제 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">카테고리</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const on = draft.categoryId === cat.id;
            return (
              <span
                key={cat.id}
                className={[
                  'inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12px] font-medium transition-colors border',
                  on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted/60',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, categoryId: cat.id }))}
                  className="outline-none"
                >
                  {cat.name}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteCategory(cat)}
                  aria-label={`${cat.name} 삭제`}
                  className="flex items-center justify-center opacity-60 transition-opacity hover:opacity-100"
                >
                  <X size={11} aria-hidden />
                </button>
              </span>
            );
          })}
          {categories.length === 0 && (
            <span className="text-[12px] text-muted-foreground">등록된 카테고리가 없어요. 아래에서 추가하세요.</span>
          )}
        </div>
        {/* 새 카테고리 추가 */}
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddCat();
              }
            }}
            placeholder="새 카테고리 추가"
            className="h-9 flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={13} aria-hidden />}
            onClick={() => void handleAddCat()}
            disabled={addingCat || !newCat.trim()}
            loading={addingCat}
          >
            추가
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="가중치 (%)"
          type="number"
          value={draft.weight}
          onChange={(v) => setDraft((d) => ({ ...d, weight: v }))}
        />
        {/* 대상 — 라디오 */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">대상</span>
          <div className="flex flex-col gap-1.5">
            {TARGET_GROUP_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-[13px] text-foreground">
                <input
                  type="radio"
                  name="targetGroup"
                  value={opt.value}
                  checked={draft.targetGroup === opt.value}
                  onChange={() => setDraft((d) => ({ ...d, targetGroup: opt.value }))}
                  className="accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 5지선다 보기 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground">5지선다 보기</span>
          <span className="text-[11px] text-muted-foreground">1점 = 가장 낮음 · 5점 = 가장 높음</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tabular-nums inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-primary text-[12px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              <Input
                value={opt}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft((d) => {
                    const next = [...d.options];
                    next[i] = v;
                    return { ...d, options: next };
                  });
                }}
                placeholder={DEFAULT_OPTIONS[i]}
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
          className="accent-primary h-4 w-4 rounded"
        />
        활성화 (임직원 화면에 노출)
      </label>
    </div>
  );
}
