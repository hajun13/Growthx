'use client';

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
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
import { StatCard } from '@/components/StatCard';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { Input } from '@/components/ui/input';
import { isHrAdmin } from '@/lib/nav';
import { CategoryManager } from './CategoryManager';

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

export function AdminCompetencyItemsView() {
  const { user } = useAuth();
  const toast = useToast();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
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

  const MAX_QUESTIONS = 10;
  const atMax = questions.length >= MAX_QUESTIONS;

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
          <div className="flex items-center gap-2">
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
            <span className="text-[12px] text-muted-foreground">
              {questions.length} / {MAX_QUESTIONS}
            </span>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={openCreate}
              disabled={atMax}
            >
              문항 추가
            </Button>
          </div>
        }
      />

      {/* 카테고리 관리 */}
      <CategoryManager categories={categories} onReload={reloadCats} />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <StatCard label="전체 문항" value={questions.length} tone="default" />
        <StatCard label="활성 문항" value={activeCount} tone="info" />
        <StatCard label="비활성" value={questions.length - activeCount} tone="default" />
        <StatCard label="카테고리" value={catNames.length} tone="primary" />
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChipBar
          options={catFilterOptions}
          value={catFilter}
          onChange={setCatFilter}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="문항 검색..."
          className="w-48"
        />
      </div>

      {/* 테이블 */}
      <Card padding="sm">
        <div
          className="sticky top-0 z-10 grid px-4 py-2.5 bg-muted border-b border-border rounded-t-lg"
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
              className="grid items-center px-4 py-3.5 transition-colors hover:bg-accent border-b border-border/40 last:border-b-0"
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="min-w-0 pr-3">
                <div className="text-[13px] font-semibold text-foreground">{q.text}</div>
                {q.hint && <div className="text-[11.5px] text-muted-foreground mt-0.5">{q.hint}</div>}
              </div>
              <div>
                <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
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
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent"
                >
                  <Edit2 size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(q)}
                  aria-label="삭제"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-danger/30 text-danger transition-colors hover:bg-danger/10"
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
        <QuestionForm draft={draft} setDraft={setDraft} categories={categories} />
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

interface FormProps {
  draft: QuestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  categories: CompetencyCategory[];
}

function QuestionForm({ draft, setDraft, categories }: FormProps) {
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

      {/* 카테고리 — 동적 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">카테고리</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const on = draft.categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, categoryId: cat.id }))}
                className={[
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors border',
                  on
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-accent',
                ].join(' ')}
              >
                {cat.name}
              </button>
            );
          })}
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
              <span className="tabular-nums inline-flex items-center justify-center shrink-0 h-7 w-7 text-[12px] font-bold bg-primary text-primary-foreground rounded-md">
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
