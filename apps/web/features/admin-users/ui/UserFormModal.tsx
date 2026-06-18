'use client';

/**
 * UserFormModal — 사용자 추가·수정 폼 모달.
 * Modal DS 컴포넌트 사용. raw <button>·<input>·<select> → Button / Select(shadcn) / Input(shadcn).
 */

import { useState } from 'react';
import { Save } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { Position, PositionDef } from '@/lib/types';

export interface FormState {
  name: string;
  email: string;
  groupId: string;
  divisionId: string;
  teamId: string;
  position: Position | '';
  hireDate: string;
  birthDate: string;
}

interface OrgOptions {
  groups: { id: string; name: string }[];
  divisions: { id: string; name: string; groupId: string }[];
  teams: { id: string; name: string; divisionId: string }[];
}

interface Props {
  title: string;
  initial: FormState;
  org: OrgOptions;
  positions: PositionDef[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}

function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="text-danger-600 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function UserFormModal({ title, initial, org, positions, onSave, onCancel, saving }: Props) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.groupId !== undefined) { next.divisionId = ''; next.teamId = ''; }
      if (patch.divisionId !== undefined) { next.teamId = ''; }
      return next;
    });
  };

  const divisionList = form.groupId ? org.divisions.filter((d) => d.groupId === form.groupId) : [];
  const teamList = form.divisionId
    ? org.teams.filter((t) => t.divisionId === form.divisionId)
    : form.groupId ? org.teams.filter((t) => t.divisionId === form.groupId) : [];

  const valid = !!(form.name && form.email && form.position);
  const positionOptions = [...positions].sort((a, b) => a.sortOrder - b.sortOrder);
  const today = new Date().toISOString().slice(0, 10);
  const ageVal = ageFromBirthDate(form.birthDate);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay">
      <div className="w-[480px] max-h-[90vh] overflow-auto rounded-lg border border-border bg-card shadow-elev-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border bg-muted px-6 py-4 rounded-t-xl">
          <span className="text-[15px] font-bold text-foreground">{title}</span>
          <button onClick={onCancel} aria-label="닫기" className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* 폼 필드 */}
        <div className="flex flex-col gap-4 p-6">
          <Field label="이름" required>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="홍길동" />
          </Field>
          <Field label="이메일" required>
            <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="hong@energyx.co.kr" />
          </Field>
          <Field label="그룹" hint="임원·외부 인사는 비워둘 수 있어요.">
            <Select value={form.groupId} onValueChange={(v) => set({ groupId: v === '__none__' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="소속 없음" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">소속 없음</SelectItem>
                {org.groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="본부">
            <Select value={form.divisionId} onValueChange={(v) => set({ divisionId: v === '__none__' ? '' : v })} disabled={!form.groupId}>
              <SelectTrigger><SelectValue placeholder="본부 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">본부 선택</SelectItem>
                {divisionList.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="팀" hint={(!form.divisionId && form.groupId && teamList.length > 0) ? '본부를 비워두면 그룹 직속 팀으로 배정돼요.' : undefined}>
            <Select value={form.teamId} onValueChange={(v) => set({ teamId: v === '__none__' ? '' : v })} disabled={!form.divisionId && !form.groupId}>
              <SelectTrigger><SelectValue placeholder="팀 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">팀 선택</SelectItem>
                {teamList.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="직급" required>
            <Select value={form.position} onValueChange={(v) => set({ position: v as Position })}>
              <SelectTrigger><SelectValue placeholder="직급 선택" /></SelectTrigger>
              <SelectContent>
                {positionOptions.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="입사일" hint="입사일은 평가 대상 기준(입사일 필터)에 사용됩니다.">
            <Input type="date" value={form.hireDate} onChange={(e) => set({ hireDate: e.target.value })} max={today} />
          </Field>
          <Field label="생년월일" hint={ageVal !== null ? `만 ${ageVal}세 — 나이는 생년월일로 자동 계산돼요.` : '나이는 생년월일로 자동 계산돼요.'}>
            <Input type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} max={today} />
          </Field>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>취소</Button>
          <Button
            variant="primary"
            leftIcon={<Save size={14} aria-hidden />}
            loading={saving}
            disabled={!valid}
            onClick={() => valid && !saving && onSave(form)}
          >
            저장
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
