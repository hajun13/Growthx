'use client';

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useCompetencyQuestionsData,
  useCompetencyCategoriesData,
  competencyQuestionCommands,
  competencyCategoryCommands,
} from '../hooks';
import type { CompetencyQuestion, CompetencyQuestionInput, CompetencyQuestionPatch } from '../api';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TextField } from '@/components/TextField';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { isHrAdmin } from '@/lib/nav';
import { CategoryManager } from './CategoryManager';

const FALLBACK_COLORS: { bg: string; color: string }[] = [
  { bg: '#7a37d8', color: '#fff' }, { bg: '#7A37D8', color: '#fff' },
  { bg: '#2563eb', color: '#fff' }, { bg: '#f59e0b', color: '#fff' },
  { bg: '#74747f', color: '#fff' },
];
const catColor = (name: string | null | undefined, idx: number) => FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

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

  // 이전 사이클 = cycles 중 current 제외한 첫번째
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
  const tabs = ['전체', ...catNames];

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
              <button
                onClick={() => void handleCopyFromCycle()}
                disabled={copying}
                className="flex items-center gap-1.5 px-3 py-2 disabled:opacity-50"
                style={{ fontSize: 12, fontWeight: 600, color: '#7a37d8', background: '#fff', border: '1px solid #7a37d8', borderRadius: 8, cursor: 'pointer' }}
              >
                <Copy size={13} /> {copying ? '복사 중…' : '이전 사이클 복사'}
              </button>
            )}
            <span style={{ fontSize: 12, color: '#74747f' }}>{questions.length} / {MAX_QUESTIONS}</span>
            <button
              onClick={openCreate} disabled={atMax}
              className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600, background: '#7a37d8', borderRadius: 8, boxShadow: '0 2px 8px rgba(122,55,216,0.18)' }}
            >
              <Plus size={14} /> 문항 추가
            </button>
          </div>
        }
      />

      {/* 카테고리 관리 */}
      <CategoryManager categories={categories} onReload={reloadCats} />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {[
          { label: '전체 문항', value: questions.length, color: '#18181c' },
          { label: '활성 문항', value: activeCount, color: '#2563eb' },
          { label: '비활성', value: questions.length - activeCount, color: '#74747f' },
          { label: '카테고리', value: catNames.length, color: '#7A37D8' },
        ].map((s) => (
          <div key={s.label} className="bg-white p-5 rounded-xl border border-[#ccccd4]/50 flex flex-col items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}>
            <span className="text-[#565660] text-[13px] font-semibold mb-1.5">{s.label}</span>
            <span className="tabular-nums text-[34px] font-extrabold leading-[1.2] tracking-[-0.02em]" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden bg-white" style={{ border: '1px solid rgba(204,204,212,0.4)', borderRadius: 8 }}>
          {tabs.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className="px-3 py-2"
              style={{ fontSize: 12, background: catFilter === c ? '#7a37d8' : '#fff', color: catFilter === c ? '#fff' : '#565660', fontWeight: catFilter === c ? 600 : 400 }}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2" style={{ border: '1px solid rgba(204,204,212,0.4)', borderRadius: 999 }}>
          <Search size={13} color="#74747f" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="문항 검색..."
            className="outline-none" style={{ fontSize: 12, background: 'transparent', width: 140 }} />
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden bg-white" style={{ border: '1px solid rgba(204,204,212,0.5)', borderRadius: 12, boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}>
        <div className="sticky top-0 z-10 grid px-5 py-2.5" style={{ gridTemplateColumns: GRID, background: '#efeff2', borderBottom: '1px solid rgba(204,204,212,0.3)' }}>
          {['문항명', '카테고리', '대상', '가중치', '상태', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#74747f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="p-5"><Skeleton className="h-40 w-full" /></div>
        ) : error ? (
          <div className="p-5"><ErrorState onRetry={reload} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState title="문항이 없어요." description="문항 추가 버튼으로 첫 역량평가 문항을 등록해 주세요." />
          </div>
        ) : (
          filtered.map((q, idx) => {
            const cc = catColor(q.categoryName, idx);
            return (
              <div key={q.id} className="grid items-center px-5 py-3.5 transition-colors hover:bg-[#f7f7f9]"
                style={{ borderBottom: '1px solid rgba(204,204,212,0.2)', gridTemplateColumns: GRID }}>
                <div className="min-w-0 pr-3">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#18181c' }}>{q.text}</div>
                  {q.hint && <div style={{ fontSize: 11.5, color: '#74747f', marginTop: 1 }}>{q.hint}</div>}
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, background: cc.bg, color: cc.color, padding: '2px 10px', borderRadius: 8 }}>
                    {q.categoryName ?? q.categoryId}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#565660' }}>{targetGroupLabel(q.targetGroup)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181c' }}>{q.weight}%</div>
                <div>
                  <button onClick={() => void toggleActive(q)} className="px-2.5 py-0.5 transition-colors"
                    style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, background: q.isActive ? '#2563eb' : '#a0a0ac', color: '#fff' }}>
                    {q.isActive ? '활성' : '비활성'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(q)} aria-label="편집"
                    className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-[#efeff2]"
                    style={{ border: '1px solid rgba(204,204,212,0.5)', borderRadius: 6 }}>
                    <Edit2 size={12} color="#7A37D8" />
                  </button>
                  <button onClick={() => setDeleteTarget(q)} aria-label="삭제"
                    className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-red-50"
                    style={{ border: '1px solid rgba(186,26,26,0.3)', borderRadius: 6 }}>
                    <Trash2 size={12} color="#e5484d" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 추가/편집 모달 */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing ? '문항 편집' : '문항 추가'} size="md"
        secondaryAction={{ label: '취소', onClick: () => setEditOpen(false) }}
        primaryAction={{ label: '저장', onClick: () => void save(), loading: busy, disabled: !draft.text.trim() }}>
        <QuestionForm draft={draft} setDraft={setDraft} categories={categories} />
      </Modal>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="문항을 삭제할까요?"
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
        primaryAction={{ label: '삭제', variant: 'danger', onClick: () => void confirmDelete() }}>
        삭제하면 해당 문항과 응답이 함께 사라질 수 있어요.
      </Modal>
    </PageContainer>
  );
}

// ── 문항 폼 — 별도 컴포넌트로 분리해 뷰 줄 수 절약 ──

import type { CompetencyCategory } from '../api';

interface FormProps {
  draft: QuestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
  categories: CompetencyCategory[];
}

function QuestionForm({ draft, setDraft, categories }: FormProps) {
  const catColors: Record<string, { bg: string; color: string }> = {
    리더십: { bg: '#7a37d8', color: '#fff' }, 협업: { bg: '#2563eb', color: '#fff' },
    전문성: { bg: '#f59e0b', color: '#fff' }, 혁신: { bg: '#7A37D8', color: '#fff' },
  };
  const fallback = { bg: '#74747f', color: '#fff' };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <TextField label="문항명" value={draft.text} onChange={(v) => setDraft((d) => ({ ...d, text: v }))} required placeholder="예) 방향 제시 및 비전 공유" />
      <TextField label="설명 (선택)" value={draft.hint} onChange={(v) => setDraft((d) => ({ ...d, hint: v }))} multiline rows={2} placeholder="문항에 대한 보조 설명" />

      {/* 카테고리 — 동적 */}
      <div className="flex flex-col gap-1.5">
        <span style={{ fontSize: 11, fontWeight: 600, color: '#565660' }}>카테고리</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const cc = catColors[cat.name] ?? fallback;
            const on = draft.categoryId === cat.id;
            return (
              <button key={cat.id} type="button" onClick={() => setDraft((d) => ({ ...d, categoryId: cat.id }))}
                style={{ fontSize: 12, fontWeight: on ? 700 : 500, background: on ? cc.bg : '#fff', color: on ? cc.color : '#565660', border: `1px solid ${on ? cc.bg : 'rgba(204,204,212,0.6)'}`, padding: '5px 14px', borderRadius: 8, cursor: 'pointer' }}>
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="가중치 (%)" type="number" value={draft.weight} onChange={(v) => setDraft((d) => ({ ...d, weight: v }))} />
        {/* 대상 — 라디오 3개 */}
        <div className="flex flex-col gap-1.5">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#565660' }}>대상</span>
          <div className="flex flex-col gap-1">
            {TARGET_GROUP_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13 }}>
                <input type="radio" name="targetGroup" value={opt.value}
                  checked={draft.targetGroup === opt.value}
                  onChange={() => setDraft((d) => ({ ...d, targetGroup: opt.value }))} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 5지선다 보기 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span style={{ fontSize: 11, fontWeight: 600, color: '#565660' }}>5지선다 보기</span>
          <span style={{ fontSize: 11, color: '#74747f' }}>1점 = 가장 낮음 · 5점 = 가장 높음</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center tabular-nums shrink-0"
                style={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, background: '#7A37D8', color: '#fff', borderRadius: 6 }}>{i + 1}</span>
              <input value={opt}
                onChange={(e) => { const v = e.target.value; setDraft((d) => { const next = [...d.options]; next[i] = v; return { ...d, options: next }; }); }}
                placeholder={DEFAULT_OPTIONS[i]}
                style={{ flex: 1, height: 36, fontSize: 13, color: '#18181c', border: '1px solid rgba(204,204,212,0.6)', borderRadius: 6, padding: '0 11px', background: '#fff', outline: 'none' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#7A37D8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,55,216,0.10)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(204,204,212,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: '#565660' }}>
        <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))} />
        활성화 (임직원 화면에 노출)
      </label>
    </div>
  );
}
