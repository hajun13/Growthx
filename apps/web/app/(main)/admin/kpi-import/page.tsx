'use client';

// 개인별 KPI 엑셀 일괄 임포트(관리자 전용).
// 흐름(kpi-import-contract.md §5):
//   1) 다중 .xlsx 드래그&드롭 → 파일 목록(행).
//   2) 행마다: 파일명 / 대상자 선택(검색형 콤보) / 미리보기 / 상태.
//   3) 미리보기 = POST /excel/import/kpi/preview → 파싱 KPI 표 + 가중치합/오류.
//   4) 파일별 [적재] 또는 [전체 적재] = POST /excel/import/kpi?userId&cycleId (draft 생성).
//   5) 결과 요약(파일별 imported/오류/경고) + 검토 경로 안내.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  Eye,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Plus,
  Send,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { ApiError, apiPost } from '@/lib/api';
import { uploadExcel } from '@/lib/excel';
import { InfoBanner } from '@/components/InfoBanner';
import { UserCombobox } from '@/components/UserCombobox';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { kpiCategoryLabel, kpiGroupLabel, cycleStatusText } from '@/lib/ui';
import { T } from '@/lib/toss';
import type {
  User,
  KpiImportPreview,
  KpiImportResult,
  KpiImportRow,
  KpiImportCommitRow,
  KpiImportCommitRequest,
  KpiImportSubmitResult,
  KpiCategory,
  KpiGroup,
  Grade,
} from '@/lib/types';

const MAX_MB = 5;
const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 카테고리↔그룹 매핑(작성 화면과 동일). 카테고리 변경 시 그룹을 자동 결정.
const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};
const ALL_CATEGORIES: KpiCategory[] = [
  'revenue',
  'construction',
  'orders',
  'collaboration',
  'development',
];
function groupOfCategory(category: KpiCategory): KpiGroup {
  return CATEGORY_BY_GROUP.performance_core.includes(category)
    ? 'performance_core'
    : 'collaboration_growth';
}

// 빈 등급기준.
const EMPTY_CRITERIA = { S: null, A: null, B: null, C: null, D: null };

// 화면에서 새로 추가하는 빈 행(엑셀에 없는 항목 보완용).
function blankRow(): KpiImportRow {
  return {
    category: 'revenue',
    group: 'performance_core',
    csf: null,
    title: '',
    targetText: null,
    measureMethod: null,
    weight: null,
    isQualitative: false,
    gradingCriteria: { ...EMPTY_CRITERIA },
    valid: false,
    message: null,
  };
}

// 엑셀 복붙 대상 텍스트 셀 시퀀스(그리드 시각 순서). 분류(select)·구분(toggle)은 제외 —
// 붙여넣기는 텍스트 입력 셀에서 시작해 오른쪽·아래로 채운다.
const PASTE_FIELDS = [
  'csf',
  'title',
  'targetText',
  'measureMethod',
  'weight',
  'S',
  'A',
  'B',
  'C',
  'D',
] as const;

// 붙여넣기 셀 1개를 행에 적용(필드별 파싱). 빈 문자열은 해당 필드 비움.
function applyPasteCell(row: KpiImportRow, field: string, raw: string): KpiImportRow {
  const v = raw.trim();
  switch (field) {
    case 'csf':
      return { ...row, csf: v || null };
    case 'title':
      return { ...row, title: v };
    case 'targetText':
      return { ...row, targetText: v || null };
    case 'measureMethod':
      return { ...row, measureMethod: v || null };
    case 'weight': {
      if (v === '') return { ...row, weight: null };
      const n = Math.trunc(Number(v.replace(/[^0-9.-]/g, '')));
      return Number.isNaN(n) ? row : { ...row, weight: Math.max(0, Math.min(100, n)) };
    }
    case 'S':
    case 'A':
    case 'B':
    case 'C':
    case 'D': {
      const base = row.gradingCriteria ?? { ...EMPTY_CRITERIA };
      return { ...row, gradingCriteria: { ...base, [field]: v === '' ? null : v } };
    }
    default:
      return row;
  }
}

// 파일 1개의 화면 상태.
type RowStatus =
  | 'idle'
  | 'previewing'
  | 'previewed'
  | 'importing'
  | 'imported'
  | 'submitting'
  | 'submitted'
  | 'error';
interface FileEntry {
  key: string; // 안정 키(이름+크기+추가시각)
  file: File;
  userId: string | null;
  suggestedId: string | null; // 파일명 추정 후보(편의)
  status: RowStatus;
  preview: KpiImportPreview | null;
  editedRows: KpiImportRow[] | null; // 미리보기 결과를 관리자가 편집한 상태(편집 가능한 그리드의 소스)
  result: KpiImportResult | null;
  errorMessage: string | null;
}

// 파일명에서 한글 이름(2~4자)을 추정. 직급 토큰(선임/책임/프로/팀장/본부장 등)을 떼고,
// 활성 사용자 이름과 일치하는 후보를 찾는다. 실패해도 동작에 영향 없음(편의 기능).
function guessUserId(fileName: string, users: User[]): string | null {
  const base = fileName.replace(/\.[^.]+$/, '');
  // 괄호/숫자/언더스코어/대시 제거 후 토큰화.
  const cleaned = base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[_\-]/g, ' ')
    .replace(/\d+/g, ' ');
  // 사용자 이름이 파일명에 통째로 포함되는지 우선 검사(가장 안전).
  for (const u of users) {
    if (u.name && cleaned.includes(u.name)) return u.id;
  }
  // 직급 접미사를 뗀 이름(예: '어라윤선임' → '어라윤')도 시도.
  const POS_SUFFIX = ['대표이사', '본부장', '팀장', '책임', '선임', '프로', '사원', '님'];
  for (const u of users) {
    if (!u.name) continue;
    for (const suf of POS_SUFFIX) {
      if (cleaned.includes(u.name + suf)) return u.id;
    }
  }
  return null;
}

function StatusBadge({ entry }: { entry: FileEntry }) {
  const map: Record<RowStatus, { label: string; color: string; bg: string; Icon?: typeof Eye }> = {
    idle: { label: '대기', color: T.grey600, bg: T.grey100 },
    previewing: { label: '미리보기 중', color: T.blue600, bg: '#eaf2ff', Icon: Loader2 },
    previewed: { label: '확인됨', color: T.grey700, bg: T.grey100, Icon: CheckCircle2 },
    importing: { label: '적재 중', color: T.blue600, bg: '#eaf2ff', Icon: Loader2 },
    imported: { label: '적재 완료', color: T.green500, bg: '#e6f9f2', Icon: CheckCircle2 },
    submitting: { label: '제출 중', color: T.blue600, bg: '#eaf2ff', Icon: Loader2 },
    submitted: { label: '제출 완료', color: '#059669', bg: '#e6f9f2', Icon: CheckCircle2 },
    error: { label: '오류', color: T.red500, bg: '#fef2f2', Icon: AlertTriangle },
  };
  const s = map[entry.status];
  const spin = entry.status === 'previewing' || entry.status === 'importing' || entry.status === 'submitting';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {s.Icon && <s.Icon size={12} className={spin ? 'animate-spin' : undefined} />}
      {s.label}
    </span>
  );
}

// 정성/정량 세그먼트 토글(작성 화면 QualToggle 과 동일 톤 — 정성=퍼플 #7c3aed, 정량=블루).
function QualToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const seg = (active: boolean, accent: string): React.CSSProperties => ({
    flex: 1,
    padding: '4px 6px',
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.3,
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    outline: 'none',
    background: active ? accent : '#fff',
    color: active ? '#fff' : T.grey500,
    transition: 'background 0.12s, color 0.12s',
  });
  return (
    <div
      role="group"
      aria-label="정성/정량 구분"
      style={{
        display: 'flex',
        width: 84,
        border: `1px solid ${T.grey200}`,
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button type="button" aria-pressed={!value} disabled={disabled} onClick={() => onChange(false)} style={seg(!value, T.blue500)}>
        정량
      </button>
      <button
        type="button"
        aria-pressed={value}
        disabled={disabled}
        onClick={() => onChange(true)}
        style={{ ...seg(value, '#7c3aed'), borderLeft: `1px solid ${T.grey200}` }}
      >
        정성
      </button>
    </div>
  );
}

// 편집 가능한 미리보기 그리드 — 셀마다 인라인 입력. 관리자가 정성/정량 토글·빈 칸 채움·행 추가/삭제 가능.
function EditableGrid({
  rows,
  onChange,
  readOnly,
}: {
  rows: KpiImportRow[];
  onChange: (rows: KpiImportRow[]) => void;
  readOnly?: boolean;
}) {
  // 편집된 행 기준 실시간 집계(빈 title 제외).
  const filled = rows.filter((r) => r.title.trim().length > 0);
  const weightSum = filled.reduce((s, r) => s + (r.weight ?? 0), 0);
  const qualWeight = filled
    .filter((r) => r.isQualitative)
    .reduce((s, r) => s + (r.weight ?? 0), 0);
  const weightOff = weightSum !== 100;
  const qualHigh = qualWeight > 30;

  function patchRow(idx: number, patch: Partial<KpiImportRow>) {
    onChange(
      rows.map((r, i) => {
        if (i !== idx) return r;
        const merged = { ...r, ...patch };
        // 카테고리 변경 시 그룹 자동 매핑(작성 화면 규칙과 일치).
        if (patch.category) merged.group = groupOfCategory(patch.category);
        return merged;
      }),
    );
  }
  function patchCriteria(idx: number, grade: Grade, value: string) {
    onChange(
      rows.map((r, i) => {
        if (i !== idx) return r;
        const base = r.gradingCriteria ?? { ...EMPTY_CRITERIA };
        return { ...r, gradingCriteria: { ...base, [grade]: value === '' ? null : value } };
      }),
    );
  }
  function addRow() {
    onChange([...rows, blankRow()]);
  }
  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  // 엑셀 복붙 — 텍스트 셀(data-row/data-field)에서 TSV 붙여넣기. 행은 \n, 열은 \t.
  // 시작 셀 기준 오른쪽·아래로 채우고, 부족한 행은 자동 추가. 단일 셀은 기본 붙여넣기 허용.
  function handlePaste(e: React.ClipboardEvent<HTMLTableElement>) {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    const rowAttr = target.getAttribute('data-row');
    const fieldAttr = target.getAttribute('data-field');
    if (rowAttr === null || fieldAttr === null) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    // 단일 셀(탭·줄바꿈 없음)이면 입력칸 기본 붙여넣기에 맡긴다.
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const startRow = Number(rowAttr);
    const startField = Number(fieldAttr);
    const matrix = text
      .replace(/\r/g, '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => line.split('\t'));
    const next = rows.slice();
    for (let r = 0; r < matrix.length; r++) {
      const targetIdx = startRow + r;
      while (next.length <= targetIdx) next.push(blankRow());
      let updated = next[targetIdx];
      const cells = matrix[r];
      for (let c = 0; c < cells.length; c++) {
        const field = PASTE_FIELDS[startField + c];
        if (!field) continue;
        updated = applyPasteCell(updated, field, cells[c]);
      }
      next[targetIdx] = updated;
    }
    onChange(next);
  }

  return (
    <div style={{ border: `1px solid ${T.grey200}`, marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: T.grey50,
          borderBottom: `1px solid ${T.grey200}`,
        }}
      >
        <h4 style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>
          미리보기 편집 — {rows.length}개 지표
        </h4>
        {!readOnly && (
          <span style={{ fontSize: 11, color: T.grey500 }}>
            엑셀에서 셀을 복사해 칸에 붙여넣을 수 있어요(여러 셀·행 가능 · 순서: CSF→KPI→2026목표→측정방식→가중치→등급 S~D)
          </span>
        )}
        {/* 정성 비중(advisory ≤30%) — 정성=퍼플로 화면 간 색 의미 통일 */}
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: qualHigh ? '#7c3aed' : T.grey600,
            background: qualHigh ? '#f3e8ff' : T.grey100,
            padding: '2px 8px',
          }}
          title="정성 KPI 가중치 합(권장 30% 이하)"
        >
          정성 비중 {qualWeight}%
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11.5,
            fontWeight: 600,
            color: weightOff ? '#b45309' : T.grey700,
            background: weightOff ? '#fffbeb' : T.grey100,
            padding: '2px 8px',
          }}
        >
          가중치 합 {weightSum}%{weightOff ? ' (100% 아님)' : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}
          onPaste={handlePaste}
        >
          <thead>
            <tr style={{ background: '#fff', color: T.grey600, borderBottom: `1px solid ${T.grey200}` }}>
              <th style={thStyle(130)}>분류</th>
              <th style={thStyle(180)}>전략목표(CSF)</th>
              <th style={thStyle(200)}>KPI</th>
              <th style={thStyle(170)}>2026 목표</th>
              <th style={thStyle(150)}>측정방식</th>
              <th style={thStyle(92)}>구분</th>
              <th style={{ ...thStyle(64), textAlign: 'right' }}>가중치</th>
              {GRADES.map((g) => (
                <th key={g} style={thStyle(120)}>등급 {g}</th>
              ))}
              <th style={thStyle(36)} aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const emptyTitle = row.title.trim().length === 0;
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: `1px solid ${T.grey100}`,
                    background: emptyTitle ? '#fffbeb' : '#fff',
                  }}
                >
                  {/* 분류 — 카테고리 select(그룹 자동 매핑). 그룹 라벨 함께 표기. */}
                  <td style={tdStyle}>
                    <select
                      value={row.category}
                      disabled={readOnly}
                      onChange={(e) => patchRow(i, { category: e.target.value as KpiCategory })}
                      style={cellSelect}
                    >
                      {ALL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {kpiCategoryLabel[c]}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10, color: T.grey500, marginTop: 3 }}>
                      {kpiGroupLabel[row.group]}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-row={i}
                      data-field={0}
                      value={row.csf ?? ''}
                      disabled={readOnly}
                      placeholder="전략목표"
                      onChange={(e) => patchRow(i, { csf: e.target.value === '' ? null : e.target.value })}
                      style={cellInput}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-row={i}
                      data-field={1}
                      value={row.title}
                      disabled={readOnly}
                      placeholder="KPI 명(필수)"
                      onChange={(e) => patchRow(i, { title: e.target.value })}
                      style={{
                        ...cellInput,
                        borderColor: emptyTitle ? '#f0b429' : T.grey200,
                      }}
                    />
                    {emptyTitle && (
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>
                        비어 있는 행은 적재되지 않아요
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-row={i}
                      data-field={2}
                      value={row.targetText ?? ''}
                      disabled={readOnly}
                      placeholder="2026 목표"
                      onChange={(e) =>
                        patchRow(i, { targetText: e.target.value === '' ? null : e.target.value })
                      }
                      style={cellInput}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      data-row={i}
                      data-field={3}
                      value={row.measureMethod ?? ''}
                      disabled={readOnly}
                      placeholder="측정방식"
                      onChange={(e) =>
                        patchRow(i, { measureMethod: e.target.value === '' ? null : e.target.value })
                      }
                      style={cellInput}
                    />
                  </td>
                  <td style={tdStyle}>
                    <QualToggle
                      value={row.isQualitative}
                      disabled={readOnly}
                      onChange={(v) => patchRow(i, { isQualitative: v })}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <input
                      data-row={i}
                      data-field={4}
                      type="number"
                      min={0}
                      max={100}
                      value={row.weight ?? ''}
                      disabled={readOnly}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchRow(i, { weight: v === '' ? null : Math.trunc(Number(v)) });
                      }}
                      style={{ ...cellInput, width: 52, textAlign: 'right' }}
                    />
                  </td>
                  {GRADES.map((g) => (
                    <td key={g} style={tdStyle}>
                      <input
                        data-row={i}
                        data-field={5 + GRADES.indexOf(g)}
                        value={row.gradingCriteria?.[g] ?? ''}
                        disabled={readOnly}
                        placeholder={`등급 ${g}`}
                        onChange={(e) => patchCriteria(i, g, e.target.value)}
                        style={cellInput}
                      />
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => removeRow(i)}
                      aria-label="행 삭제"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: readOnly ? 'not-allowed' : 'pointer',
                        padding: 2,
                        color: T.grey400,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div style={{ borderTop: `1px solid ${T.grey200}`, padding: '8px 14px', background: '#fff' }}>
          <button
            type="button"
            onClick={addRow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              fontWeight: 600,
              color: T.blue600,
              background: '#fff',
              border: `1px solid ${T.grey300}`,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <Plus size={13} /> 행 추가
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = (w: number): React.CSSProperties => ({
  textAlign: 'left',
  padding: '7px 10px',
  fontWeight: 600,
  minWidth: w,
});
const tdStyle: React.CSSProperties = { padding: '7px 8px', verticalAlign: 'top' };
const cellInput: React.CSSProperties = {
  width: '100%',
  fontSize: 11.5,
  color: T.grey900,
  border: `1px solid ${T.grey200}`,
  background: '#fff',
  padding: '5px 7px',
  outline: 'none',
};
const cellSelect: React.CSSProperties = {
  ...cellInput,
  fontWeight: 600,
  cursor: 'pointer',
};

// 적재 결과 카드(파일별 요약).
function ResultCard({ entry }: { entry: FileEntry }) {
  const r = entry.result;
  if (!r) return null;
  return (
    <div
      style={{
        border: `1px solid ${r.ok ? '#b6e6cc' : '#fbe2ae'}`,
        background: r.ok ? '#e7f8ef' : '#fef8ea',
        padding: '10px 14px',
        marginTop: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: r.ok ? '#0b7544' : '#8a5a00' }}>
          {r.imported}개 지표를 {entry.status === 'submitted' ? '적재·제출했어요 (submitted)' : '적재했어요 (draft)'}
        </span>
        {r.deletedDrafts > 0 && (
          <span style={{ fontSize: 11.5, color: T.grey600 }}>
            기존 draft {r.deletedDrafts}개 교체
          </span>
        )}
        <span style={{ fontSize: 11.5, color: T.grey600 }}>가중치 합 {r.weightSum}%</span>
        <Link
          href="/kpi/review"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11.5,
            fontWeight: 600,
            color: T.blue600,
            textDecoration: 'none',
          }}
        >
          KPI 검토로 이동 <ArrowRight size={12} />
        </Link>
      </div>
      {r.warnings.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 16, listStyle: 'disc' }}>
          {r.warnings.map((w, i) => (
            <li key={i} style={{ fontSize: 11.5, color: '#8a5a00' }}>{w}</li>
          ))}
        </ul>
      )}
      {r.errors.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 16, listStyle: 'disc' }}>
          {r.errors.map((e, i) => (
            <li key={`${e.row}-${i}`} style={{ fontSize: 11.5, color: T.red500 }}>
              {e.row}행: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function KpiImportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const allowed = !!user && isHrAdmin(user.role);

  // 활성 사이클(적재 시 cycleId — 생략 시 백엔드가 활성 사이클 사용하나 명시 전달).
  const { current, loading: cycleLoading } = useCurrentCycle();
  const cycleId = current?.id ?? null;

  // 대상자 드롭다운용 활성 사용자 목록(기존 useUsers — apiGetList 봉투 unwrap).
  const { data: usersData, loading: usersLoading } = useUsers(
    { pageSize: 500 },
    { enabled: allowed },
  );
  const users = useMemo<User[]>(
    () => (usersData?.data ?? []).filter((u) => u.isActive),
    [usersData],
  );

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: FileEntry[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast.show({ variant: 'danger', message: `${file.name}: .xlsx 파일만 올릴 수 있어요.` });
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.show({ variant: 'danger', message: `${file.name}: 최대 ${MAX_MB}MB까지 올릴 수 있어요.` });
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        userId: guessUserId(file.name, users),
        suggestedId: guessUserId(file.name, users),
        status: 'idle',
        preview: null,
        editedRows: null,
        result: null,
        errorMessage: null,
      });
    }
    if (next.length > 0) setEntries((prev) => [...prev, ...next]);
  }

  function patchEntry(key: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  // 편집 그리드의 행 변경을 반영(미리보기 후에만 호출).
  function patchEditedRows(key: string, rows: KpiImportRow[]) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, editedRows: rows } : e)));
  }
  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  }

  // 파싱 미리보기 → editedRows 채움. 성공 시 파싱된 행을 반환(자동 미리보기→적재 체인용).
  async function doPreview(entry: FileEntry): Promise<KpiImportRow[] | null> {
    patchEntry(entry.key, { status: 'previewing', errorMessage: null });
    try {
      const preview = await uploadExcel<KpiImportPreview>(
        '/excel/import/kpi/preview',
        entry.file,
      );
      // 백엔드가 제안한 isQualitative 포함 — 깊은 복사로 편집 상태 분리.
      const editedRows = preview.rows.map((r) => ({
        ...r,
        gradingCriteria: r.gradingCriteria ? { ...r.gradingCriteria } : null,
      }));
      patchEntry(entry.key, { status: 'previewed', preview, editedRows });
      return editedRows;
    } catch (err) {
      patchEntry(entry.key, {
        status: 'error',
        errorMessage: err instanceof ApiError ? err.message : '미리보기에 실패했어요.',
      });
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '미리보기에 실패했어요.',
      });
      return null;
    }
  }

  // 편집된 행(빈 title 제외)을 commit row 로 매핑.
  function toCommitRows(rows: KpiImportRow[]): KpiImportCommitRow[] {
    return rows
      .filter((r) => r.title.trim().length > 0)
      .map((r) => ({
        category: r.category,
        group: r.group,
        csf: r.csf,
        title: r.title.trim(),
        targetText: r.targetText,
        measureMethod: r.measureMethod,
        weight: Math.max(0, Math.min(100, Math.trunc(r.weight ?? 0))),
        isQualitative: r.isQualitative,
        gradingCriteria: r.gradingCriteria,
      }));
  }

  // 편집된 행을 commit 엔드포인트(JSON)로 적재. 미리보기 전이면 자동 파싱 후 적재.
  async function doImport(entry: FileEntry): Promise<boolean> {
    if (!entry.userId) {
      toast.show({ variant: 'danger', message: `${entry.file.name}: 대상자를 먼저 선택해 주세요.` });
      return false;
    }
    // 아직 미리보기를 안 한 파일은 자동으로 파싱해 editedRows 를 채운다.
    let rows = entry.editedRows;
    if (!rows) {
      rows = await doPreview(entry);
      if (!rows) return false; // 파싱 실패 시 중단(에러 상태/토스트는 doPreview 가 처리).
    }
    const commitRows = toCommitRows(rows);
    if (commitRows.length === 0) {
      patchEntry(entry.key, { status: 'error', errorMessage: 'KPI 명이 채워진 행이 없어요.' });
      toast.show({ variant: 'danger', message: `${entry.file.name}: 적재할 행이 없어요.` });
      return false;
    }
    patchEntry(entry.key, { status: 'importing', errorMessage: null });
    try {
      const body: KpiImportCommitRequest = {
        userId: entry.userId,
        cycleId: cycleId ?? undefined,
        fileName: entry.file.name,
        rows: commitRows,
      };
      const result = await apiPost<KpiImportResult>('/excel/import/kpi/commit', body);
      patchEntry(entry.key, { status: 'imported', result });
      return true;
    } catch (err) {
      patchEntry(entry.key, {
        status: 'error',
        errorMessage: err instanceof ApiError ? err.message : '적재에 실패했어요.',
      });
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '적재에 실패했어요.',
      });
      return false;
    }
  }

  const [bulkBusy, setBulkBusy] = useState(false);
  async function importAll() {
    // 대상자 선택된 + 아직 적재 안 된 행만 순차 적재.
    const targets = entries.filter(
      (e) => e.userId && e.status !== 'imported' && e.status !== 'importing',
    );
    if (targets.length === 0) {
      toast.show({ variant: 'info', message: '적재할 파일이 없어요. 대상자를 선택했는지 확인해 주세요.' });
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const e of targets) {
      // 최신 상태 참조(patchEntry 는 비동기 setState 라 entry 스냅샷의 userId 로 충분).
      const success = await doImport(e);
      if (success) ok += 1;
    }
    setBulkBusy(false);
    toast.show({
      variant: ok === targets.length ? 'success' : 'info',
      message: `${ok}/${targets.length}개 파일을 적재했어요.`,
    });
  }

  // 2단계 제출 — 적재(draft) 후 대상자의 draft KPI를 submitted 로 전환.
  // 가중치 합 100% 등 본인 제출과 동일 검증(미달 시 서버가 거부).
  async function doSubmit(entry: FileEntry) {
    if (!entry.userId) return;
    patchEntry(entry.key, { status: 'submitting', errorMessage: null });
    try {
      const res = await apiPost<KpiImportSubmitResult>('/excel/import/kpi/submit', {
        userId: entry.userId,
        cycleId: cycleId ?? undefined,
      });
      patchEntry(entry.key, { status: 'submitted' });
      toast.show({ variant: 'success', message: `${res.submitted}개 KPI를 제출했어요.` });
    } catch (err) {
      patchEntry(entry.key, {
        status: 'error',
        errorMessage: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '제출에 실패했어요.',
      });
    }
  }

  if (!allowed) return <Forbidden message="KPI 일괄 등록은 HR만 접근할 수 있어요." />;
  if (cycleLoading) return <Skeleton className="h-64 w-full" />;

  const selectedCount = entries.filter((e) => e.userId).length;
  const importedCount = entries.filter((e) => e.status === 'imported').length;

  return (
    <PageContainer>
      <PageHeader
        title="KPI 일괄 등록"
        subtitle="회사 표준 KPI 엑셀 양식(1인 1파일)을 올려 개인별 KPI를 한 번에 등록합니다."
      />

      {/* 활성 사이클 안내 */}
      {current ? (
        <InfoBanner tone="info">
          적재 대상 평가 주기는 <b>{current.name}</b>(
          {cycleStatusText(current.status)})예요. 시트에는 이름이 없으니 파일마다 대상자를
          직접 선택해 주세요. <b>미리보기에서 정성/정량과 내용을 검토·수정한 뒤 적재하세요.
          빠진 항목은 직접 채우거나 행을 추가할 수 있어요.</b> 적재된 KPI는{' '}
          <b>draft(임시저장)</b> 상태로 생성되며, 같은 대상자·주기로 다시 올리면 기존 draft를
          교체해요(제출·승인된 KPI는 보존). 적재 후 나타나는 <b>[제출]</b> 버튼으로 바로 제출할 수
          있어요(가중치 합 100% 필요).
        </InfoBanner>
      ) : (
        <InfoBanner tone="warning" title="활성 평가 주기가 없어요">
          평가 운영에서 평가 주기를 먼저 만들고 활성화한 뒤 KPI를 등록해 주세요.
        </InfoBanner>
      )}

      {/* 드롭존(다중) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          border: `2px dashed ${dragOver ? T.blue500 : T.grey300}`,
          background: dragOver ? '#f0f6ff' : T.grey50,
          padding: '32px 20px',
          textAlign: 'center',
        }}
      >
        <UploadCloud size={30} color={T.grey400} />
        <p style={{ fontSize: 13, color: T.grey800 }}>
          여러 개의 .xlsx 파일을 끌어다 놓거나
        </p>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: T.grey800,
            background: '#fff',
            border: `1px solid ${T.grey300}`,
            padding: '7px 14px',
            cursor: 'pointer',
          }}
        >
          파일 선택
          <input
            type="file"
            accept=".xlsx"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <p style={{ fontSize: 11.5, color: T.grey500 }}>.xlsx · 파일당 최대 {MAX_MB}MB · 다중 선택 가능</p>
      </div>

      {/* 파일 목록 */}
      {entries.length > 0 && (
        <div style={{ border: `1px solid ${T.grey200}`, background: '#fff' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '12px 16px',
              borderBottom: `1px solid ${T.grey200}`,
              background: T.grey50,
            }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
              파일 {entries.length}개
            </h3>
            <span style={{ fontSize: 11.5, color: T.grey600 }}>
              대상자 선택 {selectedCount} · 적재 완료 {importedCount}
            </span>
            <button
              type="button"
              onClick={() => void importAll()}
              disabled={bulkBusy || selectedCount === 0 || !!cycleLoading}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                background: bulkBusy || selectedCount === 0 ? T.grey400 : T.blue500,
                border: 'none',
                padding: '8px 16px',
                cursor: bulkBusy || selectedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Upload size={14} /> {bulkBusy ? '적재 중…' : '전체 적재'}
            </button>
          </div>

          <div>
            {entries.map((entry) => (
              <div key={entry.key} style={{ borderBottom: `1px solid ${T.grey100}`, padding: '14px 16px' }}>
                {/* 행 헤더: 파일명 / 대상자 / 미리보기 / 적재 / 상태 / 삭제 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900, flex: '1 1 220px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={entry.file.name}
                  >
                    {entry.file.name}
                  </span>

                  <UserCombobox
                    users={users}
                    value={entry.userId}
                    suggestedId={entry.suggestedId}
                    disabled={usersLoading || entry.status === 'importing'}
                    onChange={(id) => patchEntry(entry.key, { userId: id })}
                  />

                  <button
                    type="button"
                    onClick={() => void doPreview(entry)}
                    disabled={entry.status === 'previewing' || entry.status === 'importing'}
                    style={btnSecondary(entry.status === 'previewing' || entry.status === 'importing')}
                  >
                    <Eye size={13} /> 미리보기
                  </button>

                  <button
                    type="button"
                    onClick={() => void doImport(entry)}
                    disabled={!entry.userId || entry.status === 'importing'}
                    style={btnPrimary(!entry.userId || entry.status === 'importing')}
                  >
                    <Upload size={13} /> 적재
                  </button>

                  {/* 2단계: 적재 완료 후 제출 버튼 노출 */}
                  {entry.status === 'imported' && (
                    <button
                      type="button"
                      onClick={() => void doSubmit(entry)}
                      style={btnPrimary(false)}
                    >
                      <Send size={13} /> 제출
                    </button>
                  )}

                  <StatusBadge entry={entry} />

                  <button
                    type="button"
                    onClick={() => removeEntry(entry.key)}
                    disabled={entry.status === 'importing'}
                    aria-label="파일 제거"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: T.grey400 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {entry.errorMessage && (
                  <p style={{ fontSize: 11.5, color: T.red500, marginTop: 6 }}>{entry.errorMessage}</p>
                )}

                {/* 편집 가능한 미리보기 그리드 — 적재/제출 완료 후에는 숨김 */}
                {entry.editedRows &&
                  entry.status !== 'imported' &&
                  entry.status !== 'submitting' &&
                  entry.status !== 'submitted' && (
                    <EditableGrid
                      rows={entry.editedRows}
                      onChange={(rows) => patchEditedRows(entry.key, rows)}
                      readOnly={entry.status === 'importing'}
                    />
                  )}

                {/* 적재 결과 */}
                <ResultCard entry={entry} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

const btnSecondary = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: T.grey800,
  background: '#fff',
  border: `1px solid ${T.grey300}`,
  padding: '7px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});
const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  background: disabled ? T.grey400 : T.blue500,
  border: 'none',
  padding: '7px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
});
