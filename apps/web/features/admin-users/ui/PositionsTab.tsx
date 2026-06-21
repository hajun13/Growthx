'use client';

/**
 * PositionsTab — 직급 관리 탭 (positions).
 * DataTable + Badge DS 컴포넌트. raw 직급 폼 모달 → PositionModal 유지(동작 불변),
 * 인라인 style / hex → Tailwind 시맨틱 클래스.
 * ~200줄 파일상한 준수.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { DesignLabel } from '@/components/DesignLabel';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  roleLabel, SCOPE_LABEL, jobLevelLabel,
} from '@/lib/ui';
import type {
  PositionDef, Role, VisibilityScope, JobLevel,
  CreatePositionRequest, UpdatePositionRequest,
} from '@/lib/types';

const ROLE_OPTIONS: Role[] = ['hr_admin', 'division_head', 'team_lead', 'employee'];
const SCOPE_OPTIONS: VisibilityScope[] = ['self', 'team', 'division', 'group', 'company'];
const JOBLEVEL_OPTIONS: JobLevel[] = ['division_head', 'team_lead', 'senior_plus', 'senior_minus'];

interface PosFormState {
  label: string;
  code: string;
  isManagement: boolean;
  defaultRole: Role;
  defaultScope: VisibilityScope;
  defaultJobLevel: JobLevel | '';
  sortOrder: string;
}

interface PositionModalProps {
  target: PositionDef | null;
  onSave: (body: CreatePositionRequest | UpdatePositionRequest, id?: string) => void | Promise<void>;
  onCancel: () => void;
}

function PositionModal({ target, onSave, onCancel }: PositionModalProps) {
  const isEdit = !!target;
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PosFormState>(() => ({
    label: target?.label ?? '',
    code: target?.code ?? '',
    isManagement: target?.isManagement ?? false,
    defaultRole: target?.defaultRole ?? 'employee',
    defaultScope: target?.defaultScope ?? 'self',
    defaultJobLevel: target?.defaultJobLevel ?? '',
    sortOrder: target?.sortOrder !== undefined ? String(target.sortOrder) : '',
  }));

  const set = (patch: Partial<PosFormState>) => setForm((p) => ({ ...p, ...patch }));
  const valid = !!form.label.trim();

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const jobLevel: JobLevel | null = form.defaultJobLevel || null;
    const sortOrder = form.sortOrder.trim() ? Number(form.sortOrder) : undefined;
    try {
      if (isEdit && target) {
        await onSave({ label: form.label.trim(), isManagement: form.isManagement, defaultRole: form.defaultRole, defaultScope: form.defaultScope, defaultJobLevel: jobLevel, ...(sortOrder !== undefined ? { sortOrder } : {}) } as UpdatePositionRequest, target.id);
      } else {
        await onSave({ label: form.label.trim(), isManagement: form.isManagement, defaultRole: form.defaultRole, defaultScope: form.defaultScope, defaultJobLevel: jobLevel, ...(sortOrder !== undefined ? { sortOrder } : {}), ...(form.code.trim() ? { code: form.code.trim() } : {}) } as CreatePositionRequest);
      }
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay">
      <div className="w-[460px] max-h-[90vh] overflow-auto rounded-none border border-border bg-card shadow-none">
        <div className="flex items-center justify-between border-b border-border bg-muted px-6 py-4 rounded-t-xl">
          <span className="text-[15px] font-bold text-foreground">{isEdit ? '직급 수정' : '직급 추가'}</span>
          <button onClick={onCancel} aria-label="닫기" className="text-muted-foreground hover:text-foreground"><X size={16} aria-hidden /></button>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">직급명 <span className="text-danger-600">*</span></label>
            <Input value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="예: CTO" />
          </div>
          {/* 경영진 토글 — Switch 없으므로 버튼 패턴 사용 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.isManagement}
              onClick={() => set({ isManagement: !form.isManagement })}
              className={`relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${form.isManagement ? 'bg-primary' : 'bg-neutral-300'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-none transition-transform ${form.isManagement ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-foreground">
              경영진(직책자) — {form.isManagement ? '직책자(경영진·본부장·팀장)' : '일반 직급'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">기본 역할</label>
              <Select value={form.defaultRole} onValueChange={(v: Role) => set({ defaultRole: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">기본 가시범위</label>
              <Select value={form.defaultScope} onValueChange={(v: VisibilityScope) => set({ defaultScope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">기본 직급레벨</label>
              <Select value={form.defaultJobLevel || '__none__'} onValueChange={(v: string) => set({ defaultJobLevel: v === '__none__' ? '' : v as JobLevel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  {JOBLEVEL_OPTIONS.map((j) => <SelectItem key={j} value={j}>{jobLevelLabel[j]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">정렬값</label>
              <Input value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value.replace(/[^0-9]/g, '') })} placeholder="낮을수록 상위" inputMode="numeric" />
            </div>
          </div>
          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">코드</label>
              <Input value={form.code} readOnly className="opacity-60 bg-muted" />
            </div>
          ) : showCode ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">코드(고급)</label>
              <Input value={form.code} onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder="비우면 자동 생성 (예: cto)" />
              <p className="text-[11px] text-muted-foreground">영문 소문자·숫자·밑줄만. 비우면 직급명에서 자동 생성돼요.</p>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCode(true)} className="text-left text-[11.5px] text-muted-foreground hover:text-foreground transition-colors">+ 코드 직접 입력(고급)</button>
          )}
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
      key: 'code',
      header: '코드',
      width: '120px',
      render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span>,
    },
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
    { key: 'sortOrder', header: '정렬', width: '70px', render: (p) => <span className="text-sm text-muted-foreground">{p.sortOrder}</span> },
    {
      key: 'isManagement',
      header: '경영진',
      width: '80px',
      render: (p) => <span className={`text-xs font-semibold ${p.isManagement ? 'text-primary' : 'text-muted-foreground'}`}>{p.isManagement ? '직책자' : '일반'}</span>,
    },
    { key: 'defaultRole', header: '기본 역할', render: (p) => <span className="text-sm text-muted-foreground">{roleLabel[p.defaultRole]}</span> },
    { key: 'defaultScope', header: '기본 가시범위', render: (p) => <span className="text-sm text-muted-foreground">{SCOPE_LABEL[p.defaultScope]}</span> },
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
