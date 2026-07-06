'use client';

// KPI별 자가점검 입력 카드 — 2026-07-02 재설계(사용자 시안은 참고, 앱 공통 문법에 정렬).
//  구성(위→아래):
//   ① 헤더: 번호 스퀘어 + 정량/정성 칩 + 제목 + 우측 가중치
//   ② 정보 밴드: CSF/목표/측정 3열 연한 배경 (본인평가 KpiCard와 동일 패턴)
//   ③ 진척 스트립: 민트 진행바 + 달성률·실적·신호 — 상반기 진척을 한눈에
//   ④ 내 점검 입력 패널: [실적 수치 | 자가 등급(선택=등급 5색)] + 코멘트 + 등급 기준 아코디언
//  - 자가 등급 선택 색 = GradeChip 과 동일한 등급 색(전 화면 등급 5색 체계와 정렬).
import { useState } from 'react';
import { ChevronDown, ChevronRight, PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { gradeColor } from '@/lib/grade';
import {
  kpiTypeLabel,
  fmtAmount,
  measureTypeUnit,
} from '@/lib/ui';
import type { KpiProgress, Grade } from '@/lib/types';

export interface CheckInInput {
  selfActualText: string;
  selfActualValue: string;
  selfNote: string;
  selfGrade: Grade | '';
}

export function defaultCheckIn(kpi: KpiProgress): CheckInInput {
  const ci = kpi.selfCheckIn;
  return {
    selfActualText: ci?.selfActualText ?? '',
    selfActualValue:
      ci?.selfActualValue !== null && ci?.selfActualValue !== undefined
        ? String(ci.selfActualValue)
        : '',
    selfNote: ci?.selfNote ?? '',
    selfGrade: (ci?.selfGrade as Grade) ?? '',
  };
}

// 정보 밴드 셀 — 본인평가 KpiCard(KpiInfoCell)와 동일 문법.
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="font-bold text-foreground">{label}</span>
      <span className="mx-1 text-border">|</span>
      <span className="break-keep">{value}</span>
    </div>
  );
}

export function KpiCheckInCard({
  index,
  kpi,
  checkIn,
  onChange,
  readOnly,
  reviewerFeedback,
}: {
  index?: number;
  kpi: KpiProgress;
  checkIn: CheckInInput;
  onChange: (patch: Partial<CheckInInput>) => void;
  readOnly: boolean;
  /** 상급자 KPI별 판정·피드백(있을 때만 하단 스트립 표시). */
  reviewerFeedback?: { decision: 'accepted' | 'rebaseline' | null; note: string | null } | null;
}) {
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const isQual = kpi.isQualitative;
  const typeLabel = kpiTypeLabel(kpi);
  const unit = measureTypeUnit[kpi.measureType];
  const gradeOptions: Grade[] = ['S', 'A', 'B', 'C', 'D'];

  const targetStr = kpi.targetText?.trim()
    ? kpi.targetText
    : kpi.targetValue !== null
      ? isQual
        ? kpi.targetText
        : kpi.measureType === 'amount'
          ? fmtAmount(kpi.targetValue)
          : `${kpi.targetValue.toLocaleString('ko-KR')}${unit}`
      : null;

  const hasCriteria = Boolean(kpi.gradingCriteria);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
      {/* ① 헤더 — 번호 스퀘어 + 칩 + 제목 + 가중치 */}
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        {index !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[12px] font-bold tabular-nums text-muted-foreground">
            {String(index).padStart(2, '0')}
          </span>
        )}
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
            isQual ? 'bg-warning-50 text-warning-700' : 'bg-info-50 text-primary',
          )}
        >
          {typeLabel}
        </span>
        <h3 className="min-w-0 flex-1 break-keep text-[14.5px] font-bold leading-snug text-foreground">
          {kpi.title}
        </h3>
        <span className="shrink-0 text-right">
          <span className="text-[15px] font-bold tabular-nums text-foreground">{kpi.weight}%</span>
          <span className="ml-1 text-[11px] text-muted-foreground">가중치</span>
        </span>
      </div>

      {/* ② 정보 밴드 — 본인평가와 동일한 연한 배경 3열 */}
      {(kpi.csf || targetStr || kpi.measureMethod) && (
        <div className="border-y border-border bg-muted px-5 py-3">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] leading-relaxed text-muted-foreground md:grid-cols-3">
            <InfoCell label="CSF(전략목표)" value={kpi.csf || '—'} />
            <InfoCell label="목표" value={targetStr || '—'} />
            <InfoCell label="측정 방식" value={kpi.measureMethod || typeLabel} />
          </div>
        </div>
      )}

      {/* ③ 내 점검 입력 패널 — [실적 | 자가 등급 | 코멘트] 3열 균등 배치 */}
      <div className="px-5 py-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-primary">
          <PenLine size={13} aria-hidden />
          내 점검 입력
        </p>

        {/* [실적 1fr | 자가 등급 콘텐츠폭 | 코멘트 1.6fr] — 코멘트가 남는 공간을 넓게 차지 */}
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.6fr)]">
          {!isQual ? (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-muted-foreground">
                현재 실적 수치
                {unit && <span className="ml-1 font-normal text-muted-foreground/60">({unit})</span>}
              </label>
              <Input
                type="number"
                value={checkIn.selfActualValue}
                onChange={(e) => onChange({ selfActualValue: e.target.value })}
                disabled={readOnly}
                placeholder={`수치 입력${unit ? ` (${unit})` : ''}`}
                className={cn('tabular-nums', readOnly && 'bg-muted')}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-muted-foreground">상반기 실적 서술</label>
              <Textarea
                rows={2}
                value={checkIn.selfActualText}
                onChange={(e) => onChange({ selfActualText: e.target.value })}
                disabled={readOnly}
                placeholder="상반기 달성한 내용을 서술해 주세요."
                className={cn('resize-none text-[13px]', readOnly && 'bg-muted')}
              />
            </div>
          )}

          {(isQual || hasCriteria) && (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-muted-foreground">
                자가 등급 <span className="font-normal text-muted-foreground/60">(선택 — 다시 누르면 해제)</span>
              </span>
              <div className="flex h-10 items-center gap-1.5">
                {gradeOptions.map((g) => {
                  const isSelected = checkIn.selfGrade === g;
                  const gc = gradeColor(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChange({ selfGrade: isSelected ? '' : g })}
                      className={cn(
                        'h-9 w-9 rounded-md border text-[13px] font-bold transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        !isSelected && 'border-border bg-card text-muted-foreground hover:-translate-y-px hover:border-border-strong hover:text-foreground',
                      )}
                      style={
                        isSelected
                          ? { background: gc.fg, color: gc.text, borderColor: gc.fg, boxShadow: `0 2px 8px ${gc.fg}55` }
                          : undefined
                      }
                      title={`자가 등급 ${g}${isSelected ? ' (선택됨 — 다시 누르면 해제)' : ''}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 코멘트 — 같은 행, 남는 폭을 넓게 + 실적 입력과 동일 높이(h-10) */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted-foreground">
              코멘트 <span className="text-muted-foreground/50">(선택)</span>
            </label>
            <Textarea
              rows={1}
              value={checkIn.selfNote}
              onChange={(e) => onChange({ selfNote: e.target.value })}
              disabled={readOnly}
              placeholder="달성 배경, 장애요인, 하반기 계획 등"
              className={cn('h-10 min-h-0 resize-none py-2.5 text-[13px]', readOnly && 'bg-muted')}
            />
          </div>
        </div>

        {/* 등급 기준 — 아코디언(기본 숨김) */}
        {hasCriteria && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setCriteriaOpen((v) => !v)}
              className="flex items-center gap-1.5 py-1 text-left transition-colors hover:text-foreground"
            >
              {criteriaOpen ? (
                <ChevronDown size={13} className="flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight size={13} className="flex-shrink-0 text-muted-foreground" />
              )}
              <span className="text-[12px] text-muted-foreground">등급 기준 보기</span>
            </button>
            {criteriaOpen && (
              <div className="mt-1.5 rounded-md bg-muted/60 p-3">
                <div className="grid grid-cols-1 gap-1 lg:grid-cols-5">
                  {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) => {
                    const text = kpi.gradingCriteria?.[g];
                    if (!text) return null;
                    const gc = gradeColor(g);
                    return (
                      <div key={g} className="flex items-start gap-1.5 rounded-md border border-border/40 bg-card p-1.5">
                        <span
                          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-[10px] font-bold"
                          style={{ background: gc.fg, color: gc.text }}
                        >
                          {g}
                        </span>
                        <span className="text-[11px] leading-[1.4] text-muted-foreground">{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상급자 판정·피드백 — 검토 후에만 표시. 재조정이면 주황 강조. */}
      {reviewerFeedback && (reviewerFeedback.decision || reviewerFeedback.note) && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 border-t px-5 py-2.5',
            reviewerFeedback.decision === 'rebaseline'
              ? 'border-warning-100 bg-status-revision-bg'
              : 'border-border/60 bg-muted/30',
          )}
        >
          <span className="text-[11.5px] font-semibold text-muted-foreground">상급자 판정</span>
          {reviewerFeedback.decision && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={
                reviewerFeedback.decision === 'accepted'
                  ? { background: '#E3F7EC', color: '#0B7A47' }
                  : { background: '#FFEEDD', color: '#C2570A' }
              }
            >
              {reviewerFeedback.decision === 'accepted' ? '수락' : '재조정 필요'}
            </span>
          )}
          {reviewerFeedback.note && (
            <span className="min-w-0 break-keep text-[12px] text-foreground/80">{reviewerFeedback.note}</span>
          )}
        </div>
      )}
    </div>
  );
}
