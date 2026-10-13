'use client';

// 1차 검토 표형 KPI 행 + 판정 드래프트 타입 — FirstReviewPanel 파일 상한 분리(shadcn 전환 G1).
import { ChevronDown } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DecisionControls } from './DecisionControls';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { kpiCategoryLabel, measureTypeUnit, fmtAmount } from '@/lib/ui';
import type { KpiProgress, RuleSet } from '@/lib/types';

export interface KpiCommentDraft {
  note: string;
  decision: 'accepted' | 'rebaseline' | '';
}

/**
 * KPI가 실제 코멘트·판정 중 하나라도 있는지 확인.
 * 판정만 있어도(코멘트 없어도) 제출할 내용으로 취급.
 * 버튼 활성화 조건과 페이로드 필터링 조건을 일치시키기 위해 단일 소스로 관리.
 */
export const hasKpiContent = (d: KpiCommentDraft): boolean =>
  Boolean(d.note.trim() || d.decision);

// 1차 검토 표형 행 — KPI 검토(KPI_ROW_GRID)와 같은 열 구성(No/항목/가중치/판정): flex + 고정폭 열(w-11/w-18/w-37.5).
// 마지막 열은 현재 판정 배지 + 펼침 버튼만 담아 KPI 검토보다 좁다 — 실제 판정 입력(코멘트+토글)은
// 카드 하단 바에서 상시 처리한다(펼침 여부와 무관하게 항상 접근 가능해야 하는 조작이라서).
// 카테고리 칩 색(구 palette.categoryChip: 흰/연회색 바탕 + 진한/중간 글씨) → Badge variant.
const CATEGORY_VARIANT: Record<string, NonNullable<BadgeProps['variant']>> = {
  revenue: 'outline',
  construction: 'neutral',
  orders: 'neutral',
  collaboration: 'secondary',
  development: 'secondary',
};

function targetLabelOf(k: KpiProgress): string | null {
  if (k.targetText?.trim()) return k.targetText;
  if (k.targetValue === null) return null;
  return k.measureType === 'amount'
    ? fmtAmount(k.targetValue)
    : `${k.targetValue.toLocaleString('ko-KR')}${measureTypeUnit[k.measureType]}`;
}

function DecisionBadge({ decision }: { decision: KpiCommentDraft['decision'] }) {
  if (decision === 'accepted') {
    return (
      <Badge variant="success" size="xs">
        수락
      </Badge>
    );
  }
  if (decision === 'rebaseline') {
    return (
      <Badge variant="status-revision" size="xs">
        조정 필요
      </Badge>
    );
  }
  return (
    <Badge variant="muted" size="xs">
      미판정
    </Badge>
  );
}

export function FirstReviewKpiRow({
  index,
  kpi,
  scales,
  draft,
  collapsed,
  onToggle,
  onChange,
}: {
  index: number;
  kpi: KpiProgress;
  scales?: RuleSet['gradingScales'];
  draft: KpiCommentDraft;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<KpiCommentDraft>) => void;
}) {
  const target = targetLabelOf(kpi);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* 행 전체 클릭 → 등급 부여 기준·CSF·누적 달성률 펼침/접힘 (KPI 검토와 동일 패턴) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="mr-2 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-sm bg-muted text-12 font-bold tabular-nums text-muted-foreground">
          {String(index).padStart(2, '0')}
        </span>

        {/* KPI 항목 — 정성/정량·카테고리 칩 + 제목/목표/측정방식 */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="flex w-21.5 shrink-0 flex-col items-start gap-1 pt-0.5">
            <Badge variant="default" size="xs">
              {kpi.isQualitative ? '정성' : '정량'}
            </Badge>
            <Badge variant={CATEGORY_VARIANT[kpi.category] ?? 'neutral'} size="xs">
              {kpiCategoryLabel[kpi.category]}
            </Badge>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-14 font-bold leading-snug text-foreground break-keep">{kpi.title}</p>
            {target && (
              <p className="flex gap-2 text-12 text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">목표</span>
                <span className="truncate">{target}</span>
              </p>
            )}
            {kpi.measureMethod && (
              <p className="flex gap-2 text-12 text-muted-foreground">
                <span className="w-7 shrink-0 font-semibold text-foreground/70">측정</span>
                <span className="truncate">{kpi.measureMethod}</span>
              </p>
            )}
            {/* 확정 전 KPI에도 코멘트·판정을 남길 수 있다 — 어디서 목표를 조치해야 하는지 안내
                (MemberRevisionPanel 의 미확정 카드 안내와 같은 사실). */}
            {kpi.status !== 'confirmed' && (
              <p className="text-11h text-warning-700">
                아직 확정되지 않은 KPI예요. 코멘트·판정은 대상자에게 그대로 전달되지만, 목표 수정은
                중간점검이 아니라 KPI 검토에서 이뤄져요.
              </p>
            )}
          </div>
        </div>

        <span className="w-18 shrink-0 text-15 font-bold tabular-nums text-foreground">{kpi.weight}%</span>

        <div className="flex w-37.5 shrink-0 items-center justify-end gap-1.5" onClick={stop}>
          <DecisionBadge decision={draft.decision} />
          <Button
            variant="ghost-muted"
            size="icon-xs"
            aria-label={collapsed ? '등급 부여 기준 펼치기' : '등급 부여 기준 접기'}
            onClick={onToggle}
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {/* 펼침 영역 — CSF + 누적 달성률 + 등급 부여 기준(참고용, 중간점검은 등급 미반영) */}
      {!collapsed && (
        <div className="border-t border-border">
          {kpi.csf && (
            <p className="bg-muted/60 px-5 pt-3 text-12 text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">CSF(전략목표)</span>
              {kpi.csf}
            </p>
          )}
          {kpi.cumulativeRate !== null && (
            <p className="bg-muted/60 px-5 pt-2 text-12 text-muted-foreground">
              <span className="mr-1.5 font-semibold text-foreground/70">누적 달성률</span>
              <span className="tabular-nums">{kpi.cumulativeRate}%</span>
            </p>
          )}
          <div className="bg-muted/60 px-5 pt-3 pb-4">
            {/* KpiGradingDisplay 는 gradingCriteria/measureType 만 읽는다 — 진척 응답(KpiProgress)엔
                건수 기준(grading) 원본 배열이 없어 null 로 넘긴다(정성 서술·공통 금액/증감률표는 그대로 표시). */}
            <KpiGradingDisplay
              kpi={{ gradingCriteria: kpi.gradingCriteria, grading: null, measureType: kpi.measureType }}
              scales={scales}
            />
          </div>
        </div>
      )}

      {/* 판정 컨트롤 — 코멘트 입력 + [수락|조정 필요] 세그먼트 토글(재조정 검토 스타일).
          펼침 여부와 무관하게 상시 노출 — 등급기준 확인 없이도 바로 판정할 수 있어야 한다. */}
      <DecisionControls
        note={draft.note}
        decision={draft.decision}
        onChange={onChange}
        placeholder="이 KPI에 대한 코멘트 (선택)"
        noteAriaLabel={`${kpi.title} 코멘트`}
        rebaseLabel="조정 필요"
      />
    </div>
  );
}
