'use client';

// 사용자 관리 (hr_admin) — 디자인 UserMgmt.tsx 레이아웃을 실 API에 연동.
// 목록: GET /users(useUsers) + GET /org-chart(부서 경로·드롭다운). CRUD: userCommands.
// 디자인의 group/dept/team 은 User.departmentId → 조직 트리 deptPath 로 합성한다.
// 디자인의 title(직급) 은 User.position(한글 라벨).
import { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Building2,
  UserMinus,
  UserCheck,
  ShieldAlert,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, userCommands } from '@/hooks/useUsers';
import { useOrgChart } from '@/hooks/useOrgChart';
import { departmentCommands } from '@/hooks/useDepartments';
import { usePositions, positionCommands } from '@/hooks/usePositions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { evaluationCommands } from '@/hooks/useEvaluations';
import { OrgStructureBoard } from '@/components/OrgStructureBoard';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Forbidden, ErrorState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Modal } from '@/components/Modal';
import {
  OrgNodeModal,
  type OrgNodeModalMode,
} from '@/components/OrgNodeModal';
import { isHrAdmin } from '@/lib/nav';
import { flattenOrg, deptByType } from '@/lib/org';
import {
  getPositionLabel,
  roleLabel,
  SCOPE_LABEL,
  jobLevelLabel,
  employmentStatusLabel,
} from '@/lib/ui';
import type {
  User,
  Position,
  PositionDef,
  Role,
  VisibilityScope,
  JobLevel,
  CreatePositionRequest,
  UpdatePositionRequest,
  OrgChartNode,
  OrgNodeType,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/lib/types';

/* ── Kinetic Enterprise 팔레트 (루트 DESIGN.md SSOT) ── */
const T = {
  grey50: '#f8f9fd',
  grey100: '#f2f3f7',
  grey200: '#cac4d2',
  grey400: '#9490a0',
  grey500: '#797582',
  grey600: '#605d67',
  grey700: '#484551',
  grey800: '#302e37',
  grey900: '#191c1f',
  // Kinetic: secondary blue = 액션·링크
  blue500: '#0054ca',
  blue50: 'rgba(0,84,202,0.08)',
  blue700: '#003d99',
  red500: '#ba1a1a',
  red50: 'rgba(186,26,26,0.08)',
  amber600: '#7d5700',
  amber50: 'rgba(125,87,0,0.08)',
  green600: '#006c47',
  green50: 'rgba(0,108,71,0.08)',
  // Kinetic primary purple
  purple: '#3f2c80',
};

// 사용자 테이블 컬럼(헤더·행 공유) — 이름/그룹·본부/팀/직급/상태/이메일/액션.
const USER_GRID = '1.1fr 1fr 0.9fr 80px 70px 1fr 150px';

// 재직 상태 뱃지 색 (Kinetic 시맨틱 색 — tertiary teal=완료, amber=경고, 회색=비활성)
const employmentBadgeStyle: Record<
  'active' | 'on_leave' | 'resigned',
  { bg: string; fg: string }
> = {
  active: { bg: 'rgba(14,154,160,0.12)', fg: '#006c63' },
  on_leave: { bg: 'rgba(125,87,0,0.10)', fg: '#7d5700' },
  resigned: { bg: 'rgba(202,196,210,0.3)', fg: '#605d67' },
};

// 직급 칩 색상 (Kinetic: primary=#3f2c80, secondary=#0054ca, 하위 점층)
const positionColor: Record<string, string> = {
  ceo: '#3f2c80',
  vice_president: '#3f2c80',
  executive: '#0054ca',
  director: '#0054ca',
  principal: '#302e37',
  division_head: '#302e37',
  team_lead: '#484551',
  chief: '#605d67',
  senior: '#797582',
  pro: '#9490a0',
};
function positionColorFor(code: string): string {
  return positionColor[code] ?? T.grey600;
}

// 화면 행 모델 — User + 합성한 그룹/본부/팀.
interface Row {
  user: User;
  group: string;
  division: string;
  team: string;
  positionLabel: string;
}

interface OrgOptions {
  groups: { id: string; name: string }[];
  divisions: { id: string; name: string; groupId: string }[];
  teams: { id: string; name: string; divisionId: string }[];
}

// 폼 상태 — 디자인 FormState 에 대응(조직은 id 로 선택).
interface FormState {
  name: string;
  email: string;
  groupId: string;
  divisionId: string;
  teamId: string;
  position: Position | '';
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  groupId: '',
  divisionId: '',
  teamId: '',
  position: '',
});

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid rgba(202,196,210,0.7)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  color: '#191c1f',
  transition: 'border-color .12s, box-shadow .12s',
};

function UserForm({
  initial,
  org,
  positions,
  onSave,
  onCancel,
  title,
  saving,
}: {
  initial: FormState;
  org: OrgOptions;
  positions: PositionDef[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
  title: string;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // 상위 변경 시 하위 초기화(디자인 동작).
      if (patch.groupId !== undefined) {
        next.divisionId = '';
        next.teamId = '';
      }
      if (patch.divisionId !== undefined) {
        next.teamId = '';
      }
      return next;
    });
  };

  const divisionList = form.groupId
    ? org.divisions.filter((d) => d.groupId === form.groupId)
    : [];
  // 본부 선택 시 그 본부 하위 팀, 본부 미선택+그룹 선택 시 그룹 직속 팀(parentId=group).
  const teamList = form.divisionId
    ? org.teams.filter((t) => t.divisionId === form.divisionId)
    : form.groupId
      ? org.teams.filter((t) => t.divisionId === form.groupId)
      : [];

  // 이름·이메일·직급만 필수. 조직(그룹/본부/팀)은 모두 비워도 됨(임원·외부 인사 → 무소속).
  const valid = !!(form.name && form.email && form.position);

  // 직급 옵션(레지스트리 정렬순).
  const positionOptions = [...positions].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const selectStyle = (filled: boolean, enabled: boolean): React.CSSProperties => ({
    ...inputBase,
    color: filled ? T.grey900 : T.grey500,
    background: enabled ? '#fff' : T.grey50,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid rgba(202,196,210,0.5)',
          boxShadow: '0 8px 32px rgba(63,44,128,0.12)',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(202,196,210,0.3)',
            background: '#f2f3f7',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#191c1f' }}>
            {title}
          </span>
          <button onClick={onCancel} aria-label="닫기">
            <X size={16} color="#605d67" />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 이름 */}
          <Field label="이름" required>
            <input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="홍길동"
              style={inputBase}
            />
          </Field>
          {/* 이메일 */}
          <Field label="이메일" required>
            <input
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="hong@energyx.co.kr"
              type="email"
              style={inputBase}
            />
          </Field>
          {/* 그룹 (선택 — 무소속 허용) */}
          <Field label="그룹">
            <select
              value={form.groupId}
              onChange={(e) => set({ groupId: e.target.value })}
              style={selectStyle(!!form.groupId, true)}
            >
              <option value="">소속 없음</option>
              {org.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: T.grey500, marginTop: 4 }}>
              임원·외부 인사는 비워둘 수 있어요.
            </p>
          </Field>
          {/* 본부 */}
          <Field label="본부">
            <select
              value={form.divisionId}
              onChange={(e) => set({ divisionId: e.target.value })}
              disabled={!form.groupId}
              style={selectStyle(!!form.divisionId, !!form.groupId)}
            >
              <option value="">본부 선택</option>
              {divisionList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          {/* 팀 — 본부 미선택이어도 그룹 직속 팀이 있으면 선택 가능 */}
          <Field label="팀">
            <select
              value={form.teamId}
              onChange={(e) => set({ teamId: e.target.value })}
              disabled={!form.divisionId && !form.groupId}
              style={selectStyle(!!form.teamId, !!form.divisionId || !!form.groupId)}
            >
              <option value="">팀 선택</option>
              {teamList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {!form.divisionId && form.groupId && teamList.length > 0 && (
              <p style={{ fontSize: 11, color: T.grey500, marginTop: 4 }}>
                본부를 비워두면 그룹 직속 팀으로 배정돼요.
              </p>
            )}
          </Field>
          {/* 직급 */}
          <Field label="직급" required>
            <select
              value={form.position}
              onChange={(e) => set({ position: e.target.value as Position })}
              style={selectStyle(!!form.position, true)}
            >
              <option value="">직급 선택</option>
              {positionOptions.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div
          className="flex items-center justify-end gap-3"
          style={{ padding: '16px 24px', borderTop: '1px solid rgba(202,196,210,0.3)' }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              border: '1px solid rgba(202,196,210,0.7)',
              borderRadius: 8,
              fontSize: 13,
              color: '#484551',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => valid && !saving && onSave(form)}
            disabled={!valid || saving}
            className="flex items-center gap-1.5"
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: valid && !saving ? '#3f2c80' : 'rgba(202,196,210,0.6)',
              border: 'none',
              cursor: valid && !saving ? 'pointer' : 'default',
              boxShadow: valid && !saving ? '0 2px 8px rgba(63,44,128,0.2)' : 'none',
            }}
          >
            <Save size={14} /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#484551',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}{' '}
        {required && <span style={{ color: '#ba1a1a' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// 행 액션 버튼(아이콘+라벨, 텍스트 색만 다름). 좁은 셀에서 줄바꿈 허용.
function RowAction({
  onClick,
  icon,
  label,
  color,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: 'transparent',
        padding: '2px 4px',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// 라이프사이클 확인 모달 셸(퇴사·복직·삭제·완전삭제 공용). 인라인 스타일로 디자인 일관.
function LifecycleModal({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmColor,
  busy,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmColor: string;
  busy: boolean;
  disabled?: boolean;
}) {
  const blocked = busy || disabled;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: 420,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid rgba(202,196,210,0.5)',
        boxShadow: '0 8px 32px rgba(63,44,128,0.12)',
      }}>
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(202,196,210,0.3)',
            background: '#f2f3f7',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#191c1f' }}>
            {title}
          </span>
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
        <div
          className="flex justify-end gap-3"
          style={{ padding: '16px 24px', borderTop: '1px solid rgba(202,196,210,0.3)' }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              border: '1px solid rgba(202,196,210,0.7)',
              borderRadius: 8,
              fontSize: 13,
              color: '#484551',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => !blocked && onConfirm()}
            disabled={blocked}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              border: 'none',
              background: blocked ? 'rgba(202,196,210,0.6)' : confirmColor,
              cursor: blocked ? 'default' : 'pointer',
            }}
          >
            {busy ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 직급 추가/수정 모달 ──────────────────────────────────────
const ROLE_OPTIONS: Role[] = [
  'hr_admin',
  'division_head',
  'team_lead',
  'employee',
];
const SCOPE_OPTIONS: VisibilityScope[] = [
  'self',
  'team',
  'division',
  'group',
  'company',
];
const JOBLEVEL_OPTIONS: JobLevel[] = [
  'division_head',
  'team_lead',
  'senior_plus',
  'senior_minus',
];

interface PositionFormState {
  label: string;
  code: string;
  isManagement: boolean;
  defaultRole: Role;
  defaultScope: VisibilityScope;
  defaultJobLevel: JobLevel | '';
  sortOrder: string; // input 문자열, 저장 시 number 변환.
}

function PositionModal({
  target,
  onSave,
  onCancel,
}: {
  target: PositionDef | null; // null=추가
  onSave: (
    body: CreatePositionRequest | UpdatePositionRequest,
    id?: string,
  ) => void | Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!target;
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PositionFormState>(() => ({
    label: target?.label ?? '',
    code: target?.code ?? '',
    isManagement: target?.isManagement ?? false,
    defaultRole: target?.defaultRole ?? 'employee',
    defaultScope: target?.defaultScope ?? 'self',
    defaultJobLevel: target?.defaultJobLevel ?? '',
    sortOrder:
      target?.sortOrder !== undefined ? String(target.sortOrder) : '',
  }));

  const set = (patch: Partial<PositionFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  // 시스템 직급은 코드 불변. 라벨 필수.
  const valid = !!form.label.trim();

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const jobLevel: JobLevel | null = form.defaultJobLevel || null;
    const sortOrder = form.sortOrder.trim()
      ? Number(form.sortOrder)
      : undefined;
    try {
      if (isEdit && target) {
        // 코드·isSystem 은 보내지 않음(불변).
        const body: UpdatePositionRequest = {
          label: form.label.trim(),
          isManagement: form.isManagement,
          defaultRole: form.defaultRole,
          defaultScope: form.defaultScope,
          defaultJobLevel: jobLevel,
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        };
        await onSave(body, target.id);
      } else {
        const body: CreatePositionRequest = {
          label: form.label.trim(),
          isManagement: form.isManagement,
          defaultRole: form.defaultRole,
          defaultScope: form.defaultScope,
          defaultJobLevel: jobLevel,
          ...(sortOrder !== undefined ? { sortOrder } : {}),
          ...(form.code.trim() ? { code: form.code.trim() } : {}),
        };
        await onSave(body);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 460,
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid rgba(202,196,210,0.5)',
          boxShadow: '0 8px 32px rgba(63,44,128,0.12)',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(202,196,210,0.3)',
            background: '#f2f3f7',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: '#191c1f' }}>
            {isEdit ? '직급 수정' : '직급 추가'}
          </span>
          <button onClick={onCancel} aria-label="닫기">
            <X size={16} color="#605d67" />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="직급명" required>
            <input
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="예: CTO"
              style={inputBase}
            />
          </Field>

          {/* 경영진(직책자) 토글 */}
          <Field label="경영진 여부">
            <button
              type="button"
              onClick={() => set({ isManagement: !form.isManagement })}
              className="flex items-center gap-2"
              style={{
                padding: '8px 12px',
                border: `1px solid ${T.grey200}`,
                background: form.isManagement ? T.blue500 : '#fff',
                color: form.isManagement ? '#fff' : T.grey700,
                fontSize: 13,
                fontWeight: 600,
                width: '100%',
                justifyContent: 'flex-start',
              }}
            >
              <span
                className="is-circle"
                style={{
                  width: 8,
                  height: 8,
                  display: 'inline-block',
                  background: form.isManagement ? '#fff' : T.grey400,
                }}
              />
              {form.isManagement ? '직책자(경영진·본부장·팀장)' : '일반 직급'}
            </button>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="기본 역할">
              <select
                value={form.defaultRole}
                onChange={(e) => set({ defaultRole: e.target.value as Role })}
                style={{ ...inputBase, color: T.grey900 }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="기본 가시범위">
              <select
                value={form.defaultScope}
                onChange={(e) =>
                  set({ defaultScope: e.target.value as VisibilityScope })
                }
                style={{ ...inputBase, color: T.grey900 }}
              >
                {SCOPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="기본 직급레벨">
              <select
                value={form.defaultJobLevel}
                onChange={(e) =>
                  set({ defaultJobLevel: e.target.value as JobLevel | '' })
                }
                style={{
                  ...inputBase,
                  color: form.defaultJobLevel ? T.grey900 : T.grey500,
                }}
              >
                <option value="">선택 안 함</option>
                {JOBLEVEL_OPTIONS.map((j) => (
                  <option key={j} value={j}>
                    {jobLevelLabel[j]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="정렬값">
              <input
                value={form.sortOrder}
                onChange={(e) =>
                  set({ sortOrder: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="낮을수록 상위"
                inputMode="numeric"
                style={inputBase}
              />
            </Field>
          </div>

          {/* 코드 — 추가 시 고급에서 수동 입력. 수정 시 읽기전용. */}
          {isEdit ? (
            <Field label="코드">
              <input
                value={form.code}
                readOnly
                style={{ ...inputBase, color: T.grey500, background: T.grey50 }}
              />
            </Field>
          ) : showCode ? (
            <Field label="코드(고급)">
              <input
                value={form.code}
                onChange={(e) =>
                  set({
                    code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  })
                }
                placeholder="비우면 자동 생성 (예: cto)"
                style={inputBase}
              />
              <p style={{ fontSize: 11, color: T.grey500, marginTop: 4 }}>
                영문 소문자·숫자·밑줄만. 비우면 직급명에서 자동 생성돼요.
              </p>
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowCode(true)}
              style={{
                fontSize: 11.5,
                color: T.grey600,
                textAlign: 'left',
                background: 'transparent',
              }}
            >
              + 코드 직접 입력(고급)
            </button>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-3"
          style={{ padding: '16px 24px', borderTop: '1px solid rgba(202,196,210,0.3)' }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              border: '1px solid rgba(202,196,210,0.7)',
              borderRadius: 8,
              fontSize: 13,
              color: '#484551',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => void submit()}
            disabled={!valid || saving}
            className="flex items-center gap-1.5"
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              border: 'none',
              background: valid && !saving ? '#3f2c80' : 'rgba(202,196,210,0.6)',
              cursor: valid && !saving ? 'pointer' : 'default',
              boxShadow: valid && !saving ? '0 2px 8px rgba(63,44,128,0.2)' : 'none',
            }}
          >
            <Save size={14} /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserMgmtPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = !!user && isHrAdmin(user.role);

  // 비활성(퇴사·휴직 포함) 토글 — 켜면 includeInactive=true 로 목록 확장.
  const [includeInactive, setIncludeInactive] = useState(true);

  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useUsers(
    { includeInactive, pageSize: 500 },
    { enabled: !!user },
  );

  const {
    data: chart,
    loading: chartLoading,
    reload: reloadChart,
  } = useOrgChart({ enabled: !!user });

  // 부서장 평가 재배정에 쓸 현재(활성) 주기.
  const { current: currentCycle } = useCurrentCycle();
  const cycleId = currentCycle?.id;

  // 직급 레지스트리(드롭다운·라벨·관리 탭). 비활성 포함(관리 탭 표시용).
  const {
    data: positionsData,
    loading: positionsLoading,
    reload: reloadPositions,
  } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(
    () => positionsData?.data ?? [],
    [positionsData],
  );
  // 활성 직급만(사용자 폼 드롭다운용).
  const activePositions = useMemo(
    () => positions.filter((p) => p.isActive),
    [positions],
  );

  const flat = useMemo(() => flattenOrg(chart), [chart]);

  // 조직 드롭다운 옵션(그룹/본부/팀 — id·이름·상위 id).
  const org = useMemo<OrgOptions>(() => {
    const groups: OrgOptions['groups'] = [];
    const divisions: OrgOptions['divisions'] = [];
    const teams: OrgOptions['teams'] = [];
    flat.forEach((n) => {
      if (n.type === 'group') groups.push({ id: n.id, name: n.name });
      else if (n.type === 'division')
        divisions.push({ id: n.id, name: n.name, groupId: n.parentId ?? '' });
      else if (n.type === 'team')
        teams.push({ id: n.id, name: n.name, divisionId: n.parentId ?? '' });
    });
    return { groups, divisions, teams };
  }, [flat]);

  // User → 행(그룹/본부/팀 합성).
  const rows = useMemo<Row[]>(() => {
    const list = usersData?.data ?? [];
    return list.map((u) => {
      // type별 분류 — 그룹 직속 팀(본부 없음)도 자리가 어긋나지 않게.
      const d = deptByType(u.departmentId, flat);
      return {
        user: u,
        group: d.group,
        division: d.division,
        team: d.team,
        positionLabel: getPositionLabel(u.position, positions),
      };
    });
  }, [usersData, flat, positions]);

  const [tab, setTab] = useState<'users' | 'org' | 'positions'>('users');

  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('전체');

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  // ── 라이프사이클 액션 상태 ──
  const [resignTarget, setResignTarget] = useState<Row | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<Row | null>(null);
  // 하드 삭제: 대상 + 409(이력) 차단 메시지(있으면 노출 + 완전 삭제 유도).
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);
  // 완전 삭제: 대상 + 이름 확인 입력.
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  // 라이프사이클 처리 중 플래그(모달 버튼 잠금).
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  // ── 조직 노드 CRUD 상태 ──
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeModalMode, setNodeModalMode] = useState<OrgNodeModalMode>('create');
  const [nodeParent, setNodeParent] = useState<OrgChartNode | null>(null);
  const [nodeTarget, setNodeTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleteTarget, setNodeDeleteTarget] = useState<OrgChartNode | null>(null);
  const [nodeDeleting, setNodeDeleting] = useState(false);

  // ── 부서장 평가 재배정(조직 변경 후) ──
  const [confirmReassign, setConfirmReassign] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);

  // ── 직급 관리 상태 ──
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posEditTarget, setPosEditTarget] = useState<PositionDef | null>(null);
  const [posDeleteTarget, setPosDeleteTarget] = useState<PositionDef | null>(null);
  const [posDeleting, setPosDeleting] = useState(false);

  function openAddPosition() {
    setPosEditTarget(null);
    setPosModalOpen(true);
  }
  function openEditPosition(p: PositionDef) {
    setPosEditTarget(p);
    setPosModalOpen(true);
  }

  async function submitPosition(
    body: CreatePositionRequest | UpdatePositionRequest,
    id?: string,
  ) {
    try {
      if (id) {
        await positionCommands.update(id, body as UpdatePositionRequest);
        toast.show({ variant: 'success', message: '직급을 수정했어요.' });
      } else {
        await positionCommands.create(body as CreatePositionRequest);
        toast.show({ variant: 'success', message: '직급을 추가했어요.' });
      }
      setPosModalOpen(false);
      setPosEditTarget(null);
      reloadPositions();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError && err.code === 'ALREADY_EXISTS'
            ? '이미 있는 코드/라벨이에요.'
            : err instanceof ApiError
              ? err.message
              : '저장에 실패했어요.',
      });
    }
  }

  async function confirmDeletePosition() {
    if (!posDeleteTarget) return;
    setPosDeleting(true);
    try {
      await positionCommands.remove(posDeleteTarget.id);
      toast.show({ variant: 'success', message: '직급을 삭제했어요.' });
      setPosDeleteTarget(null);
      reloadPositions();
    } catch (err) {
      // 409: IN_USE(사용 중) / FORBIDDEN(기본 직급).
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setPosDeleting(false);
    }
  }

  const groupFilterOptions = useMemo(
    () => ['전체', ...org.groups.map((g) => g.name)],
    [org.groups],
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          if (filterGroup !== '전체' && r.group !== filterGroup) return false;
          if (search) {
            const q = search.toLowerCase();
            const hay = `${r.user.name} ${r.user.email} ${r.team} ${r.division}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        // 이름 가나다순(한글 로케일 정렬).
        .sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko')),
    [rows, filterGroup, search],
  );

  // 통계(전체/이사 이상/본부장·팀장/팀원).
  const stats = useMemo(() => {
    const total = rows.length;
    const exec = rows.filter((r) =>
      ['ceo', 'vice_president', 'executive', 'director'].includes(r.user.position),
    ).length;
    const lead = rows.filter((r) =>
      ['division_head', 'team_lead'].includes(r.user.position),
    ).length;
    const member = rows.filter((r) =>
      ['principal', 'chief', 'senior', 'pro'].includes(r.user.position),
    ).length;
    return { total, exec, lead, member };
  }, [rows]);

  // ── CRUD ──
  // 선택된 최하위 조직 id, 아무것도 안 골랐으면 undefined(빈 문자열 금지).
  function resolveDeptId(f: FormState): string | undefined {
    return f.teamId || f.divisionId || f.groupId || undefined;
  }

  async function handleAdd(f: FormState) {
    setSaving(true);
    try {
      const deptId = resolveDeptId(f);
      const body: CreateUserRequest = {
        email: f.email.trim(),
        name: f.name.trim(),
        position: f.position as Position,
        // 조직 미선택 시 키 자체를 생략(무소속 등록).
        ...(deptId ? { departmentId: deptId } : {}),
      };
      await userCommands.create(body);
      toast.show({ variant: 'success', message: '사용자를 추가했어요.' });
      setShowForm(false);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError && err.code === 'ALREADY_EXISTS'
            ? '이미 등록된 이메일이에요.'
            : err instanceof ApiError
              ? err.message
              : '추가에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(f: FormState) {
    if (!editTarget) return;
    setSaving(true);
    try {
      const deptId = resolveDeptId(f);
      const body: UpdateUserRequest = {
        name: f.name.trim(),
        position: f.position as Position,
        // 조직을 비웠으면 null 전송(소속 해제), 있으면 해당 id.
        departmentId: deptId ?? null,
      };
      await userCommands.update(editTarget.user.id, body);
      toast.show({ variant: 'success', message: '사용자를 수정했어요.' });
      setEditTarget(null);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '수정에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  // 평가 제외/포함 토글 — 재직 중이나 이번 평가 대상이 아닌 사람(하반기 입사 등).
  async function handleToggleExempt(r: Row) {
    try {
      await userCommands.update(r.user.id, {
        evaluationExempt: !r.user.evaluationExempt,
      });
      toast.show({
        variant: 'success',
        message: r.user.evaluationExempt
          ? `${r.user.name}님을 평가 대상에 포함했어요.`
          : `${r.user.name}님을 평가에서 제외했어요.`,
      });
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    }
  }

  // ── 라이프사이클 핸들러 ──
  // 퇴사 처리(PATCH resign). 본인 대상은 백엔드가 403 → message 그대로 노출.
  async function handleResign() {
    if (!resignTarget) return;
    setLifecycleBusy(true);
    try {
      await userCommands.resign(resignTarget.user.id);
      toast.show({ variant: 'success', message: '퇴사 처리했어요.' });
      setResignTarget(null);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '퇴사 처리에 실패했어요.',
      });
    } finally {
      setLifecycleBusy(false);
    }
  }

  // 복직(PATCH reactivate).
  async function handleReactivate() {
    if (!reactivateTarget) return;
    setLifecycleBusy(true);
    try {
      await userCommands.reactivate(reactivateTarget.user.id);
      toast.show({ variant: 'success', message: '복직 처리했어요.' });
      setReactivateTarget(null);
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '복직 처리에 실패했어요.',
      });
    } finally {
      setLifecycleBusy(false);
    }
  }

  // 하드 삭제(DELETE). 평가 이력 있으면 409 CONFLICT → message 그대로 노출 + 완전 삭제 유도.
  async function handleDelete() {
    if (!deleteTarget) return;
    setLifecycleBusy(true);
    setDeleteBlocked(null);
    try {
      await userCommands.remove(deleteTarget.user.id);
      toast.show({ variant: 'success', message: '사용자를 삭제했어요.' });
      setDeleteTarget(null);
      reloadUsers();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        // 이력 차단 — 평탄화 없이 백엔드 message 그대로 인라인 노출.
        setDeleteBlocked(err.message);
      } else {
        toast.show({
          variant: 'danger',
          message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
        });
        setDeleteTarget(null);
      }
    } finally {
      setLifecycleBusy(false);
    }
  }

  // 완전 삭제(DELETE ?force=true). 이력 포함 cascade — 연도비교에서도 사라짐.
  async function handlePurge() {
    if (!purgeTarget) return;
    setLifecycleBusy(true);
    try {
      await userCommands.purge(purgeTarget.user.id);
      toast.show({ variant: 'success', message: '이력까지 완전 삭제했어요.' });
      setPurgeTarget(null);
      setPurgeConfirm('');
      reloadUsers();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '완전 삭제에 실패했어요.',
      });
    } finally {
      setLifecycleBusy(false);
    }
  }

  // 삭제 모달에서 "완전 삭제로 전환" — 하드 삭제 닫고 완전 삭제 모달 오픈.
  function escalateToPurge() {
    const t = deleteTarget;
    setDeleteTarget(null);
    setDeleteBlocked(null);
    if (t) {
      setPurgeTarget(t);
      setPurgeConfirm('');
    }
  }

  // ── 조직 노드 CRUD ──
  function openAddRoot() {
    setNodeModalMode('create');
    setNodeParent(null);
    setNodeTarget(null);
    setNodeModalOpen(true);
  }

  function handleNodeAction(
    action: 'addChild' | 'rename' | 'delete',
    node: OrgChartNode,
  ) {
    if (action === 'rename') {
      setNodeModalMode('rename');
      setNodeTarget(node);
      setNodeParent(null);
      setNodeModalOpen(true);
    } else if (action === 'addChild') {
      if (node.type === 'team') {
        toast.show({ variant: 'info', message: '팀 아래에는 더 추가할 수 없어요.' });
        return;
      }
      setNodeModalMode('create');
      setNodeParent(node);
      setNodeTarget(null);
      setNodeModalOpen(true);
    } else {
      setNodeDeleteTarget(node);
    }
  }

  async function submitNode(data: {
    name: string;
    type: OrgNodeType;
    parentId?: string;
  }) {
    try {
      if (nodeModalMode === 'create') {
        await departmentCommands.create({
          name: data.name,
          type: data.type,
          parentId: data.parentId,
        });
        toast.show({ variant: 'success', message: '조직을 추가했어요.' });
      } else if (nodeTarget) {
        await departmentCommands.rename(nodeTarget.id, data.name);
        toast.show({ variant: 'success', message: '이름을 변경했어요.' });
      }
      setNodeModalOpen(false);
      setNodeParent(null);
      setNodeTarget(null);
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    }
  }

  async function confirmDeleteNode() {
    if (!nodeDeleteTarget) return;
    setNodeDeleting(true);
    try {
      await departmentCommands.remove(nodeDeleteTarget.id);
      toast.show({ variant: 'success', message: '조직을 삭제했어요.' });
      setNodeDeleteTarget(null);
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '삭제에 실패했어요.',
      });
    } finally {
      setNodeDeleting(false);
    }
  }

  // ── 드래그&드롭: 사람 이동(부서 변경) ──
  async function handleMovePerson(userId: string, deptId: string) {
    try {
      await userCommands.update(userId, { departmentId: deptId });
      toast.show({ variant: 'success', message: '소속을 옮겼어요.' });
      reloadUsers();
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '이동에 실패했어요.',
      });
    }
  }

  // ── 드래그&드롭: 부서 노드 이동(상위 변경) ──
  async function handleMoveDept(deptId: string, parentId: string) {
    try {
      await departmentCommands.move(deptId, parentId);
      toast.show({ variant: 'success', message: '조직을 옮겼어요.' });
      reloadChart();
      reloadUsers();
    } catch (err) {
      // 계층/순환 위반은 INVALID_MOVE → 백엔드 message 그대로 노출.
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '이동에 실패했어요.',
      });
    }
  }

  // ── 부서장(그룹장·본부장·팀장) 지정/해제 ──
  async function handleSetHead(deptId: string, userId: string) {
    try {
      await departmentCommands.setHead(deptId, userId);
      toast.show({
        variant: 'success',
        message: userId ? '부서장을 지정했어요.' : '부서장 지정을 해제했어요.',
      });
      reloadChart();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '지정에 실패했어요.',
      });
    }
  }

  // ── 부서장 평가 스마트 재배정(조직 변경 후) ──
  async function handleReassignOrg() {
    if (!cycleId) {
      toast.show({ variant: 'danger', message: '활성 평가 주기가 없어요.' });
      return;
    }
    setReassignBusy(true);
    try {
      const res = await evaluationCommands.autoAssignDownward(cycleId, true);
      toast.show({
        variant: 'success',
        message: `부서장 평가를 재배정했어요. 새 배정 ${res.created}건${res.deleted ? ` · 초기화 ${res.deleted}건` : ''}.`,
      });
      setConfirmReassign(false);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '재배정에 실패했어요.',
      });
    } finally {
      setReassignBusy(false);
    }
  }

  // Row → 폼 초기값(id 기반 조직 선택).
  function rowToForm(r: Row): FormState {
    const u = r.user;
    // departmentId 가 어느 레벨인지 판정해 그룹/본부/팀 id 채움(무소속이면 모두 빈값).
    const node = u.departmentId ? flat.get(u.departmentId) : undefined;
    let groupId = '';
    let divisionId = '';
    let teamId = '';
    if (node) {
      if (node.type === 'team') {
        teamId = node.id;
        const parent = node.parentId ? flat.get(node.parentId) : undefined;
        if (parent?.type === 'division') {
          divisionId = parent.id;
          groupId = parent.parentId ?? '';
        } else if (parent?.type === 'group') {
          // 그룹 직속 팀(본부 없음).
          groupId = parent.id;
        }
      } else if (node.type === 'division') {
        divisionId = node.id;
        groupId = node.parentId ?? '';
      } else if (node.type === 'group') {
        groupId = node.id;
      }
    }
    return {
      name: u.name,
      email: u.email,
      groupId,
      divisionId,
      teamId,
      position: u.position,
    };
  }

  if (!user) return null;
  if (!isAdmin) {
    return <Forbidden message="사용자 관리는 HR 관리자만 접근할 수 있어요." />;
  }
  if (usersError) {
    return <ErrorState onRetry={reloadUsers} message="사용자를 불러오지 못했어요." />;
  }

  const statCards = [
    { label: '전체 사용자', value: stats.total, bg: '#3f2c80' },
    { label: '이사 이상', value: stats.exec, bg: '#0054ca' },
    { label: '본부장·팀장', value: stats.lead, bg: '#484551' },
    { label: '팀원', value: stats.member, bg: '#605d67' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="사용자 관리"
        subtitle={
          tab === 'users'
            ? '시스템 사용자를 추가·수정하고, 퇴사·복직·삭제를 관리합니다.'
            : tab === 'org'
              ? '그룹·본부·팀 조직 구조를 추가·수정·삭제합니다.'
              : '직급을 추가·수정·삭제합니다. 기본 직급은 라벨·정렬만 바꿀 수 있어요.'
        }
        right={
          tab === 'users' ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5"
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: '#3f2c80',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(63,44,128,0.2)',
              }}
            >
              <Plus size={14} /> 사용자 추가
            </button>
          ) : tab === 'org' ? (
            <button
              onClick={openAddRoot}
              className="flex items-center gap-1.5"
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: '#3f2c80',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(63,44,128,0.2)',
              }}
            >
              <Plus size={14} /> 그룹 추가
            </button>
          ) : (
            <button
              onClick={openAddPosition}
              className="flex items-center gap-1.5"
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: '#3f2c80',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(63,44,128,0.2)',
              }}
            >
              <Plus size={14} /> 직급 추가
            </button>
          )
        }
      />

      {/* 탭 */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(202,196,210,0.4)' }}>
        {([
          { key: 'users', label: '사용자 목록' },
          { key: 'org', label: '조직 구조' },
          { key: 'positions', label: '직급 관리' },
        ] as const).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? '#0054ca' : '#797582',
                borderBottom: `2px solid ${active ? '#0054ca' : 'transparent'}`,
                marginBottom: -1,
                background: 'transparent',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'org' && (
        <div className="space-y-3">
          {/* 툴바: 안내 + 재배정 */}
          <div
            className="flex items-center justify-between flex-wrap gap-2"
            style={{
              background: '#fff',
              border: '1px solid rgba(202,196,210,0.4)',
              borderRadius: 10,
              padding: '12px 20px',
              boxShadow: '0 2px 8px rgba(86,69,153,0.04)',
            }}
          >
            <div className="flex items-center gap-2">
              <Building2 size={14} color="#0054ca" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#484551' }}>
                조직 구조 (그룹 → 본부 → 팀)
              </span>
            </div>
            <button
              onClick={() => setConfirmReassign(true)}
              disabled={reassignBusy}
              className="flex items-center gap-1.5"
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#484551',
                background: '#fff',
                border: '1px solid rgba(202,196,210,0.6)',
                cursor: reassignBusy ? 'not-allowed' : 'pointer',
                opacity: reassignBusy ? 0.6 : 1,
              }}
              title="조직을 바꾼 뒤 누르면, 아직 시작 안 한 부서장 평가를 현재 팀장·본부장 기준으로 다시 배정해요."
            >
              <RefreshCw size={13} /> {reassignBusy ? '재배정 중…' : '부서장 평가 재배정'}
            </button>
          </div>

          {chartLoading && !chart ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: '#797582',
                fontSize: 13,
                background: '#fff',
                border: '1px solid rgba(202,196,210,0.4)',
                borderRadius: 10,
              }}
            >
              불러오는 중…
            </div>
          ) : (
            <OrgStructureBoard
              chart={chart ?? null}
              users={usersData?.data ?? []}
              positions={positions}
              isAdmin={isAdmin}
              onNodeAction={handleNodeAction}
              onMovePerson={handleMovePerson}
              onMoveDept={handleMoveDept}
              onSetHead={handleSetHead}
            />
          )}
        </div>
      )}

      {tab === 'positions' && (
        <div style={{
          background: '#fff',
          border: '1px solid rgba(202,196,210,0.4)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
        }}>
          {/* 헤더 행 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 70px 90px 1fr 1fr 96px',
              padding: '12px 20px',
              borderBottom: '1px solid rgba(202,196,210,0.3)',
              background: '#f2f3f7',
            }}
          >
            {['코드', '직급명', '정렬', '경영진', '기본 역할', '기본 가시범위', ''].map(
              (h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
                  {h}
                </div>
              ),
            )}
          </div>

          {positionsLoading && positions.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#797582', fontSize: 13 }}>
              불러오는 중…
            </div>
          ) : positions.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#797582', fontSize: 13 }}>
              직급이 아직 없어요. 오른쪽 위 “직급 추가”로 시작하세요.
            </div>
          ) : (
            [...positions]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 70px 90px 1fr 1fr 96px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(202,196,210,0.2)',
                    opacity: p.isActive ? 1 : 0.5,
                  }}
                >
                  {/* 코드 */}
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: T.grey700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.code}
                  </div>
                  {/* 라벨 + 기본 뱃지 */}
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: positionColorFor(p.code),
                        background: 'rgba(202,196,210,0.25)',
                        padding: '2px 8px',
                        borderRadius: 5,
                      }}
                    >
                      {p.label}
                    </span>
                    {p.isSystem && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#605d67',
                          background: 'rgba(202,196,210,0.25)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        기본
                      </span>
                    )}
                    {!p.isActive && (
                      <span style={{ fontSize: 10, color: '#797582' }}>(비활성)</span>
                    )}
                  </div>
                  {/* 정렬값 */}
                  <div style={{ fontSize: 12.5, color: '#484551' }}>{p.sortOrder}</div>
                  {/* 경영진 여부 */}
                  <div style={{ fontSize: 12, color: p.isManagement ? '#0054ca' : '#797582' }}>
                    {p.isManagement ? '직책자' : '일반'}
                  </div>
                  {/* 기본 역할 */}
                  <div style={{ fontSize: 12.5, color: '#484551' }}>
                    {roleLabel[p.defaultRole]}
                  </div>
                  {/* 기본 가시범위 */}
                  <div style={{ fontSize: 12.5, color: '#484551' }}>
                    {SCOPE_LABEL[p.defaultScope]}
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditPosition(p)}
                      title="수정"
                      style={{ color: '#0054ca' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setPosDeleteTarget(p)}
                      title="삭제"
                      style={{ color: '#ba1a1a', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {tab === 'users' && (
      <>
      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center"
            style={{
              background: '#fff',
              border: '1px solid rgba(202,196,210,0.4)',
              borderRadius: 12,
              padding: '20px',
              boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
            }}
          >
            <span
              className="tabular-nums"
              style={{ fontSize: 32, fontWeight: 800, color: s.bg, lineHeight: 1 }}
            >
              {s.value}
            </span>
            <span style={{ fontSize: 12.5, color: '#797582', marginTop: 6, fontWeight: 500 }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2"
          style={{
            border: '1px solid rgba(202,196,210,0.7)',
            borderRadius: 8,
            padding: '8px 12px',
            background: '#fff',
            minWidth: 240,
          }}
        >
          <Search size={13} color="#797582" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·이메일·팀 검색"
            className="outline-none flex-1"
            style={{ fontSize: 12.5, background: 'transparent', color: '#191c1f', border: 'none' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {groupFilterOptions.map((g) => {
            const active = filterGroup === g;
            return (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  background: active ? '#3f2c80' : '#fff',
                  color: active ? '#fff' : '#484551',
                  border: `1px solid ${active ? '#3f2c80' : 'rgba(202,196,210,0.7)'}`,
                  cursor: 'pointer',
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        {/* 비활성(퇴사·휴직) 포함 토글 */}
        <button
          onClick={() => setIncludeInactive((v) => !v)}
          className="flex items-center gap-2"
          style={{
            padding: '6px 13px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            marginLeft: 'auto',
            background: includeInactive ? '#3f2c80' : '#fff',
            color: includeInactive ? '#fff' : '#484551',
            border: `1px solid ${includeInactive ? '#3f2c80' : 'rgba(202,196,210,0.7)'}`,
            cursor: 'pointer',
          }}
        >
          비활성 포함
        </button>
        <span style={{ fontSize: 12, color: '#797582' }}>{filtered.length}명</span>
      </div>

      {/* 테이블 */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(202,196,210,0.4)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
      }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: USER_GRID,
            padding: '12px 20px',
            borderBottom: '1px solid rgba(202,196,210,0.3)',
            background: '#f2f3f7',
          }}
        >
          {['이름', '그룹 / 본부', '팀', '직급', '상태', '이메일', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 600, color: '#605d67', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {h}
            </div>
          ))}
        </div>

        {usersLoading && rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#797582', fontSize: 13 }}>
            불러오는 중…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#797582', fontSize: 13 }}>
            검색 결과가 없습니다.
          </div>
        ) : (
          filtered.map((r) => {
            const u = r.user;
            const emp = employmentBadgeStyle[u.employmentStatus];
            return (
              <div
                key={u.id}
                className="group"
                style={{
                  display: 'grid',
                  gridTemplateColumns: USER_GRID,
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(202,196,210,0.2)',
                  opacity: u.isActive ? 1 : 0.55,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f9fd'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {/* 이름 */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="rounded-full flex items-center justify-center text-white flex-shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      background: u.isActive ? '#3f2c80' : '#9490a0',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {u.name[0]}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>
                      {u.name}
                    </span>
                    {u.evaluationExempt && (
                      <span
                        title={u.evaluationExemptReason ?? '평가 대상에서 제외됨'}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#7d5700',
                          background: 'rgba(125,87,0,0.10)',
                          padding: '1px 7px',
                          borderRadius: 4,
                        }}
                      >
                        평가제외
                      </span>
                    )}
                  </div>
                </div>
                {/* 그룹/본부 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#191c1f' }}>
                    {r.group || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#797582', marginTop: 1 }}>
                    {r.division || '—'}
                  </div>
                </div>
                {/* 팀 */}
                <div style={{ fontSize: 12.5, color: '#484551' }}>{r.team || '—'}</div>
                {/* 직급 */}
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: positionColorFor(u.position),
                      background: 'rgba(202,196,210,0.25)',
                      padding: '2px 8px',
                      borderRadius: 5,
                    }}
                  >
                    {r.positionLabel}
                  </span>
                </div>
                {/* 재직 상태 뱃지 */}
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: emp.fg,
                      background: emp.bg,
                      padding: '2px 9px',
                      borderRadius: 999,
                    }}
                  >
                    {employmentStatusLabel[u.employmentStatus]}
                  </span>
                </div>
                {/* 이메일 */}
                <div style={{ fontSize: 12, color: '#605d67', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.email}
                </div>
                {/* 액션 — 활성/비활성 분기 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {u.isActive ? (
                    <>
                      <RowAction
                        onClick={() => setEditTarget(r)}
                        icon={<Edit2 size={12} />}
                        label="수정"
                        color="#0054ca"
                      />
                      <RowAction
                        onClick={() => void handleToggleExempt(r)}
                        icon={<Ban size={12} />}
                        label={r.user.evaluationExempt ? '평가포함' : '평가제외'}
                        color={r.user.evaluationExempt ? '#006c47' : '#605d67'}
                      />
                      <RowAction
                        onClick={() => setResignTarget(r)}
                        icon={<UserMinus size={12} />}
                        label="퇴사"
                        color="#7d5700"
                      />
                    </>
                  ) : (
                    <>
                      <RowAction
                        onClick={() => setReactivateTarget(r)}
                        icon={<UserCheck size={12} />}
                        label="복직"
                        color="#006c47"
                      />
                      <RowAction
                        onClick={() => {
                          setDeleteBlocked(null);
                          setDeleteTarget(r);
                        }}
                        icon={<Trash2 size={12} />}
                        label="삭제"
                        color="#484551"
                      />
                      <RowAction
                        onClick={() => {
                          setPurgeConfirm('');
                          setPurgeTarget(r);
                        }}
                        icon={<ShieldAlert size={12} />}
                        label="완전삭제"
                        color="#ba1a1a"
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <UserForm
          title="사용자 추가"
          initial={emptyForm()}
          org={org}
          positions={activePositions}
          saving={saving}
          onSave={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 수정 폼 */}
      {editTarget && (
        <UserForm
          title="사용자 수정"
          initial={rowToForm(editTarget)}
          org={org}
          positions={activePositions}
          saving={saving}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* 퇴사 처리 확인 */}
      {resignTarget && (
        <LifecycleModal
          title="퇴사 처리할까요?"
          onCancel={() => setResignTarget(null)}
          confirmLabel="퇴사 처리"
          confirmColor={T.amber600}
          busy={lifecycleBusy}
          onConfirm={() => void handleResign()}
        >
          <p style={{ fontSize: 13, color: T.grey700, lineHeight: 1.7 }}>
            <strong>{resignTarget.user.name}</strong> (
            {resignTarget.team ||
              resignTarget.division ||
              resignTarget.group ||
              '소속 미지정'}{' '}
            · {resignTarget.positionLabel})을(를) 퇴사 처리합니다.
            <br />
            비활성으로 전환되어 로그인할 수 없게 되고, 평가 이력은 보존됩니다.
          </p>
        </LifecycleModal>
      )}

      {/* 복직 확인 */}
      {reactivateTarget && (
        <LifecycleModal
          title="복직 처리할까요?"
          onCancel={() => setReactivateTarget(null)}
          confirmLabel="복직 처리"
          confirmColor={T.green600}
          busy={lifecycleBusy}
          onConfirm={() => void handleReactivate()}
        >
          <p style={{ fontSize: 13, color: T.grey700, lineHeight: 1.7 }}>
            <strong>{reactivateTarget.user.name}</strong>님을 다시 활성 상태로
            전환합니다. 재직 상태가 '재직'으로 바뀌고 로그인할 수 있어요.
          </p>
        </LifecycleModal>
      )}

      {/* 하드 삭제 — 409(이력)면 message 인라인 노출 + 완전 삭제 유도 */}
      {deleteTarget && (
        <LifecycleModal
          title="사용자를 삭제할까요?"
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteBlocked(null);
          }}
          confirmLabel={deleteBlocked ? '완전 삭제로 전환' : '삭제'}
          confirmColor={T.red500}
          busy={lifecycleBusy}
          onConfirm={
            deleteBlocked ? escalateToPurge : () => void handleDelete()
          }
        >
          <p style={{ fontSize: 13, color: T.grey700, lineHeight: 1.7 }}>
            <strong>{deleteTarget.user.name}</strong> (
            {deleteTarget.positionLabel}) 계정을 삭제합니다. 평가 이력이 없으면
            바로 삭제돼요.
          </p>
          {deleteBlocked && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                background: 'rgba(186,26,26,0.06)',
                border: '1px solid rgba(186,26,26,0.3)',
                borderRadius: 8,
                fontSize: 12.5,
                color: '#302e37',
                lineHeight: 1.6,
              }}
            >
              {/* 백엔드 message 그대로(평탄화 금지) */}
              {deleteBlocked}
              <br />
              <span style={{ color: '#ba1a1a', fontWeight: 600 }}>
                이력까지 지우려면 '완전 삭제로 전환'을 누르세요.
              </span>
            </div>
          )}
        </LifecycleModal>
      )}

      {/* 완전 삭제 — 빨강 강조 + 이름 입력 2단 확인 */}
      {purgeTarget && (
        <LifecycleModal
          title="이력까지 완전 삭제할까요?"
          onCancel={() => {
            setPurgeTarget(null);
            setPurgeConfirm('');
          }}
          confirmLabel="완전 삭제"
          confirmColor={T.red500}
          busy={lifecycleBusy}
          disabled={purgeConfirm.trim() !== purgeTarget.user.name}
          onConfirm={() => void handlePurge()}
        >
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(186,26,26,0.06)',
              border: '1px solid rgba(186,26,26,0.3)',
              borderRadius: 8,
              fontSize: 12.5,
              color: '#302e37',
              lineHeight: 1.65,
            }}
          >
            <strong style={{ color: '#ba1a1a' }}>되돌릴 수 없는 작업이에요.</strong>{' '}
            <strong>{purgeTarget.user.name}</strong>님의 평가 이력(결과·KPI·보상
            등)이 함께 영구 삭제되고,{' '}
            <strong>연도 비교(YoY)에서도 사라집니다.</strong>
          </div>
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.grey800,
                display: 'block',
                marginBottom: 6,
              }}
            >
              확인을 위해 이름{' '}
              <span style={{ color: T.red500 }}>“{purgeTarget.user.name}”</span>{' '}
              을(를) 입력하세요.
            </label>
            <input
              value={purgeConfirm}
              onChange={(e) => setPurgeConfirm(e.target.value)}
              placeholder={purgeTarget.user.name}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${T.grey200}`,
                fontSize: 13,
                outline: 'none',
                background: '#fff',
              }}
            />
          </div>
        </LifecycleModal>
      )}

      {/* 조직 노드 추가/이름변경 */}
      <OrgNodeModal
        open={nodeModalOpen}
        mode={nodeModalMode}
        parentNode={nodeParent}
        targetNode={nodeTarget}
        onClose={() => {
          setNodeModalOpen(false);
          setNodeParent(null);
          setNodeTarget(null);
        }}
        onSubmit={submitNode}
      />

      {/* 부서장 평가 재배정 확인 */}
      <Modal
        open={confirmReassign}
        onClose={() => {
          if (!reassignBusy) setConfirmReassign(false);
        }}
        title="부서장 평가를 재배정할까요?"
        primaryAction={{
          label: '재배정',
          loading: reassignBusy,
          disabled: reassignBusy,
          onClick: () => void handleReassignOrg(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmReassign(false) }}
      >
        <div className="space-y-2">
          <p>
            아직 시작하지 않은 부서장 평가 배정을 초기화하고,{' '}
            <b style={{ color: T.grey900 }}>현재 팀장·본부장 권한</b> 기준으로 다시
            배정해요. 조직(소속·팀장)을 바꾼 뒤 사용하세요.
          </p>
          <p style={{ color: T.grey600, fontSize: 12.5 }}>
            진행중·제출·확정된 평가는 그대로 보존돼요.
            {!cycleId && (
              <span style={{ color: T.red500 }}> · 활성 평가 주기가 없어요.</span>
            )}
          </p>
        </div>
      </Modal>

      {/* 조직 노드 삭제 확인 */}
      <Modal
        open={nodeDeleteTarget !== null}
        onClose={() => setNodeDeleteTarget(null)}
        title="조직을 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          loading: nodeDeleting,
          onClick: () => void confirmDeleteNode(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setNodeDeleteTarget(null) }}
      >
        {nodeDeleteTarget?.name} 을(를) 삭제하면 되돌릴 수 없어요. 구성원이나 하위
        조직이 있으면 삭제할 수 없으니, 먼저 옮기거나 비워 주세요.
      </Modal>

      {/* 직급 추가/수정 */}
      {posModalOpen && (
        <PositionModal
          target={posEditTarget}
          onSave={submitPosition}
          onCancel={() => {
            setPosModalOpen(false);
            setPosEditTarget(null);
          }}
        />
      )}

      {/* 직급 삭제 확인 */}
      <Modal
        open={posDeleteTarget !== null}
        onClose={() => setPosDeleteTarget(null)}
        title="직급을 삭제할까요?"
        primaryAction={{
          label: '삭제',
          variant: 'danger',
          loading: posDeleting,
          onClick: () => void confirmDeletePosition(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setPosDeleteTarget(null) }}
      >
        “{posDeleteTarget?.label}” 직급을 삭제하면 되돌릴 수 없어요. 이 직급을
        쓰는 사용자가 있으면 삭제할 수 없으니, 먼저 직급을 변경해 주세요.
      </Modal>
    </PageContainer>
  );
}
