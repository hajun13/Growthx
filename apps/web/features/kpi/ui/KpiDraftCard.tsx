'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { GradeChip } from '@/components/GradeChip';
import { SegmentedControl } from '@/components/SegmentedControl';
import { gradeColor } from '@/lib/grade';
import type { Grade, KpiGroup, KpiCategory } from '@/lib/types';
import type { DraftKpi } from './types';

const GRADE_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;
type GradeKey = typeof GRADE_KEYS[number];

const GROUP_LABEL: Record<KpiGroup, string> = {
  performance_core: '성과중심',
  collaboration_growth: '협업·성장',
};

const GROUP_BG: Record<KpiGroup, string> = {
  performance_core: 'bg-primary text-primary-foreground',
  collaboration_growth: 'bg-foreground text-background',
};

const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};

function canUseAbsoluteAmount(d: Pick<DraftKpi, 'category' | 'isQualitative'>): boolean {
  return d.category === 'revenue' && !d.isQualitative;
}

// ─── DS-compliant 텍스트 입력 ─────────────────────────────────────
function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-none border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${props.className ?? ''}`}
    />
  );
}

function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-none border border-border bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${props.className ?? ''}`}
    />
  );
}

// ─── 폼 필드 래퍼 ────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-danger-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── 절대금액 토글 ────────────────────────────────────────────────
function AbsoluteAmountToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-none border p-3 transition-colors ${value ? 'border-primary bg-muted' : 'border-border bg-card'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="절대금액 기준 등급 사용"
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-[22px] w-10 flex-shrink-0 rounded-[4px] border transition-all ${value ? 'border-primary bg-primary' : 'border-border bg-muted'}`}
      >
        <span
          className="absolute top-[2px] h-4 w-4 rounded-[3px] bg-background shadow-none transition-all"
          style={{ left: value ? '20px' : '2px' }}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-foreground">
          절대금액 기준 등급
          <span className={`ml-2 text-[10.5px] font-bold ${value ? 'text-primary' : 'text-muted-foreground'}`}>
            {value ? '사용' : '미사용'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          {value
            ? '목표 대비 달성률 대신 실제 매출 절대금액으로 등급을 매겨요.'
            : '켜면 목표 대비 달성률 대신 실제 매출 절대금액으로 등급을 매겨요. 매출 정량 KPI에만 적용돼요.'}
        </p>
      </div>
    </div>
  );
}

// ─── 편집 모드: 단일 KPI 카드 ──────────────────────────────────
export function KpiDraftCard({
  index,
  draft: d,
  isGroupAllowed,
  onChange,
  onDelete,
}: {
  index: number;
  draft: DraftKpi;
  isGroupAllowed: (g: KpiGroup) => boolean;
  onChange: (patch: Partial<DraftKpi>) => void;
  onDelete: () => void;
}) {
  const showAbsolute = canUseAbsoluteAmount(d);

  const qualOptions = [
    { value: 'false', label: '정량' },
    { value: 'true', label: '정성' },
  ];

  const groupOptions = [
    { value: 'performance_core', label: `성과중심${!isGroupAllowed('performance_core') ? ' (불가)' : ''}` },
    { value: 'collaboration_growth', label: `협업·성장${!isGroupAllowed('collaboration_growth') ? ' (불가)' : ''}` },
  ];

  return (
    <div className="rounded-none overflow-hidden border border-border bg-card transition-colors hover:border-primary/25">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-muted border-b border-border/20">
        <span className="tabular-nums inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[4px] bg-primary text-[12px] font-bold text-primary-foreground">
          {index + 1}
        </span>

        {/* 그룹 셀렉트 — shadcn Select는 controlled값이 필요해 native select로 유지하되 DS 스타일 적용 */}
        <select
          value={d.group}
          onChange={(e) =>
            onChange({
              group: e.target.value as KpiGroup,
              category: CATEGORY_BY_GROUP[e.target.value as KpiGroup][0],
            })
          }
          className={`appearance-none rounded-none border-0 px-3 py-1.5 text-[12px] font-bold outline-none cursor-pointer ${GROUP_BG[d.group]}`}
          aria-label="KPI 그룹 선택"
        >
          {groupOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={!isGroupAllowed(opt.value as KpiGroup)} className="bg-card text-foreground font-normal">
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {/* 가중치 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">가중치</span>
          <FieldInput
            type="number"
            min={0}
            max={100}
            value={d.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
            placeholder="0"
            className="w-14 text-center py-1.5 font-bold text-[13px]"
          />
          <span className="text-[12px] text-muted-foreground">%</span>
        </div>

        <button
          onClick={onDelete}
          aria-label="KPI 삭제"
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      {/* 본문 필드 */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <Field label="성과관리지표 (KPI)" required>
            <FieldInput
              value={d.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="예) 신규 거래처 매출 달성"
            />
          </Field>
          <Field label="전략 목표 (CSF)">
            <FieldInput
              value={d.csf}
              onChange={(e) => onChange({ csf: e.target.value })}
              placeholder="예) 신규 시장 진출"
            />
          </Field>
          <Field label="2026년 목표">
            <FieldTextarea
              rows={2}
              value={d.targetText}
              onChange={(e) => onChange({ targetText: e.target.value })}
              placeholder="예) 신규 거래처 5곳 확보, 매출 120억 달성"
            />
          </Field>
          <Field label="측정방식">
            <FieldTextarea
              rows={2}
              value={d.measureMethod}
              onChange={(e) => onChange({ measureMethod: e.target.value })}
              placeholder="예) 분기별 실적 합산, 목표 대비 달성률"
            />
          </Field>
        </div>

        {/* 정성/정량 토글 */}
        <div className="flex flex-wrap items-center gap-3 mt-3.5">
          <span className="text-[11px] font-semibold text-muted-foreground flex-shrink-0">성과 구분</span>
          <SegmentedControl
            options={qualOptions}
            value={String(d.isQualitative)}
            onChange={(v) => onChange({ isQualitative: v === 'true' })}
            size="sm"
            ariaLabel="정성/정량 구분"
          />
          <span className="text-[11px] text-muted-foreground">
            {d.isQualitative ? '서술형 평가 · 권장 비중 ≤30%' : '수치 실적 기반 평가'}
          </span>
        </div>
      </div>

      {/* 등급 부여 기준 */}
      <div className="border-t border-border/20">
        <div className="px-4 pt-2.5 pb-1 bg-muted">
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            등급 부여 기준 (S / A / B / C / D)
          </span>
        </div>
        <div className="px-4 pb-4 bg-muted">
          {showAbsolute && (
            <AbsoluteAmountToggle
              value={d.useAbsoluteAmount}
              onChange={(v) => onChange({ useAbsoluteAmount: v })}
            />
          )}
          <div className="rounded-none overflow-hidden border border-border/50">
            {/* 헤더 행 */}
            <div className="grid grid-cols-5 bg-muted border-b border-border/20">
              {GRADE_KEYS.map((g) => (
                <div key={`hdr-${g}`} className={`flex items-center justify-center py-2 px-1 ${g !== 'D' ? 'border-r border-border/20' : ''}`}>
                  <GradeChip grade={g as Grade} size="sm" />
                </div>
              ))}
            </div>
            {/* 텍스트에어리어 행 */}
            <div className="grid grid-cols-5 bg-card">
              {GRADE_KEYS.map((g) => (
                <div key={`body-${g}`} className={`p-2 ${g !== 'D' ? 'border-r border-border/15' : ''}`}>
                  <FieldTextarea
                    value={d.gradingCriteria[g as GradeKey]}
                    onChange={(e) =>
                      onChange({
                        gradingCriteria: { ...d.gradingCriteria, [g]: e.target.value },
                      })
                    }
                    placeholder={`${g} 기준`}
                    rows={3}
                    className="text-[12px]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
