'use client';

/**
 * CategoryManager — 역량평가 카테고리 인라인 관리 (hr_admin 전용).
 * 목록 표시 / 신규 추가 / 삭제. 삭제 실패 시 "사용 중" 안내 토스트.
 */

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { competencyCategoryCommands } from '../hooks';
import type { CompetencyCategory } from '../api';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  categories: CompetencyCategory[];
  onReload: () => void;
}

export function CategoryManager({ categories, onReload }: Props) {
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
      toast.success(`카테고리 "${name}"를 추가했어요.`);
      setNewName('');
      onReload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '카테고리 추가에 실패했어요.', { duration: 8000 });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(cat: CompetencyCategory) {
    try {
      await competencyCategoryCommands.remove(cat.id);
      toast.success(`카테고리 "${cat.name}"를 삭제했어요.`);
      onReload();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '삭제에 실패했어요.';
      toast.error(
        msg.includes('400') || msg.toLowerCase().includes('in use')
          ? `"${cat.name}"은 사용 중인 카테고리라 삭제할 수 없어요.`
          : msg,
        { duration: 8000 },
      );
    }
  }

  return (
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">카테고리 관리</CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 rounded-xs bg-muted px-2.5 py-1 text-12 font-semibold text-foreground"
            >
              {cat.name}
              <Button
                variant="bare"
                size="bare"
                onClick={() => setDeleteTarget(cat)}
                aria-label={`${cat.name} 삭제`}
              >
                <X aria-hidden className="opacity-70" />
              </Button>
            </span>
          ))}
          {categories.length === 0 && (
            <span className="text-12 text-muted-foreground">등록된 카테고리가 없어요.</span>
          )}
        </div>

        {/* 신규 추가 인풋 */}
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            placeholder="새 카테고리 이름 입력"
            className="h-9 flex-1"
          />
          <Button
            size="sm"
            onClick={() => void handleAdd()}
            disabled={adding || !newName.trim()}
            loading={adding}
          >
            {!adding && <Plus aria-hidden />}
            추가
          </Button>
        </div>
      </CardContent>

      {/* 삭제 확인 모달 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="카테고리를 삭제할까요?"
        primary={{
          label: '삭제',
          destructive: true,
          onClick: () => {
            const target = deleteTarget;
            setDeleteTarget(null);
            if (target) void handleDelete(target);
          },
        }}
      >
        &ldquo;{deleteTarget?.name}&rdquo; 카테고리를 삭제해요. 문항이 사용 중인 카테고리는 삭제되지 않아요.
      </ConfirmDialog>
    </Card>
  );
}
