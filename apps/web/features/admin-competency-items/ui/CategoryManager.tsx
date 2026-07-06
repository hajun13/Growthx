'use client';

/**
 * CategoryManager — 역량평가 카테고리 인라인 관리 (hr_admin 전용).
 * 목록 표시 / 신규 추가 / 삭제. 삭제 실패 시 "사용 중" 안내 토스트.
 */

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { competencyCategoryCommands } from '../hooks';
import type { CompetencyCategory } from '../api';

interface Props {
  categories: CompetencyCategory[];
  onReload: () => void;
}

export function CategoryManager({ categories, onReload }: Props) {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  // 삭제 확인 모달 대상(문항 삭제와 동일 패턴 — 즉시 실행 방지).
  const [deleteTarget, setDeleteTarget] = useState<CompetencyCategory | null>(null);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await competencyCategoryCommands.create({ name, order: categories.length, isActive: true });
      toast.show({ variant: 'success', message: `카테고리 "${name}"를 추가했어요.` });
      setNewName('');
      onReload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '카테고리 추가에 실패했어요.',
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(cat: CompetencyCategory) {
    try {
      await competencyCategoryCommands.remove(cat.id);
      toast.show({ variant: 'success', message: `카테고리 "${cat.name}"를 삭제했어요.` });
      onReload();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '삭제에 실패했어요.';
      toast.show({
        variant: 'danger',
        message: msg.includes('400') || msg.toLowerCase().includes('in use')
          ? `"${cat.name}"은 사용 중인 카테고리라 삭제할 수 없어요.`
          : msg,
      });
    }
  }

  return (
    <Card title="카테고리 관리">
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <span
            key={cat.id}
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-muted px-2.5 py-1 text-[12px] font-semibold text-foreground"
          >
            {cat.name}
            <button
              onClick={() => setDeleteTarget(cat)}
              aria-label={`${cat.name} 삭제`}
              className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
              type="button"
            >
              <X size={11} aria-hidden />
            </button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="text-[12px] text-muted-foreground">등록된 카테고리가 없어요.</span>
        )}
      </div>

      {/* 신규 추가 인풋 */}
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          placeholder="새 카테고리 이름 입력"
          className="flex-1 h-9"
        />
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={13} aria-hidden />}
          onClick={() => void handleAdd()}
          disabled={adding || !newName.trim()}
          loading={adding}
        >
          추가
        </Button>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="카테고리를 삭제할까요?"
        secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          onClick: () => {
            const target = deleteTarget;
            setDeleteTarget(null);
            if (target) void handleDelete(target);
          },
        }}
      >
        &ldquo;{deleteTarget?.name}&rdquo; 카테고리를 삭제해요. 문항이 사용 중인 카테고리는 삭제되지 않아요.
      </Modal>
    </Card>
  );
}
