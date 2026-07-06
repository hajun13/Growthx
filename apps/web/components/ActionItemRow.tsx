'use client';

// 보완 조치 행 — component-spec-midterm §5. C-1(본인)·C-2(부서장)·FIN(읽기전용) 공용.
// 상태 전이는 계약 §4 의 assertTransition 규칙을 프론트에서도 미리 막는다(허용 전이만 클릭 가능).
import { useState } from 'react';
import { Pencil, Link2, Calendar } from 'lucide-react';
import { actionItemStatusLabel } from '@/lib/ui';
import { ActionItemStatusBadge } from './ActionItemStatusBadge';
import { TextField } from './TextField';
import { Button } from './Button';
import type { ActionItem, ActionItemStatus } from '@/lib/types';

export interface ActionItemRowProps {
  item: ActionItem;
  // 'assignee'=담당 본인(planned↔in_progress↔done, canceled 불가),
  // 'owner'=부서장(전체 상태·편집), 'readonly'=조회만(FIN 패널·타인).
  mode: 'assignee' | 'owner' | 'readonly';
  onChangeStatus?: (id: string, next: ActionItemStatus, note?: string) => void;
  onEdit?: (item: ActionItem) => void;
  busy?: boolean; // 상태 변경 진행 중(토글 비활성).
}

// 계약 §4 상태 전이 표 — 허용 전이만 true.
const TRANSITIONS: Record<ActionItemStatus, ActionItemStatus[]> = {
  planned: ['in_progress', 'done', 'canceled'],
  in_progress: ['done', 'planned', 'canceled'],
  done: ['in_progress'],
  canceled: ['planned'],
};
// 토글에 노출할 상태 순서.
const STATUS_ORDER: ActionItemStatus[] = ['planned', 'in_progress', 'done', 'canceled'];

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ActionItemRow({
  item,
  mode,
  onChangeStatus,
  onEdit,
  busy,
}: ActionItemRowProps) {
  const readonly = mode === 'readonly';
  const [completionNote, setCompletionNote] = useState(item.completionNote ?? '');
  // 'done' 으로 전이하려는 순간 완료 메모 입력을 노출.
  const [pendingDone, setPendingDone] = useState(false);

  const dueText = fmtDate(item.dueDate);
  const completedText = fmtDate(item.completedAt);
  const overdue =
    !!item.dueDate &&
    item.status !== 'done' &&
    item.status !== 'canceled' &&
    new Date(item.dueDate).getTime() < Date.now();

  // 어떤 다음 상태로 갈 수 있는지(현재 상태에서 허용 + 모드 권한).
  function canGoTo(next: ActionItemStatus): boolean {
    if (next === item.status) return false;
    if (!TRANSITIONS[item.status].includes(next)) return false;
    // assignee 는 canceled 불가(부서장만).
    if (mode === 'assignee' && next === 'canceled') return false;
    // assignee 는 canceled 에서 planned 복원도 부서장 권한 → 막음.
    if (mode === 'assignee' && item.status === 'canceled') return false;
    return true;
  }

  function handleClick(next: ActionItemStatus) {
    if (next === 'done') {
      setPendingDone(true);
      return;
    }
    setPendingDone(false);
    onChangeStatus?.(item.id, next);
  }

  function confirmDone() {
    onChangeStatus?.(item.id, 'done', completionNote.trim() || undefined);
    setPendingDone(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      {/* 헤더 라인: 상태 배지 + 제목 + 메타 */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          <ActionItemStatusBadge status={item.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className={`text-[13.5px] font-bold ${item.status === 'canceled' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {item.title}
            </h4>
            {dueText && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11.5px] ${overdue ? 'text-danger-600' : 'text-muted-foreground'}`}
                aria-label={overdue ? `마감 ${dueText} 지남` : `마감 ${dueText}`}
              >
                <Calendar size={11} aria-hidden /> 마감 {dueText}
                {overdue && <span className="font-bold"> 지남</span>}
              </span>
            )}
            {item.kpiTitle && (
              <span
                className="inline-flex items-center gap-0.5 rounded-sm bg-muted px-1.5 py-px text-[10.5px] font-medium text-muted-foreground"
              >
                <Link2 size={10} aria-hidden /> 연결: {item.kpiTitle}
              </span>
            )}
            {completedText && item.status === 'done' && (
              <span className="text-[11.5px] text-success-700">완료 {completedText}</span>
            )}
          </div>
          {item.detail && (
            <p
              className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/80"
            >
              {item.detail}
            </p>
          )}
          {/* readonly + 취소 사유 / 완료 메모 */}
          {readonly && item.completionNote && (
            <p
              className="mt-1 text-[11.5px] text-muted-foreground"
            >
              {item.status === 'canceled' ? '사유' : '완료 메모'}: {item.completionNote}
            </p>
          )}
          {item.assigneeName && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              담당 {item.assigneeName}
              {item.createdByName && ` · 등록 ${item.createdByName}`}
            </p>
          )}
        </div>
        {mode === 'owner' && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="보완 조치 편집"
            title="편집"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {/* 상태 토글(읽기전용 아닐 때) */}
      {!readonly && (
        <div className="mt-2.5">
          <div
            role="radiogroup"
            aria-label="보완 조치 상태 변경"
            className="inline-flex overflow-hidden rounded-md border border-border"
          >
            {STATUS_ORDER.map((s, i) => {
              const active = s === item.status;
              const allowed = active || canGoTo(s);
              const disabledForAssignee = mode === 'assignee' && s === 'canceled';
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!allowed || busy}
                  onClick={() => allowed && !active && handleClick(s)}
                  title={
                    disabledForAssignee
                      ? '취소는 부서장이 처리해요'
                      : !allowed && !active
                        ? '지금 단계에서 바꿀 수 없는 상태예요'
                        : undefined
                  }
                  className={`border-l border-border px-3 py-1.5 text-[11.5px] first:border-l-0 ${
                    active
                      ? 'bg-muted font-bold text-primary'
                      : allowed
                        ? 'bg-card font-medium text-foreground hover:bg-muted/60'
                        : 'bg-muted font-medium text-muted-foreground/60'
                  } ${allowed && !active && !busy ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {actionItemStatusLabel[s]}
                </button>
              );
            })}
          </div>

          {/* done 전이 시 완료 메모 입력 */}
          {pendingDone && (
            <div className="mt-2 flex flex-col gap-2" style={{ maxWidth: 420 }}>
              <TextField
                label="완료 메모"
                hideLabel
                multiline
                rows={2}
                value={completionNote}
                onChange={setCompletionNote}
                placeholder="완료 메모(선택)를 적어 주세요."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" loading={busy} onClick={confirmDone}>
                  완료 처리
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPendingDone(false)}>
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
