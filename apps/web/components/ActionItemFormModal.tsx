'use client';

// 보완 조치 등록/편집 모달 — component-spec-midterm §6. Modal(size md) + TextField + UserCombobox + Select.
// 검증(프론트 즉시, 최종 책임 백엔드): 제목·담당·마감 필수.
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { TextField } from './TextField';
import { Select } from './Select';
import { UserCombobox } from './UserCombobox';
import type { User } from '@/lib/types';

export interface ActionItemFormValue {
  title: string;
  detail?: string;
  assigneeId: string | null;
  kpiId?: string | null;
  dueDate: string; // ISO date(yyyy-mm-dd)
}

export interface ActionItemFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<ActionItemFormValue>;
  memberUsers: User[]; // UserCombobox 용 후보(담당 선택).
  kpiOptions: { value: string; label: string }[]; // 구성원 KPI(연결용).
  onSubmit: (v: ActionItemFormValue) => void | Promise<void>;
  submitting?: boolean;
  // 편집 모드면 제목 "저장"으로 표기.
  editing?: boolean;
}

const NONE = '__none__';

export function ActionItemFormModal({
  open,
  onClose,
  initial,
  memberUsers,
  kpiOptions,
  onSubmit,
  submitting,
  editing,
}: ActionItemFormModalProps) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [kpiId, setKpiId] = useState<string>(NONE);
  const [dueDate, setDueDate] = useState('');
  const [touched, setTouched] = useState(false);

  // 모달 열릴 때 initial 로 리셋.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDetail(initial?.detail ?? '');
    setAssigneeId(initial?.assigneeId ?? null);
    setKpiId(initial?.kpiId ?? NONE);
    setDueDate(initial?.dueDate ?? '');
    setTouched(false);
  }, [open, initial]);

  const titleError = touched && !title.trim() ? '제목을 입력해 주세요.' : undefined;
  const assigneeError = touched && !assigneeId ? '담당을 선택해 주세요.' : undefined;
  const dueError = touched && !dueDate ? '마감일을 입력해 주세요.' : undefined;
  const pastDue = dueDate && new Date(dueDate).getTime() < Date.now() - 86_400_000;

  const valid = !!title.trim() && !!assigneeId && !!dueDate;

  function handleSubmit() {
    setTouched(true);
    if (!valid || !assigneeId) return;
    void onSubmit({
      title: title.trim(),
      detail: detail.trim() || undefined,
      assigneeId,
      kpiId: kpiId === NONE ? null : kpiId,
      dueDate,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '보완 조치 수정' : '보완 조치 등록'}
      size="md"
      primaryAction={{
        label: editing ? '저장' : '등록',
        onClick: handleSubmit,
        loading: submitting,
        disabled: !valid,
      }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="flex flex-col gap-3.5 text-foreground">
        <TextField
          label="제목"
          required
          value={title}
          onChange={setTitle}
          placeholder="예: 주간 파이프라인 점검"
          error={titleError}
        />
        <TextField
          label="상세"
          multiline
          rows={3}
          value={detail}
          onChange={setDetail}
          placeholder="예: 잠재고객 10곳 재접촉 후 진행 상황 공유"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground">
            담당 <span className="text-destructive">*</span>
          </span>
          <UserCombobox
            users={memberUsers}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="담당 선택"
          />
          {assigneeError && (
            <p className="text-[12.5px] text-destructive">{assigneeError}</p>
          )}
        </div>
        <Select
          label="연결 KPI (선택)"
          value={kpiId}
          onChange={setKpiId}
          options={[{ value: NONE, label: '연결 안 함' }, ...kpiOptions]}
        />
        <TextField
          label="마감일"
          required
          type="text"
          value={dueDate}
          onChange={setDueDate}
          placeholder="YYYY-MM-DD"
          error={dueError}
          hint={
            !dueError && pastDue
              ? '마감일이 오늘보다 이전이에요. 의도한 날짜인지 확인해 주세요.'
              : '예: 2026-09-30'
          }
        />
      </div>
    </Modal>
  );
}
