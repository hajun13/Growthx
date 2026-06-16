'use client';

/**
 * CategoryManager — 역량평가 카테고리 인라인 관리 (hr_admin 전용).
 * 목록 표시 / 신규 추가 / 삭제. 삭제 실패 시 "사용 중" 안내 토스트.
 */

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { competencyCategoryCommands } from '../hooks';
import type { CompetencyCategory } from '../api';

// Kinetic palette
const catColors: Record<string, { bg: string; color: string }> = {
  리더십: { bg: '#7a37d8', color: '#fff' },
  협업: { bg: '#2563eb', color: '#fff' },
  전문성: { bg: '#f59e0b', color: '#fff' },
  혁신: { bg: '#7A37D8', color: '#fff' },
};
const FALLBACK_COLOR = { bg: '#74747f', color: '#fff' };

interface Props {
  categories: CompetencyCategory[];
  onReload: () => void;
}

export function CategoryManager({ categories, onReload }: Props) {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

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

  const cc = (name: string) => catColors[name] ?? FALLBACK_COLOR;

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#fff', border: '1px solid rgba(204,204,212,0.5)', boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#7a37d8', marginBottom: 12 }}>
        카테고리 관리
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => {
          const c = cc(cat.name);
          return (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, padding: '4px 10px', borderRadius: 8 }}
            >
              {cat.name}
              <button
                onClick={() => void handleDelete(cat)}
                aria-label={`${cat.name} 삭제`}
                className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={11} color={c.color} />
              </button>
            </span>
          );
        })}
        {categories.length === 0 && (
          <span style={{ fontSize: 12, color: '#74747f' }}>등록된 카테고리가 없어요.</span>
        )}
      </div>
      {/* 신규 추가 인풋 */}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          placeholder="새 카테고리 이름 입력"
          style={{
            flex: 1, height: 36, fontSize: 13, color: '#18181c',
            border: '1px solid rgba(204,204,212,0.6)', borderRadius: 6,
            padding: '0 11px', background: '#fff', outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#7A37D8'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122,55,216,0.10)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(204,204,212,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button
          onClick={() => void handleAdd()}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1 disabled:opacity-50"
          style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#7a37d8', border: 'none', borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer' }}
        >
          <Plus size={13} /> 추가
        </button>
      </div>
    </div>
  );
}
