'use client';

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useCompetencyQuestions,
  competencyQuestionCommands,
} from '@/hooks/useCompetency';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { TextField } from '@/components/TextField';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import type { CompetencyQuestion } from '@/lib/types';

// 카테고리 색상(디자인 파일 catColors).
const CATEGORIES = ['리더십', '협업', '전문성', '혁신'] as const;
type Category = (typeof CATEGORIES)[number];
const catColors: Record<string, { bg: string; color: string }> = {
  리더십: { bg: '#3182f6', color: '#fff' },
  협업: { bg: '#03b26c', color: '#fff' },
  전문성: { bg: '#f57800', color: '#fff' },
  혁신: { bg: '#9333ea', color: '#fff' },
};
// 적용 직급 허용 값 — SSOT: apps/api .../competency/dto/competency.dto.ts (COMPETENCY_APPLIED_LEVELS).
// web 앱은 apps/api에서 import 불가하므로 리터럴을 미러링한다. 값이 바뀌면 양쪽 동기화 필수.
// '차장'은 본 프로젝트 직급 체계(Position enum: 팀장/본부장...)에 없어 폐기됨.
const LEVELS = ['전 직급', '팀장 이상', '본부장 이상'] as const;

const GRID = '1fr 100px 100px 80px 80px 80px';

interface QuestionDraft {
  text: string;
  hint: string;
  category: Category;
  weight: string;
  appliedLevel: string;
  isActive: boolean;
}

const emptyDraft: QuestionDraft = {
  text: '',
  hint: '',
  category: '전문성',
  weight: '0',
  appliedLevel: '전 직급',
  isActive: true,
};

export default function CompetencyItemsPage() {
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

  const { data, loading, error, reload } = useCompetencyQuestions(cycleId, {
    enabled: allowed,
  });
  const questions = useMemo(() => data?.data ?? [], [data]);

  const [catFilter, setCatFilter] = useState<'전체' | Category>('전체');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          (catFilter === '전체' || q.category === catFilter) &&
          (!search || q.text.includes(search)),
      ),
    [questions, catFilter, search],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CompetencyQuestion | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompetencyQuestion | null>(
    null,
  );

  const MAX_QUESTIONS = 10;
  const atMax = questions.length >= MAX_QUESTIONS;

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setEditOpen(true);
  }

  function openEdit(q: CompetencyQuestion) {
    setEditing(q);
    setDraft({
      text: q.text,
      hint: q.hint ?? '',
      category: (CATEGORIES.includes(q.category as Category)
        ? q.category
        : '전문성') as Category,
      weight: String(q.weight),
      appliedLevel: q.appliedLevel,
      isActive: q.isActive,
    });
    setEditOpen(true);
  }

  async function save() {
    if (!cycleId) return;
    if (!draft.text.trim()) {
      toast.show({ variant: 'danger', message: '문항명을 입력해 주세요.' });
      return;
    }
    setBusy(true);
    try {
      const weight = Number(draft.weight) || 0;
      if (editing) {
        await competencyQuestionCommands.update(editing.id, {
          text: draft.text.trim(),
          hint: draft.hint.trim() || undefined,
          category: draft.category,
          weight,
          appliedLevel: draft.appliedLevel,
          isActive: draft.isActive,
        });
      } else {
        await competencyQuestionCommands.create({
          cycleId,
          order: (questions.at(-1)?.order ?? 0) + 1,
          text: draft.text.trim(),
          hint: draft.hint.trim() || undefined,
          category: draft.category,
          weight,
          appliedLevel: draft.appliedLevel,
          isActive: draft.isActive,
        });
      }
      toast.show({ variant: 'success', message: '문항을 저장했어요.' });
      setEditOpen(false);
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

  async function toggleActive(q: CompetencyQuestion) {
    try {
      await competencyQuestionCommands.update(q.id, { isActive: !q.isActive });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '변경에 실패했어요.',
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await competencyQuestionCommands.remove(deleteTarget.id);
      toast.show({ variant: 'success', message: '문항을 삭제했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  if (!allowed) {
    return <Forbidden message="역량평가 문항 관리는 HR만 접근할 수 있어요." />;
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const activeCount = questions.filter((q) => q.isActive).length;
  const catCount = new Set(questions.map((q) => q.category)).size;
  const tabs: Array<'전체' | Category> = ['전체', ...CATEGORIES];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#191f28' }}>
            역량평가 문항
          </h1>
          <p style={{ fontSize: 13, color: '#6b7684', marginTop: 2 }}>
            역량평가에 사용되는 문항을 관리합니다. (연봉 미반영 · 참고용)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cycles.length > 1 && (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border border-border bg-white px-2 py-1.5 outline-none"
              style={{ fontSize: 12, color: '#4e5968' }}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#8b95a1' }}>
            {questions.length} / {MAX_QUESTIONS}
          </span>
          <button
            onClick={openCreate}
            disabled={atMax}
            className="flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 600, background: '#3182f6' }}
          >
            <Plus size={14} /> 문항 추가
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: '전체 문항', value: questions.length },
          { label: '활성 문항', value: activeCount },
          { label: '비활성', value: questions.length - activeCount },
          { label: '카테고리', value: `${catCount}개` },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-border bg-white px-4 py-3"
          >
            <div style={{ fontSize: 11, color: '#8b95a1' }}>{s.label}</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#191f28',
                marginTop: 2,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden border border-border bg-white">
          {tabs.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className="px-3 py-2"
              style={{
                fontSize: 12,
                background: catFilter === c ? '#3182f6' : '#fff',
                color: catFilter === c ? '#fff' : '#4e5968',
                fontWeight: 500,
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-border bg-white px-3 py-2">
          <Search size={13} color="#8b95a1" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="문항 검색..."
            className="outline-none"
            style={{ fontSize: 12, background: 'transparent', width: 140 }}
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden border border-border bg-white">
        <div
          className="grid border-b border-border px-5 py-2.5"
          style={{ gridTemplateColumns: GRID, background: '#f9fafb' }}
        >
          {['문항명', '카테고리', '적용 직급', '가중치', '상태', ''].map((h, i) => (
            <div
              key={i}
              style={{ fontSize: 11, fontWeight: 600, color: '#6b7684' }}
            >
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-5">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState onRetry={reload} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="문항이 없어요."
              description="문항 추가 버튼으로 첫 역량평가 문항을 등록해 주세요."
            />
          </div>
        ) : (
          filtered.map((q) => {
            const cc = catColors[q.category] ?? {
              bg: '#8b95a1',
              color: '#fff',
            };
            return (
              <div
                key={q.id}
                className="grid items-center border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-muted/20"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className="min-w-0 pr-3">
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: '#191f28' }}
                  >
                    {q.text}
                  </div>
                  {q.hint && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#8b95a1',
                        marginTop: 1,
                      }}
                    >
                      {q.hint}
                    </div>
                  )}
                </div>
                <div>
                  <span
                    className="px-2 py-0.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: cc.bg,
                      color: cc.color,
                    }}
                  >
                    {q.category}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7684' }}>
                  {q.appliedLevel}
                </div>
                <div
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#191f28' }}
                >
                  {q.weight}%
                </div>
                <div>
                  <button
                    onClick={() => void toggleActive(q)}
                    className="px-2.5 py-0.5 transition-colors"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 999,
                      background: q.isActive ? '#03b26c' : '#8b95a1',
                      color: '#fff',
                    }}
                  >
                    {q.isActive ? '활성' : '비활성'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(q)}
                    aria-label="편집"
                    className="flex h-7 w-7 items-center justify-center border border-border transition-colors hover:bg-muted"
                  >
                    <Edit2 size={12} color="#4e5968" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(q)}
                    aria-label="삭제"
                    className="flex h-7 w-7 items-center justify-center border border-red-200 transition-colors hover:bg-red-50"
                  >
                    <Trash2 size={12} color="#f04452" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 추가/편집 모달 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? '문항 편집' : '문항 추가'}
        size="md"
        secondaryAction={{ label: '취소', onClick: () => setEditOpen(false) }}
        primaryAction={{
          label: '저장',
          onClick: () => void save(),
          loading: busy,
          disabled: !draft.text.trim(),
        }}
      >
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
          <div className="flex flex-col gap-1.5">
            <span style={{ fontSize: 13, fontWeight: 500, color: '#4e5968' }}>
              카테고리
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const cc = catColors[c];
                const on = draft.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, category: c }))}
                    className="border px-3 py-1.5 transition-colors"
                    style={{
                      fontSize: 12,
                      fontWeight: on ? 600 : 400,
                      background: on ? cc.bg : '#fff',
                      color: on ? cc.color : '#4e5968',
                      borderColor: on ? cc.bg : '#e5e8eb',
                    }}
                  >
                    {c}
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
            <div className="flex flex-col gap-1.5">
              <span style={{ fontSize: 13, fontWeight: 500, color: '#4e5968' }}>
                적용 직급
              </span>
              <select
                value={draft.appliedLevel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, appliedLevel: e.target.value }))
                }
                className="border border-border bg-white px-3 py-2 outline-none"
                style={{ fontSize: 13, color: '#191f28', height: 40 }}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label
            className="flex cursor-pointer items-center gap-2"
            style={{ fontSize: 13, color: '#4e5968' }}
          >
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) =>
                setDraft((d) => ({ ...d, isActive: e.target.checked }))
              }
            />
            활성화 (임직원 화면에 노출)
          </label>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="문항을 삭제할까요?"
        secondaryAction={{
          label: '취소',
          onClick: () => setDeleteTarget(null),
        }}
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          onClick: () => void confirmDelete(),
        }}
      >
        삭제하면 해당 문항과 응답이 함께 사라질 수 있어요.
      </Modal>
    </div>
  );
}
