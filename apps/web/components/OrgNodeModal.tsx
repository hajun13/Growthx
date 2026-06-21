'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { TextField } from '@/components/TextField';
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      primaryAction={{
        label: '저장',
        onClick: () => void handleSubmit(),
        loading: saving,
      }}
      secondaryAction={{ label: '취소', onClick: onClose }}
    >
      <div className="flex flex-col gap-4 pt-1">
        {mode === 'create' ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                추가 위치
              </span>
              <span className="text-sm text-foreground">
                {parentNode
                  ? `${parentNode.name} 하위에 ${TYPE_LABEL[newType]}을(를) 추가해요.`
                  : '최상위 그룹으로 추가해요.'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                조직 유형
              </span>
              {typeOptions.length > 1 ? (
                <div className="flex gap-2">
                  {typeOptions.map((t) => {
                    const active = newType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        style={{
                          padding: '6px 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          border: `1px solid ${active ? '#0075DE' : 'rgba(204,204,212,0.6)'}`,
                          borderRadius: 8,
                          background: active ? 'rgba(0,117,222,0.08)' : '#fff',
                          color: active ? '#0075DE' : '#565660',
                          cursor: 'pointer',
                          transition: 'border-color .12s, background .12s',
                        }}
                      >
                        {TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {TYPE_LABEL[newType]}
                </span>
              )}
            </div>
            <TextField
              label={`${TYPE_LABEL[newType]} 이름`}
              value={name}
              onChange={(v) => {
                setName(v);
                if (error) setError(undefined);
              }}
              placeholder={`예: ${
                newType === 'group'
                  ? '이노베이션그룹'
                  : newType === 'division'
                    ? 'DX본부'
                    : 'DX1팀'
              }`}
              required
              error={error}
            />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                현재 이름
              </span>
              <span className="text-sm text-foreground">
                {targetNode?.name ?? '—'}
              </span>
            </div>
            <TextField
              label="새 이름"
              value={name}
              onChange={(v) => {
                setName(v);
                if (error) setError(undefined);
              }}
              required
              error={error}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
