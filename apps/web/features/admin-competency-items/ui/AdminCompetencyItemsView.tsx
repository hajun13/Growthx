'use client';

import { Suspense, useMemo, useState } from 'react';
import { Plus, Copy, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import {
  useCompetencyQuestionsData,
  useCompetencyCategoriesData,
  competencyQuestionCommands,
  competencyCategoryCommands,
} from '../hooks';
import type { CompetencyQuestion, CompetencyQuestionInput, CompetencyQuestionPatch, CompetencyCategory } from '../api';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
} from '@/components/ui/input-group';
import { isHrAdmin } from '@/lib/nav';
import { EmptyState, Forbidden } from './StateViews';
import { CompositionCards } from './CompositionCards';
import { CategoryWeightPanel } from './CategoryWeightPanel';
import { audienceSums } from '../weights';
import { QuestionTable } from './QuestionTable';
import { ConfirmDialog } from './ConfirmDialog';
import {
  DEFAULT_OPTIONS, QuestionForm, emptyDraft, type QuestionDraft,
} from './QuestionForm';

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
  // 카테고리 삭제 확인 모달 대상 — X 클릭 즉시 삭제 방지(문항 삭제와 동일 패턴).
  const [catDeleteTarget, setCatDeleteTarget] = useState<CompetencyCategory | null>(null);
  const [copying, setCopying] = useState(false);

  // 복사 소스 = 연도 기준 직전 주기(임의 첫 항목 선택 방지). 직전 연도가 없으면
  // 다른 주기 중 최신 연도로 폴백.
  const prevCycle = useMemo(() => {
    const others = cycles.filter((c) => c.id !== cycleId);
    if (others.length === 0) return undefined;
    const currentYear = current?.year;
    const sorted = [...others].sort((a, b) => b.year - a.year);
    return (
      (currentYear != null ? sorted.find((c) => c.year < currentYear) : undefined) ?? sorted[0]
    );
  }, [cycles, cycleId, current?.year]);
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
      targetGroup: q.targetGroup ?? 'all',
      options: q.options.length === 5 ? [...q.options] : [...DEFAULT_OPTIONS],
      isActive: q.isActive,
    });
    setEditOpen(true);
  }

  async function save() {
    if (!cycleId) return;
    if (!draft.text.trim()) { toast.error('문항명을 입력해 주세요.', { duration: 8000 }); return; }
    if (!draft.categoryId) { toast.error('카테고리를 선택해 주세요.', { duration: 8000 }); return; }
    const options = draft.options.map((o) => o.trim());
    if (options.some((o) => !o)) { toast.error('보기 5개를 모두 입력해 주세요.', { duration: 8000 }); return; }
    setBusy(true);
    try {
      // 가중치는 보내지 않는다 — 카테고리 단위라 서버가 선택한 카테고리의 가중치를 따르게 한다.
      if (editing) {
        await competencyQuestionCommands.update(editing.id, {
          text: draft.text.trim(), hint: draft.hint.trim() || undefined,
          categoryId: draft.categoryId,
          targetGroup: draft.targetGroup as CompetencyQuestionPatch['targetGroup'],
          options, isActive: draft.isActive,
        });
      } else {
        await competencyQuestionCommands.create({
          cycleId, order: (questions.at(-1)?.order ?? 0) + 1,
          text: draft.text.trim(), hint: draft.hint.trim() || undefined,
          categoryId: draft.categoryId,
          targetGroup: draft.targetGroup as CompetencyQuestionInput['targetGroup'],
          options, isActive: draft.isActive,
        });
      }
      toast.success('문항을 저장했어요.');
      setEditOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '저장에 실패했어요.', { duration: 8000 });
    } finally { setBusy(false); }
  }

  async function toggleActive(q: CompetencyQuestion) {
    try { await competencyQuestionCommands.update(q.id, { isActive: !q.isActive }); reload(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : '변경에 실패했어요.', { duration: 8000 }); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await competencyQuestionCommands.remove(deleteTarget.id);
      toast.success('문항을 삭제했어요.');
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '삭제에 실패했어요.', { duration: 8000 });
    } finally { setDeleteTarget(null); }
  }

  async function addCategory(name: string) {
    const n = name.trim();
    if (!n) return;
    try {
      await competencyCategoryCommands.create({ name: n, order: categories.length, isActive: true });
      toast.success(`카테고리 "${n}"를 추가했어요.`);
      reloadCats();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '카테고리 추가에 실패했어요.', { duration: 8000 });
    }
  }

  async function deleteCategory(cat: CompetencyCategory) {
    try {
      await competencyCategoryCommands.remove(cat.id);
      toast.success(`카테고리 "${cat.name}"를 삭제했어요.`);
      if (draft.categoryId === cat.id) setDraft((d) => ({ ...d, categoryId: '' }));
      reloadCats();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '삭제에 실패했어요.';
      toast.error(msg.includes('400') || msg.toLowerCase().includes('in use') ? `"${cat.name}"은 사용 중인 카테고리라 삭제할 수 없어요.` : msg, { duration: 8000 });
    }
  }

  async function handleCopyFromCycle() {
    if (!prevCycle || !cycleId) return;
    setCopying(true);
    try {
      await competencyCategoryCommands.copyFromCycle({ sourceCycleId: prevCycle.id, targetCycleId: cycleId });
      toast.success(`${prevCycle.name}(${prevCycle.year})에서 문항을 복사했어요.`);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '복사에 실패했어요.', { duration: 8000 });
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
  const weightSums = audienceSums(questions);
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
                variant="outline"
                size="sm"
                loading={copying}
                onClick={() => void handleCopyFromCycle()}
              >
                {!copying && <Copy aria-hidden />}
                {`${prevCycle!.name}(${prevCycle!.year})에서 복사`}
              </Button>
            )}
            <Button
              size="sm"
              onClick={openCreate}
            >
              <Plus aria-hidden />
              문항 추가
            </Button>
          </div>
        }
      />

      <CompositionCards
        weightSums={weightSums}
        managerCount={managerCount}
        nonManagerCount={nonManagerCount}
        emptyCategoryCount={categoryWithoutQuestion.length}
        inactiveCount={inactiveCount}
      />

      {cycleId && !loading && !error && (
        <CategoryWeightPanel cycleId={cycleId} questions={questions} onSaved={reload} />
      )}

      {/* 필터 바 */}
      <div className="gx-toolbar">
        <FilterChipBar
          options={catFilterOptions}
          value={catFilter}
          onChange={setCatFilter}
        />
        <InputGroup className="inline-flex h-9 w-full min-w-50 md:w-56">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label="문항 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="문항 검색..."
            className="h-full"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="secondary"
                size="icon-xs"
                aria-label="검색어 지우기"
                onClick={() => setSearch('')}
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <span className="ml-auto inline-flex h-8 items-center rounded-xs bg-muted px-3 text-12 font-bold text-muted-foreground">
          {filtered.length}개
        </span>
      </div>

      <QuestionTable
        loading={loading}
        error={error}
        questions={filtered}
        onRetry={reload}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onToggleActive={(q) => void toggleActive(q)}
      />

      {/* 추가/편집 모달 */}
      <ConfirmDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? '문항 편집' : '문항 추가'}
        size="md"
        primary={{ label: '저장', onClick: () => void save(), loading: busy, disabled: !draft.text.trim() }}
      >
        <QuestionForm
          draft={draft}
          setDraft={setDraft}
          categories={categories}
          onAddCategory={addCategory}
          onDeleteCategory={setCatDeleteTarget}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="문항을 삭제할까요?"
        primary={{ label: '삭제', destructive: true, onClick: () => void confirmDelete() }}
      >
        &ldquo;{deleteTarget?.text}&rdquo; 문항과 이 문항에 등록된 임직원 응답이 함께 삭제돼요.
        이 작업은 되돌릴 수 없어요.
      </ConfirmDialog>

      {/* 카테고리 삭제 확인 — X 즉시 삭제 방지(CategoryManager 의 deleteTarget 패턴 이식) */}
      <ConfirmDialog
        open={catDeleteTarget !== null}
        onClose={() => setCatDeleteTarget(null)}
        title="카테고리를 삭제할까요?"
        primary={{
          label: '삭제',
          destructive: true,
          onClick: () => {
            const target = catDeleteTarget;
            setCatDeleteTarget(null);
            if (target) void deleteCategory(target);
          },
        }}
      >
        &ldquo;{catDeleteTarget?.name}&rdquo; 카테고리를 삭제해요. 문항이 사용 중인 카테고리는 삭제되지 않아요.
      </ConfirmDialog>
    </PageContainer>
  );
}
