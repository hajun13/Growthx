'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TextFieldRow } from '@/components/PersonEditFields';
import type { OrgChartNode, OrgNodeType } from '@/lib/types';

export type OrgNodeModalMode = 'create' | 'rename';

export interface OrgNodeModalProps {
  open: boolean;
  mode: OrgNodeModalMode;
  // create 모드: 어떤 노드 하위에 추가할지 (null=루트 그룹)
  parentNode?: OrgChartNode | null;
  // rename 모드: 이름 변경할 노드
  targetNode?: OrgChartNode | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    type: OrgNodeType;
    parentId?: string;
  }) => Promise<void>;
}

const TYPE_LABEL: Record<OrgNodeType, string> = {
  group: '그룹',
  division: '본부',
  team: '팀',
};

// 부모 노드 기준으로 만들 수 있는 자식 타입 후보.
//  - 부모 없음 → group
//  - 부모 group → division 또는 team(그룹 직속 팀 허용)
//  - 부모 division → team
function childTypeOptions(parent?: OrgChartNode | null): OrgNodeType[] {
  if (!parent) return ['group'];
  if (parent.type === 'group') return ['division', 'team'];
  return ['team'];
}

export function OrgNodeModal({
  open,
  mode,
  parentNode,
  targetNode,
  onClose,
  onSubmit,
}: OrgNodeModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const typeOptions = childTypeOptions(parentNode);
  const [newType, setNewType] = useState<OrgNodeType>(typeOptions[0]);

  // 모달이 열릴 때마다 입력값 초기화(rename 은 현재 이름 프리필).
  useEffect(() => {
    if (!open) return;
    setName(mode === 'rename' ? (targetNode?.name ?? '') : '');
    setNewType(childTypeOptions(parentNode)[0]);
    setError(undefined);
    setSaving(false);
  }, [open, mode, targetNode, parentNode]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(
        mode === 'rename'
          ? '새 이름을 입력해 주세요.'
          : `${TYPE_LABEL[newType]} 이름을 입력해 주세요.`,
      );
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        await onSubmit({
          name: trimmed,
          type: newType,
          parentId: parentNode?.id,
        });
      } else if (targetNode) {
        await onSubmit({ name: trimmed, type: targetNode.type });
      }
    } finally {
      setSaving(false);
    }
  }

  const title =
    mode === 'create' ? `${TYPE_LABEL[newType]} 추가` : '이름 변경';

  const nameExample =
    newType === 'group' ? '이노베이션그룹' : newType === 'division' ? 'DX본부' : 'DX1팀';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" layout="scroll-footer">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto text-sm text-foreground">
          <div className="flex flex-col gap-4 pt-1">
            {mode === 'create' ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">추가 위치</span>
                  <span className="text-sm text-foreground">
                    {parentNode
                      ? `${parentNode.name} 하위에 ${TYPE_LABEL[newType]}을(를) 추가해요.`
                      : '최상위 그룹으로 추가해요.'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">조직 유형</span>
                  {typeOptions.length > 1 ? (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={newType}
                      // 같은 항목 재클릭 시 빈 값 — 선택 해제 불가(라디오 동작) 유지.
                      onValueChange={(v) => v && setNewType(v as OrgNodeType)}
                      aria-label="조직 유형"
                    >
                      {typeOptions.map((t) => (
                        <ToggleGroupItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  ) : (
                    <span className="text-sm font-semibold text-foreground">
                      {TYPE_LABEL[newType]}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">현재 이름</span>
                <span className="text-sm text-foreground">{targetNode?.name ?? '—'}</span>
              </div>
            )}
            <TextFieldRow
              label={mode === 'create' ? `${TYPE_LABEL[newType]} 이름` : '새 이름'}
              value={name}
              onChange={(v) => {
                setName(v);
                if (error) setError(undefined);
              }}
              placeholder={mode === 'create' ? `예: ${nameExample}` : undefined}
              required
              error={error}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button loading={saving} onClick={() => void handleSubmit()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
