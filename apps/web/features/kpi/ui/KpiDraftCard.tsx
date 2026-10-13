'use client';

import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GradeChip } from '@/components/GradeChip';
import { cn } from '@/lib/utils';
import type { Grade, KpiGroup } from '@/lib/types';
import { CATEGORY_BY_GROUP } from './draft';
import type { DraftKpi } from './types';

const GRADE_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;
type GradeKey = typeof GRADE_KEYS[number];

const GROUP_OPTIONS: { value: KpiGroup; label: string }[] = [
  { value: 'performance_core', label: '성과중심' },
  { value: 'collaboration_growth', label: '협업·성장' },
];

const QUAL_OPTIONS = [
  { value: 'false', label: '정량' },
  { value: 'true', label: '정성' },
];

// ─── 폼 필드 래퍼 ────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-11 font-semibold text-muted-foreground">
        {label}
        {required && <span className="text-danger-600 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ─── 편집 모드: 단일 KPI 카드 ──────────────────────────────────
export function KpiDraftCard({
  index,
  draft: d,
  onChange,
  onDelete,
}: {
  index: number;
  draft: DraftKpi;
  onChange: (patch: Partial<DraftKpi>) => void;
  onDelete: () => void;
}) {
  // '[수정요청] 사유' 프리픽스는 원문 노출 대신 제목으로 승격(warning 톤), 나머지는 반려(danger 톤).
  const isRevision = !!d.rejectReason?.startsWith('[수정요청]');
  const rejectText = isRevision
    ? d.rejectReason!.slice('[수정요청]'.length).trim()
    : d.rejectReason;

  return (
    <Card className="overflow-hidden">
      <div className="border-l-4 border-l-primary">
        {/* 반려/수정요청 사유 — 반려된 KPI 는 draft 로 되돌아오며 rejectReason 이 남는다. */}
        {d.rejectReason && (
          <div
            className={cn(
              'border-b px-5 py-2.5 text-12',
              isRevision
                ? 'bg-warning-50 border-warning-200 text-warning-700'
                : 'bg-danger-50 border-danger-200 text-danger-700',
            )}
            role="alert"
          >
            <b>{isRevision ? '수정요청' : '반려됨'}</b> · 사유: {rejectText} — 보완 후 다시 제출해 주세요.
          </div>
        )}
        {/* 헤더 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-4">
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border border-border bg-foreground px-1 text-10 font-bold tabular-nums text-background">
            {index + 1}
          </span>

          {/* 그룹 선택 — 그룹 색 칩 모양의 Select(chevron 포함이라 정적 배지로 오인되지 않음) */}
          <Select
            value={d.group}
            onValueChange={(v) =>
              onChange({
                group: v as KpiGroup,
                category: CATEGORY_BY_GROUP[v as KpiGroup][0],
              })
            }
          >
            <SelectTrigger
              size="chip"
              tone={d.group === 'performance_core' ? 'chip-primary' : 'chip-foreground'}
              aria-label="KPI 그룹 선택"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="min-w-45 flex-1 text-15 font-bold leading-snug text-foreground break-keep">
            {d.title.trim() || '새 KPI 작성 중'}
          </div>

          {/* 가중치 */}
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="whitespace-nowrap text-11 font-bold text-muted-foreground">가중치</span>
            <Input
              tone="accent"
              type="number"
              min={0}
              max={100}
              value={d.weight}
              onChange={(e) => onChange({ weight: e.target.value })}
              placeholder="0"
              className="h-8 w-16 text-center text-13 font-bold"
            />
            <span className="text-12 text-muted-foreground">%</span>
          </div>

          <Button variant="ghost-muted" size="icon-sm" onClick={onDelete} aria-label="KPI 삭제">
            <Trash2 aria-hidden />
          </Button>
        </div>

        {/* 본문 필드 */}
        <div className="border-b border-border bg-card px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 bg-primary" aria-hidden />
            <div className="text-12 font-bold text-foreground">성과 내용</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="성과관리지표 (KPI)" required>
              <Input
                value={d.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="예) 신규 거래처 매출 달성"
                className="h-9 text-13"
              />
            </Field>
            <Field label="전략 목표 (CSF)">
              <Input
                value={d.csf}
                onChange={(e) => onChange({ csf: e.target.value })}
                placeholder="예) 신규 시장 진출"
                className="h-9 text-13"
              />
            </Field>
            <Field label="2026년 목표">
              <Textarea
                rows={2}
                value={d.targetText}
                onChange={(e) => onChange({ targetText: e.target.value })}
                placeholder="예) 신규 거래처 5곳 확보, 매출 120억 달성"
                className="min-h-0 text-13"
              />
            </Field>
            <Field label="측정방식">
              <Textarea
                rows={2}
                value={d.measureMethod}
                onChange={(e) => onChange({ measureMethod: e.target.value })}
                placeholder="예) 분기별 실적 합산, 목표 대비 달성률"
                className="min-h-0 text-13"
              />
            </Field>
          </div>

          {/* 정성/정량 토글 */}
          <div className="flex flex-wrap items-center gap-3 mt-3.5">
            <span className="text-11 font-semibold text-muted-foreground shrink-0">성과 구분</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={String(d.isQualitative)}
              // 같은 항목 재클릭 시 Radix 가 빈 값을 내보냄 — 선택 해제 불가(라디오 동작) 유지.
              onValueChange={(v) => v && onChange({ isQualitative: v === 'true' })}
              aria-label="정성/정량 구분"
            >
              {QUAL_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-11 text-muted-foreground">
              {d.isQualitative ? '서술형 평가 · 권장 비중 ≤30%' : '수치 실적 기반 평가'}
            </span>
          </div>
        </div>

        {/* 등급 부여 기준 */}
        <div className="border-t border-border bg-muted">
          <div className="px-5 pt-4 pb-2">
            <span className="text-11h font-semibold text-muted-foreground">
              등급 부여 기준 (S / A / B / C / D)
            </span>
          </div>
          <div className="px-5 pb-5">
            <div className="rounded-lg overflow-hidden border border-border/50">
              {/* 헤더 행 */}
              <div className="grid grid-cols-5 bg-muted border-b border-border/20">
                {GRADE_KEYS.map((g) => (
                  <div key={`hdr-${g}`} className={cn('flex items-center justify-center py-2 px-1', g !== 'D' && 'border-r border-border/20')}>
                    <GradeChip grade={g as Grade} size="sm" />
                  </div>
                ))}
              </div>
              {/* 텍스트에어리어 행 */}
              <div className="grid grid-cols-5 bg-card">
                {GRADE_KEYS.map((g) => (
                  <div key={`body-${g}`} className={cn('p-2', g !== 'D' && 'border-r border-border/15')}>
                    <Textarea
                      value={d.gradingCriteria[g as GradeKey]}
                      onChange={(e) =>
                        onChange({
                          gradingCriteria: { ...d.gradingCriteria, [g]: e.target.value },
                        })
                      }
                      placeholder={`${g} 기준`}
                      rows={3}
                      className="min-h-0 text-12"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
