'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import {
  useCompetencyQuestions,
  competencyQuestionCommands,
} from '@/hooks/useCompetency';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Modal } from '@/components/Modal';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import type { CompetencyQuestion } from '@/lib/types';

interface QuestionDraft {
  order: string;
  text: string;
  hint: string;
}

export default function CompetencyAdminPage() {
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
  const questions = data?.data ?? [];

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CompetencyQuestion | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>({
    order: '',
    text: '',
    hint: '',
  });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompetencyQuestion | null>(
    null,
  );

  useEffect(() => {
    if (editOpen) return;
    setEditing(null);
  }, [editOpen]);

  function openCreate() {
    setEditing(null);
    setDraft({
      order: String((questions.at(-1)?.order ?? 0) + 1),
      text: '',
      hint: '',
    });
    setEditOpen(true);
  }

  function openEdit(q: CompetencyQuestion) {
    setEditing(q);
    setDraft({ order: String(q.order), text: q.text, hint: q.hint ?? '' });
    setEditOpen(true);
  }

  async function save() {
    if (!cycleId) return;
    if (!draft.text.trim()) {
      toast.show({ variant: 'danger', message: '질문 내용을 입력해 주세요.' });
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await competencyQuestionCommands.update(editing.id, {
          order: Number(draft.order) || editing.order,
          text: draft.text.trim(),
          hint: draft.hint.trim() || undefined,
        });
      } else {
        await competencyQuestionCommands.create({
          cycleId,
          order: Number(draft.order) || questions.length + 1,
          text: draft.text.trim(),
          hint: draft.hint.trim() || undefined,
          isActive: true,
        });
      }
      toast.show({ variant: 'success', message: '질문을 저장했어요.' });
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
      toast.show({ variant: 'success', message: '질문을 삭제했어요.' });
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

  const MAX_QUESTIONS = 10;
  const atMaxQuestions = questions.length >= MAX_QUESTIONS;

  if (!allowed) {
    return <Forbidden message="역량평가 문항 관리는 HR만 접근할 수 있어요." />;
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="역량평가 문항 관리"
        subtitle="역량 평가는 연 1회(12월) 진행되며, 연봉 산정에는 반영되지 않아요."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {questions.length} / {MAX_QUESTIONS}개
            </span>
            <div className="relative group/add">
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={openCreate}
                disabled={atMaxQuestions}
              >
                질문 추가
              </Button>
              {atMaxQuestions && (
                <div className="pointer-events-none absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover/add:opacity-100">
                  문항은 최대 10개까지 등록할 수 있어요.
                </div>
              )}
            </div>
          </div>
        }
      />

      <InfoBanner tone="info" title="역량평가 안내">
        이 문항은 임직원이 S/A/B/C/D로 응답하는 역량 평가용이에요. 활성화된
        질문만 임직원 화면에 노출돼요. 순서는 순서 번호로 정렬돼요.
      </InfoBanner>

      <Card title={`질문 목록 (${questions.length} / ${MAX_QUESTIONS}개)`}>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : questions.length === 0 ? (
          <EmptyState
            title="아직 질문이 없어요."
            description="질문 추가 버튼으로 첫 역량평가 문항을 등록해 주세요."
            action={
              <Button onClick={openCreate} disabled={atMaxQuestions}>
                질문 추가
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {questions.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold tabular-nums text-foreground">
                    {q.order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base text-foreground">{q.text}</p>
                    {q.hint && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {q.hint}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={q.isActive}
                      onCheckedChange={() => void toggleActive(q)}
                      aria-label={`${q.text} 활성화`}
                    />
                    {q.isActive ? '활성' : '비활성'}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(q)}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setDeleteTarget(q)}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? '질문 수정' : '질문 추가'}
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
            label="순서 번호"
            type="number"
            value={draft.order}
            onChange={(v) => setDraft((d) => ({ ...d, order: v }))}
          />
          <TextField
            label="질문 내용"
            value={draft.text}
            onChange={(v) => setDraft((d) => ({ ...d, text: v }))}
            multiline
            rows={3}
            required
            placeholder="예) 동료와 적극적으로 협업했나요?"
          />
          <TextField
            label="힌트 (선택)"
            value={draft.hint}
            onChange={(v) => setDraft((d) => ({ ...d, hint: v }))}
            placeholder="응답자에게 보여줄 보조 설명"
          />
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="질문을 삭제할까요?"
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          onClick: () => void confirmDelete(),
        }}
      >
        삭제하면 해당 질문과 응답이 함께 사라질 수 있어요.
      </Modal>
    </div>
  );
}
