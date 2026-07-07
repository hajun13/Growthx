'use client';

/**
 * PositionsTab — 직급 관리 탭 (positions).
 * 직급명만 입력받는 단순 UI(2026-07 확정): 역할·가시범위·직책 구분 등은
 * 백엔드 기본값(employee/self/비직책자)으로 자동 부여, 코드는 항상 자동 생성.
 * DataTable + Badge DS 컴포넌트. ~200줄 파일상한 준수.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { DesignLabel } from '@/components/DesignLabel';
import { Input } from '@/components/ui/input';
import type {
  PositionDef,
  CreatePositionRequest, UpdatePositionRequest,
} from '@/lib/types';

interface PositionModalProps {
  target: PositionDef | null;
  onSave: (body: CreatePositionRequest | UpdatePositionRequest, id?: string) => void | Promise<void>;
  onCancel: () => void;
}

function PositionModal({ target, onSave, onCancel }: PositionModalProps) {
  const isEdit = !!target;
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(target?.label ?? '');

  const valid = !!label.trim();

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (isEdit && target) {
        // 수정은 label 만 전송 — 나머지 필드는 기존값 유지.
        await onSave({ label: label.trim() } satisfies UpdatePositionRequest, target.id);
      } else {
        // 신규는 label 외 전부 백엔드 기본값과 동일한 상수(계약상 필수 필드).
        // 코드 미전송 → 서버가 label 슬러그화로 자동 생성.
        await onSave({
          label: label.trim(),
          isManagement: false,
          defaultRole: 'employee',
          defaultScope: 'self',
        } satisfies CreatePositionRequest);
      }
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay">
      <div className="w-[420px] rounded-lg border border-border bg-card shadow-elev-4">
        <div className="flex items-center justify-between border-b border-border bg-muted px-6 py-4 rounded-t-lg">
          <span className="text-[15px] font-bold text-foreground">{isEdit ? '직급 수정' : '직급 추가'}</span>
          <button onClick={onCancel} aria-label="닫기" className="text-muted-foreground hover:text-foreground"><X size={16} aria-hidden /></button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">직급명 <span className="text-danger-600">*</span></label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: CTO"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            />
            {!isEdit && (
              <p className="text-[11px] text-muted-foreground">코드는 직급명에서 자동으로 만들어져요.</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>취소</Button>
          <Button variant="primary" leftIcon={<Save size={14} aria-hidden />} loading={saving} disabled={!valid} onClick={() => void submit()}>저장</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface Props {
  positions: PositionDef[];
  loading: boolean;
  onEdit: (p: PositionDef) => void;
  onDelete: (p: PositionDef) => void;
  posModalOpen: boolean;
  posEditTarget: PositionDef | null;
  onSavePosition: (body: CreatePositionRequest | UpdatePositionRequest, id?: string) => void | Promise<void>;
  onCancelPositionModal: () => void;
}

export function PositionsTab({ positions, loading, onEdit, onDelete, posModalOpen, posEditTarget, onSavePosition, onCancelPositionModal }: Props) {
  const sorted = [...positions].sort((a, b) => a.sortOrder - b.sortOrder);

  const columns: DataTableColumn<PositionDef>[] = [
    {
      key: 'label',
      header: '직급명',
      render: (p) => (
        <div className="flex items-center gap-2">
          <DesignLabel tone={p.isActive ? 'gray' : 'darkgray'}>{p.label}</DesignLabel>
          {p.isSystem && <Badge variant="secondary">기본</Badge>}
          {!p.isActive && <DesignLabel tone="darkgray">비활성</DesignLabel>}
        </div>
      ),
    },
    {
      key: 'code',
      header: '코드',
      width: '140px',
      render: (p) => <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (p) => (
        <div className="flex items-center gap-2">
          <button onClick={() => onEdit(p)} title="수정" aria-label="직급 수정" className="gx-icon-button text-primary transition-colors hover:bg-muted"><Edit2 size={13} aria-hidden /></button>
          <button onClick={() => onDelete(p)} title="삭제" aria-label="직급 삭제" className="gx-icon-button text-danger-600 transition-colors hover:bg-muted"><Trash2 size={13} aria-hidden /></button>
        </div>
      ),
    },
  ];

  if (loading && positions.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>;
  }

  return (
    <>
      <div className="gx-panel overflow-hidden">
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(p) => p.id}
          stickyHeader
          empty={<div className="py-12 text-center text-sm text-muted-foreground">직급이 아직 없어요. 오른쪽 위 "직급 추가"로 시작하세요.</div>}
        />
      </div>
      {posModalOpen && (
        <PositionModal target={posEditTarget} onSave={onSavePosition} onCancel={onCancelPositionModal} />
      )}
    </>
  );
}
