'use client';

import { Modal } from './Modal';
import { TextField } from './TextField';
import { Select } from './Select';
import { ScopeSelect } from './ScopeSelect';
import { InfoBanner } from './InfoBanner';
import { Button } from './Button';
import { getPositionLabel, roleLabel } from '@/lib/ui';
import { defaultRoleForPosition, defaultScopeForPosition } from '@/lib/org';
import type {
  Position,
  PositionDef,
  Role,
  VisibilityScope,
} from '@/lib/types';

export interface PersonEditDraft {
  id?: string; // 없으면 추가 모드
  name: string;
  email: string;
  groupId: string;
  divisionId: string | null;
  teamId: string | null;
  position: Position;
  role: Role;
  visibilityScope: VisibilityScope;
  roleOverride: boolean;
  scopeOverride: boolean;
}

export interface PersonEditModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  value: PersonEditDraft;
  groups: { id: string; name: string }[];
  divisions: { id: string; name: string; groupId: string }[];
  teams: { id: string; name: string; parentId: string }[]; // parent = division 또는 group
  // 직급 드롭다운 옵션(레지스트리). 미전달 시 시스템 직급 폴백.
  positions?: PositionDef[];
  errors?: Partial<Record<keyof PersonEditDraft, string>>;
  saving?: boolean;
  onChange: (patch: Partial<PersonEditDraft>) => void;
  onSubmit: () => void;
  onClose: () => void;
  onDeactivate?: () => void;
}

// 레지스트리 미전달 시 폴백(시스템 직급 코드·정렬순).
const FALLBACK_POSITIONS: Position[] = [
  'ceo',
  'vice_president',
  'executive',
  'director',
  'principal',
  'division_head',
  'team_lead',
  'chief',
  'senior',
  'pro',
];
const ROLES: Role[] = ['hr_admin', 'division_head', 'team_lead', 'employee'];

export function PersonEditModal({
  open,
  mode,
  value,
  groups,
  divisions,
  teams,
  positions,
  errors,
  saving,
  onChange,
  onSubmit,
  onClose,
  onDeactivate,
}: PersonEditModalProps) {
  // 레지스트리 우선(정렬·라벨), 없으면 시스템 폴백.
  const positionOptions =
    positions && positions.length > 0
      ? [...positions]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => ({ value: p.code, label: p.label }))
      : FALLBACK_POSITIONS.map((p) => ({
          value: p,
          label: getPositionLabel(p),
        }));
  // 연쇄 옵션: 선택 그룹의 본부, 선택 본부(또는 그룹 직속)의 팀.
  const divisionOptions = divisions.filter((d) => d.groupId === value.groupId);
  const teamParentId = value.divisionId ?? value.groupId;
  const teamOptions = teams.filter((t) => t.parentId === teamParentId);

  const autoRole = defaultRoleForPosition(value.position);
  const autoScope = defaultScopeForPosition(value.position);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? '구성원 추가' : '구성원 수정'}
      size="md"
      secondaryAction={{ label: '취소', onClick: onClose }}
      primaryAction={{
        label: '저장',
        onClick: onSubmit,
        loading: saving,
      }}
    >
      <div className="flex flex-col gap-4 text-foreground">
        <TextField
          label="이름"
          value={value.name}
          onChange={(v) => onChange({ name: v })}
          required
          error={errors?.name}
        />
        <TextField
          label="이메일"
          type="email"
          value={value.email}
          onChange={(v) => onChange({ email: v })}
          required={mode === 'create'}
          readOnly={mode === 'edit'}
          error={errors?.email}
          hint={mode === 'edit' ? '이메일은 변경할 수 없어요.' : undefined}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="그룹"
            value={value.groupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            onChange={(v) =>
              onChange({ groupId: v, divisionId: null, teamId: null })
            }
            error={errors?.groupId}
          />
          <Select
            label="본부"
            value={value.divisionId ?? '__none__'}
            options={[
              { value: '__none__', label: '본부 없음(그룹 직속)' },
              ...divisionOptions.map((d) => ({ value: d.id, label: d.name })),
            ]}
            onChange={(v) =>
              onChange({
                divisionId: v === '__none__' ? null : v,
                teamId: null,
              })
            }
          />
          <Select
            label="팀"
            value={value.teamId ?? '__none__'}
            options={[
              { value: '__none__', label: '팀 직속(없음)' },
              ...teamOptions.map((t) => ({ value: t.id, label: t.name })),
            ]}
            onChange={(v) => onChange({ teamId: v === '__none__' ? null : v })}
          />
        </div>

        <Select
          label="직급"
          value={value.position}
          options={positionOptions}
          onChange={(v) => onChange({ position: v as Position })}
        />

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            권한 (자동기본에서 바꿀 때만)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Select
                label="역할(role)"
                value={value.role}
                options={ROLES.map((r) => ({ value: r, label: roleLabel[r] }))}
                onChange={(v) =>
                  onChange({ role: v as Role, roleOverride: true })
                }
              />
              <p className="text-xs text-muted-foreground">
                {value.role !== autoRole
                  ? `자동값: ${roleLabel[autoRole]}`
                  : '자동(직급 기준)'}
              </p>
            </div>
            <ScopeSelect
              value={value.visibilityScope}
              autoDefault={autoScope}
              onChange={(v) =>
                onChange({ visibilityScope: v, scopeOverride: true })
              }
            />
          </div>
        </div>

        <InfoBanner tone="info">
          비워두면 직급에 따라 자동으로 정해져요. 본부장은 형제 본부는 못 봐요(본인
          본부만).
        </InfoBanner>

        {mode === 'create' && (
          <p className="text-xs text-muted-foreground">
            등록하면 초기 비밀번호 1234로 만들어지고, 첫 로그인 때 바꾸도록
            안내돼요.
          </p>
        )}

        {mode === 'edit' && onDeactivate && (
          <div className="border-t border-border pt-3">
            <Button variant="danger" size="sm" onClick={onDeactivate}>
              구성원 비활성화
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
