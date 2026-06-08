'use client';

// 평가 규칙 에디터 — "숫자 입력 폼"이 아니라 "규칙을 시각적으로 보면서 조정"하는 도구.
// 각 규칙을 데이터 시각화(구간 바·스택 막대·비례 막대·도넛)로 표현해 비전문가도
// 한눈에 이해·편집한다. 기능·계약·검증 로직은 동일(아래 RuleSetDraft/props/
// validateRuleSet/weightPolicy 직렬화는 rules/page.tsx 가 의존하므로 절대 변경 금지).
import { useMemo, useState } from 'react';
import {
  Layers,
  Gauge,
  PieChart,
  TrendingUp,
  Award,
  Scale,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { T, gradeChipColor } from '@/lib/toss';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const TIERS = ['excellent', 'standard', 'poor'] as const;
type Tier = (typeof TIERS)[number];
const tierLabel: Record<Tier, string> = {
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
};
// tier 배지 색(우수 초록·보통 회색·미흡 주황) — admin 톤 inline.
const tierBadge: Record<Tier, { bg: string; color: string }> = {
  excellent: { bg: '#e6f9f2', color: T.green500 },
  standard: { bg: T.grey100, color: T.grey700 },
  poor: { bg: '#fef3c7', color: '#b45309' },
};
// 막대/세그먼트용 등급 면색(solid). gradeChipColor 와 동일 계열.
const gradeFill: Record<Grade, string> = {
  S: '#1b64da',
  A: '#3182f6',
  B: '#03b26c',
  C: '#fe9800',
  D: '#f04452',
};

// amount/rate 밴드(하한/상한). count 는 KPI별 grading 이라 안내만.
export interface RuleSetDraft {
  gradeScale: { grade: Grade; min: number; max: number }[];
  gradingScales: {
    amount: { grade: Grade; minRate: number; maxRate: number | null }[];
    rate: { grade: Grade; minRate: number; maxRate: number | null }[];
  };
  poolRatios: Record<Tier, Record<Grade, number>>;
  raiseRates: Record<Grade, number>;
  // 그룹 실적 tier 별 인상률 가산(%). 음수 허용(미흡 −1 등).
  groupTierBonus: Record<Tier, number>;
  // 갭 #1 — 그룹 실적 달성률(%) tier 경계. excellent 이상→우수, standard 이상→보통, 미만→미흡.
  groupTierThresholds: { excellent: number; standard: number };
  // 갭 #2 — 매출 절대금액(원) → 등급. minAmount 내림차순 매칭. S~D 5행.
  revenueGradeScale: { grade: Grade; minAmount: number }[];
  weightPolicy: {
    totalMustEqual: number;
    qualitativeMaxPercent: number;
    // 갭 #3 — KPI 그룹 가중치(합 100, 편집 가능)·강제 플래그.
    kpiGroupWeights: { performance_core: number; collaboration_growth: number };
    enforceQualitativeCap: boolean;
    enforceGroupRatio: boolean;
  };
}

// 억 단위 환산 헬퍼(원 ↔ 억) — 절대금액 등급 친화 입력용.
const EOK = 100_000_000;
function wonToEok(won: number): number {
  return Math.round((won / EOK) * 100) / 100; // 소수 2자리(억)
}
function eokToWon(eok: number): number {
  return Math.round(eok * EOK);
}
// 원 금액을 "10억", "8.5억", "0원" 식 사람 친화 표기로.
function formatWonShort(won: number): string {
  if (!won || won <= 0) return '0원';
  if (won >= EOK) {
    const eok = won / EOK;
    return `${Number.isInteger(eok) ? eok : Math.round(eok * 100) / 100}억`;
  }
  if (won >= 10_000) return `${Math.round(won / 10_000)}만원`;
  return `${won.toLocaleString('ko-KR')}원`;
}

export interface RuleSetEditorProps {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  measureTab: 'amount' | 'rate';
  onMeasureTabChange: (t: 'amount' | 'rate') => void;
}

// ── 검증(프론트 즉시 피드백, 최종은 백엔드) — 시그니처·로직 불변 ──
export function validateRuleSet(v: RuleSetDraft): {
  ok: boolean;
  gradeScale?: string;
  gradingScales?: string;
  poolRatios?: string;
  raiseRates?: string;
  groupTierBonus?: string;
  groupTierThresholds?: string;
  revenueGradeScale?: string;
  weightPolicy?: string;
} {
  const errors: ReturnType<typeof validateRuleSet> = { ok: true };

  // 등급 척도: min<=max, 구간 겹침 없음.
  for (const e of v.gradeScale) {
    if (e.min > e.max) {
      errors.gradeScale = '등급 구간의 최소점이 최대점보다 클 수 없어요.';
    }
  }
  // 인접 등급 겹침/역전(S>A>B>C>D 순으로 min 내림차순).
  const sorted = GRADES.map((g) => v.gradeScale.find((e) => e.grade === g)!);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] && sorted[i + 1] && sorted[i].min <= sorted[i + 1].max) {
      // 위 등급 최소점이 아래 등급 최대점 이하면 겹침.
      if (sorted[i].min <= sorted[i + 1].min) {
        errors.gradeScale = '등급 구간이 겹치거나 순서가 어긋났어요.';
      }
    }
  }

  // 달성률 밴드: 각 측정방식 하한이 비어 있지 않게.
  for (const key of ['amount', 'rate'] as const) {
    const bands = v.gradingScales[key];
    if (!bands || bands.length === 0) {
      errors.gradingScales = '측정방식별 달성률표를 입력해 주세요.';
    }
  }

  // 풀 비율: 각 tier 합 = 100(±0.01).
  for (const t of TIERS) {
    const sum = GRADES.reduce((acc, g) => acc + (v.poolRatios[t][g] || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.poolRatios = `${tierLabel[t]} 그룹의 풀 비율 합이 100%가 아니에요.`;
    }
  }

  // 인상률: 음수 불가.
  for (const g of GRADES) {
    if (v.raiseRates[g] < 0) errors.raiseRates = '인상률은 음수가 될 수 없어요.';
  }

  // 그룹실적 보너스: 음수 허용, 숫자(NaN 불가)만 가볍게 검증.
  for (const t of TIERS) {
    const b = v.groupTierBonus[t];
    if (typeof b !== 'number' || Number.isNaN(b)) {
      errors.groupTierBonus = '그룹실적 보너스는 숫자여야 해요.';
    }
  }

  // 갭 #1 — 그룹실적 tier 경계: excellent > standard, 둘 다 숫자.
  const gt = v.groupTierThresholds;
  if (
    typeof gt.excellent !== 'number' ||
    typeof gt.standard !== 'number' ||
    Number.isNaN(gt.excellent) ||
    Number.isNaN(gt.standard)
  ) {
    errors.groupTierThresholds = '우수·보통 경계는 숫자여야 해요.';
  } else if (gt.excellent <= gt.standard) {
    errors.groupTierThresholds = '우수 경계는 보통 경계보다 커야 해요.';
  }

  // 갭 #2 — 매출 절대금액 등급: S~D 5개 존재 + minAmount 내림차순(S가 가장 큼).
  const rgRows = GRADES.map((g) => v.revenueGradeScale.find((e) => e.grade === g));
  if (rgRows.some((e) => !e)) {
    errors.revenueGradeScale = 'S~D 다섯 등급의 금액 기준을 모두 입력해 주세요.';
  } else {
    for (let i = 0; i < rgRows.length - 1; i++) {
      const cur = rgRows[i]!.minAmount;
      const next = rgRows[i + 1]!.minAmount;
      if (typeof cur !== 'number' || Number.isNaN(cur) || cur < 0) {
        errors.revenueGradeScale = '금액 기준은 0 이상의 숫자여야 해요.';
        break;
      }
      if (cur <= next) {
        errors.revenueGradeScale =
          '위 등급의 금액 기준은 아래 등급보다 커야 해요(내림차순).';
        break;
      }
    }
  }

  // 정성 상한: 0~100. + 갭 #3 그룹 가중치 합 100.
  const q = v.weightPolicy.qualitativeMaxPercent;
  const kw = v.weightPolicy.kpiGroupWeights;
  const kwSum = (kw.performance_core || 0) + (kw.collaboration_growth || 0);
  if (q < 0 || q > 100) {
    errors.weightPolicy = '정성 상한은 0~100% 사이여야 해요.';
  } else if (Math.abs(kwSum - 100) > 0.01) {
    errors.weightPolicy = `그룹 가중치 합이 100%가 아니에요(현재 ${Math.round(kwSum * 10) / 10}%).`;
  }

  errors.ok =
    !errors.gradeScale &&
    !errors.gradingScales &&
    !errors.poolRatios &&
    !errors.raiseRates &&
    !errors.groupTierBonus &&
    !errors.groupTierThresholds &&
    !errors.revenueGradeScale &&
    !errors.weightPolicy;
  return errors;
}

// ── 공용 스타일 ──
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: T.grey800,
  marginBottom: 6,
};

// 섹션 헤더(우측 콘텐츠 상단) — grey50 배경.
function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${T.grey200}`,
        background: T.grey50,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>{title}</h3>
      {desc && (
        <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{desc}</p>
      )}
    </div>
  );
}

// 친절 안내 박스(예시 포함) — 각 섹션 상단.
function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${T.grey200}`,
        background: T.blue50,
        padding: '12px 14px',
        fontSize: 12,
        lineHeight: 1.6,
        color: T.grey700,
      }}
    >
      {children}
    </div>
  );
}

// 인라인 검증 에러 — 빨강 줄.
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: T.red500,
        marginTop: 4,
      }}
    >
      <AlertTriangle size={13} /> {msg}
    </div>
  );
}

// 등급 배지(S~D, gradeChip 색) — 사각형.
function GradeBadge({ grade, size = 26 }: { grade: Grade; size?: number }) {
  const c = gradeChipColor[grade];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: c.bg,
        color: c.color,
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      {grade}
    </span>
  );
}

// tier 배지(우수/보통/미흡).
function TierBadge({ tier }: { tier: Tier }) {
  const b = tierBadge[tier];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11.5,
        fontWeight: 600,
        padding: '3px 9px',
        background: b.bg,
        color: b.color,
      }}
    >
      {tierLabel[tier]}
    </span>
  );
}

// ── Stepper 숫자 입력(+/− 버튼 + 키보드) ──
function Stepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  width = 132,
  big = false,
  allowEmpty = false,
  emptyValue = null,
  placeholder,
  ariaLabel,
  invalid = false,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  width?: number;
  big?: boolean;
  allowEmpty?: boolean;
  emptyValue?: number | null;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const clamp = (n: number) => {
    let r = n;
    if (typeof min === 'number') r = Math.max(min, r);
    if (typeof max === 'number') r = Math.min(max, r);
    return r;
  };
  const current = value ?? 0;
  const bump = (dir: 1 | -1) => onChange(clamp(current + dir * step));
  const btn: React.CSSProperties = {
    width: big ? 32 : 28,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: `1px solid ${invalid ? T.red500 : T.grey200}`,
    color: T.grey700,
    cursor: 'pointer',
    height: big ? 44 : 36,
  };
  return (
    <div style={{ display: 'flex', width, alignItems: 'stretch' }}>
      <button
        type="button"
        aria-label={`${ariaLabel ?? ''} 감소`}
        onClick={() => bump(-1)}
        style={{ ...btn, borderRight: 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.grey100)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
      >
        <Minus size={big ? 16 : 13} />
      </button>
      <div style={{ position: 'relative', flex: 1 }}>
        <input
          aria-label={ariaLabel}
          type="number"
          value={
            value === null || value === undefined
              ? ''
              : String(value)
          }
          placeholder={placeholder}
          onChange={(ev) => {
            const raw = ev.target.value;
            if (raw === '') {
              onChange(allowEmpty ? emptyValue : 0);
              return;
            }
            onChange(clamp(Number(raw)));
          }}
          style={{
            width: '100%',
            border: `1px solid ${invalid ? T.red500 : T.grey200}`,
            borderLeft: 'none',
            borderRight: 'none',
            padding: big ? '0 22px 0 8px' : '0 22px 0 6px',
            height: big ? 44 : 36,
            fontSize: big ? 20 : 13,
            fontWeight: big ? 700 : 600,
            textAlign: 'center',
            color: invalid ? T.red500 : T.grey900,
            background: '#fff',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: big ? 12 : 11,
              color: T.grey500,
              pointerEvents: 'none',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`${ariaLabel ?? ''} 증가`}
        onClick={() => bump(1)}
        style={{ ...btn, borderLeft: 'none' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.grey100)}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
      >
        <Plus size={big ? 16 : 13} />
      </button>
    </div>
  );
}

type SectionKey =
  | 'gradeScale'
  | 'gradingScales'
  | 'revenueGradeScale'
  | 'poolRatios'
  | 'raiseRates'
  | 'groupTierBonus'
  | 'weightPolicy';

export function RuleSetEditor({
  value,
  onChange,
  measureTab,
  onMeasureTabChange,
}: RuleSetEditorProps) {
  const errors = useMemo(() => validateRuleSet(value), [value]);
  const [active, setActive] = useState<SectionKey>('gradeScale');

  // 섹션별 에러 여부(좌측 메뉴 빨강 점 표시용).
  const sectionHasError: Record<SectionKey, boolean> = {
    gradeScale: !!errors.gradeScale,
    gradingScales: !!errors.gradingScales,
    revenueGradeScale: !!errors.revenueGradeScale,
    poolRatios: !!errors.poolRatios,
    raiseRates: !!errors.raiseRates,
    // 그룹실적 보너스 섹션은 보너스 + tier 경계(갭 #1) 둘 다 품으므로 둘 중 하나라도 에러면 표시.
    groupTierBonus: !!errors.groupTierBonus || !!errors.groupTierThresholds,
    weightPolicy: !!errors.weightPolicy,
  };

  // 좌측 메뉴 부제(현재 핵심값 요약) — 탐색성↑.
  const sSc = value.gradeScale.find((e) => e.grade === 'S');
  const aSc = value.gradeScale.find((e) => e.grade === 'A');
  const sBand = value.gradingScales[measureTab].find((e) => e.grade === 'S');
  const sumPool = (t: Tier) =>
    GRADES.reduce((acc, g) => acc + (value.poolRatios[t][g] || 0), 0);
  const rgS = value.revenueGradeScale.find((e) => e.grade === 'S');
  const kw = value.weightPolicy.kpiGroupWeights;
  const menuSummary: Record<SectionKey, string> = {
    gradeScale: `S ${sSc?.min ?? 0}+ · A ${aSc?.min ?? 0}+`,
    gradingScales: `S ${sBand?.minRate ?? 0}%+ (${measureTab === 'amount' ? '금액' : '증감'})`,
    revenueGradeScale: `S ${formatWonShort(rgS?.minAmount ?? 0)}↑`,
    poolRatios: `우수 S ${value.poolRatios.excellent.S ?? 0}% · 합 ${Math.round(sumPool('excellent'))}%`,
    raiseRates: `S +${value.raiseRates.S ?? 0}% ~ D ${value.raiseRates.D ?? 0}%`,
    groupTierBonus: `경계 ${value.groupTierThresholds.excellent}% · 우수 ${value.groupTierBonus.excellent >= 0 ? '+' : ''}${value.groupTierBonus.excellent}%p`,
    weightPolicy: `성과 ${kw.performance_core}% · 협업 ${kw.collaboration_growth}%`,
  };

  const MENU: { key: SectionKey; label: string; Icon: LucideIcon; bg: string }[] = [
    { key: 'gradeScale', label: '등급 척도', Icon: Layers, bg: T.blue500 },
    { key: 'gradingScales', label: '측정방식별 달성률', Icon: Gauge, bg: T.grey800 },
    { key: 'revenueGradeScale', label: '매출 절대금액 등급', Icon: Banknote, bg: '#0E9F6E' },
    { key: 'poolRatios', label: '그룹 풀 비율', Icon: PieChart, bg: '#9333EA' },
    { key: 'raiseRates', label: '등급별 인상률', Icon: TrendingUp, bg: T.green500 },
    { key: 'groupTierBonus', label: '그룹실적 보너스', Icon: Award, bg: T.orange500 },
    { key: 'weightPolicy', label: '가중치 정책', Icon: Scale, bg: T.grey700 },
  ];

  const setGradeScale = (grade: Grade, field: 'min' | 'max', n: number) =>
    onChange({
      ...value,
      gradeScale: value.gradeScale.map((e) =>
        e.grade === grade ? { ...e, [field]: n } : e,
      ),
    });

  const setBandNum = (
    key: 'amount' | 'rate',
    grade: Grade,
    field: 'minRate' | 'maxRate',
    n: number | null,
  ) =>
    onChange({
      ...value,
      gradingScales: {
        ...value.gradingScales,
        [key]: value.gradingScales[key].map((e) =>
          e.grade === grade
            ? { ...e, [field]: field === 'maxRate' ? n : (n ?? 0) }
            : e,
        ),
      },
    });

  const setPool = (t: Tier, grade: Grade, n: number) =>
    onChange({
      ...value,
      poolRatios: {
        ...value.poolRatios,
        [t]: { ...value.poolRatios[t], [grade]: n },
      },
    });

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: '244px 1fr' }}>
      {/* 좌측 섹션 메뉴 — 각 항목에 핵심값 부제 */}
      <div
        style={{
          border: `1px solid ${T.grey200}`,
          background: '#fff',
          alignSelf: 'start',
        }}
      >
        {MENU.map(({ key, label, Icon, bg }) => {
          const isActive = active === key;
          const hasError = sectionHasError[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className="flex w-full items-center gap-3 border-b px-3.5 py-3 text-left transition-all last:border-b-0"
              style={{
                background: isActive ? T.grey100 : '#fff',
                borderColor: T.grey200,
                borderLeft: `3px solid ${isActive ? bg : 'transparent'}`,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = T.grey50;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = '#fff';
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{ width: 30, height: 30, background: bg, flexShrink: 0 }}
              >
                <Icon size={14} color="#fff" />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? T.grey900 : T.grey700,
                  }}
                >
                  {label}
                  {hasError && (
                    <span
                      aria-label="입력 확인 필요"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: T.red500,
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    color: hasError ? T.red500 : T.grey500,
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {hasError ? '확인이 필요해요' : menuSummary[key]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 우측 콘텐츠 */}
      <div
        style={{
          border: `1px solid ${T.grey200}`,
          background: '#fff',
          overflow: 'hidden',
          alignSelf: 'start',
        }}
      >
        {active === 'gradeScale' && (
          <GradeScaleSection
            value={value}
            onSet={setGradeScale}
            error={errors.gradeScale}
          />
        )}
        {active === 'gradingScales' && (
          <GradingScalesSection
            value={value}
            measureTab={measureTab}
            onMeasureTabChange={onMeasureTabChange}
            onSet={setBandNum}
            error={errors.gradingScales}
          />
        )}
        {active === 'revenueGradeScale' && (
          <RevenueGradeScaleSection
            value={value}
            onChange={onChange}
            error={errors.revenueGradeScale}
          />
        )}
        {active === 'poolRatios' && (
          <PoolRatiosSection
            value={value}
            onSet={setPool}
            error={errors.poolRatios}
          />
        )}
        {active === 'raiseRates' && (
          <RaiseRatesSection
            value={value}
            onChange={onChange}
            error={errors.raiseRates}
          />
        )}
        {active === 'groupTierBonus' && (
          <GroupTierBonusSection
            value={value}
            onChange={onChange}
            error={errors.groupTierBonus}
            thresholdsError={errors.groupTierThresholds}
          />
        )}
        {active === 'weightPolicy' && (
          <WeightPolicySection
            value={value}
            onChange={onChange}
            error={errors.weightPolicy}
          />
        )}

        {/* 재산정 영향 안내 배너(모든 섹션 하단 공통) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '12px 24px',
            borderTop: `1px solid ${T.grey200}`,
            background: '#fffbeb',
          }}
        >
          <AlertTriangle size={15} color="#b45309" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.6 }}>
            <b>재산정 영향 안내</b> — 활성 주기의 규칙을 바꾸면 점수·등급·풀·인상률이
            다시 산정돼요. 저장 전 변경 내용을 확인해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ① 등급 척도 — 0~100 수평 구간 바 + 경계 stepper
// ════════════════════════════════════════════════════════════════════
function GradeScaleSection({
  value,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  onSet: (g: Grade, f: 'min' | 'max', n: number) => void;
  error?: string;
}) {
  const rows = GRADES.map((g) => value.gradeScale.find((e) => e.grade === g)!);
  // 세그먼트별 겹침/역전 판정(빨강 경고).
  const segBad = (i: number) => {
    const e = rows[i];
    if (!e) return false;
    if (e.min > e.max) return true;
    const next = rows[i + 1];
    if (next && e.min <= next.max && e.min <= next.min) return true;
    return false;
  };
  const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

  return (
    <>
      <ContentHeader
        title="등급 척도 (점수 → 등급)"
        desc="최종 총점이 어느 구간에 들어가면 어떤 등급이 되는지 정해요."
      />
      <div style={{ padding: 24 }} className="space-y-4">
        <HintBox>
          아래 <b>0~100점 띠</b>에서 각 등급이 차지하는 구간을 한눈에 볼 수 있어요.
          예) S를 <b>90~100점</b>으로 정하면 총점 90점 이상은 S 등급이에요. 위
          등급의 최소점은 아래 등급의 최대점보다 커야 해요(구간이 겹치면 안 돼요).
        </HintBox>

        {/* 수평 구간 바(0~100) — 등급색 세그먼트 */}
        <div>
          <div
            style={{
              position: 'relative',
              height: 56,
              border: `1px solid ${T.grey200}`,
              background: T.grey50,
              overflow: 'hidden',
            }}
          >
            {rows.map((e, i) => {
              if (!e) return null;
              const left = Math.max(0, Math.min(100, e.min));
              const right = Math.max(0, Math.min(100, e.max));
              const w = Math.max(0, right - left);
              const bad = segBad(i);
              return (
                <div
                  key={e.grade}
                  title={`${e.grade} 등급 · ${e.min}~${e.max}점`}
                  style={{
                    position: 'absolute',
                    left: pct(left),
                    width: pct(w),
                    top: 0,
                    bottom: 0,
                    background: bad ? T.red500 : gradeFill[e.grade],
                    opacity: bad ? 0.85 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    borderRight: '1px solid rgba(255,255,255,0.45)',
                    transition: 'left .15s ease, width .15s ease, background .15s ease',
                  }}
                >
                  {w >= 8 ? e.grade : ''}
                </div>
              );
            })}
          </div>
          {/* 눈금(0/25/50/75/100) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: 10,
              color: T.grey400,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {[0, 25, 50, 75, 100].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>

        {/* 경계 편집 행(stepper) */}
        <div className="space-y-2.5">
          {GRADES.map((g, i) => {
            const e = value.gradeScale.find((x) => x.grade === g)!;
            const bad = segBad(i);
            return (
              <div
                key={g}
                className="flex items-center gap-3"
                style={{
                  border: `1px solid ${bad ? T.red500 : T.grey200}`,
                  padding: '10px 14px',
                  background: bad ? '#fff5f5' : '#fff',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 28,
                    background: gradeFill[g],
                    flexShrink: 0,
                  }}
                />
                <GradeBadge grade={g} />
                <Stepper
                  ariaLabel={`${g} 등급 최소점`}
                  value={e?.min ?? 0}
                  onChange={(n) => onSet(g, 'min', n ?? 0)}
                  min={0}
                  max={100}
                  suffix="점"
                  width={132}
                />
                <span style={{ color: T.grey400, fontSize: 13 }}>~</span>
                <Stepper
                  ariaLabel={`${g} 등급 최대점`}
                  value={e?.max ?? 0}
                  onChange={(n) => onSet(g, 'max', n ?? 0)}
                  min={0}
                  max={100}
                  suffix="점"
                  width={132}
                />
                {bad && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: T.red500,
                    }}
                  >
                    <AlertTriangle size={12} /> 구간 확인
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ② 측정방식별 달성률표 — 수평 구간 바(달성률 축) + 탭, ∞ 화살표
// ════════════════════════════════════════════════════════════════════
function GradingScalesSection({
  value,
  measureTab,
  onMeasureTabChange,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  measureTab: 'amount' | 'rate';
  onMeasureTabChange: (t: 'amount' | 'rate') => void;
  onSet: (
    k: 'amount' | 'rate',
    g: Grade,
    f: 'minRate' | 'maxRate',
    n: number | null,
  ) => void;
  error?: string;
}) {
  const bands = GRADES.map((g) => ({
    grade: g,
    band: value.gradingScales[measureTab].find((x) => x.grade === g),
  }));
  // 바 축 상한(가시화용) — 데이터 최대치에 여유. 표시 전용(저장값 영향 없음).
  const maxSeen = Math.max(
    140,
    ...bands.map((b) => b.band?.maxRate ?? 0).filter((n) => Number.isFinite(n)),
    ...bands.map((b) => b.band?.minRate ?? 0),
  );
  const axisMax = Math.ceil((maxSeen + 20) / 20) * 20;
  const pos = (n: number) => `${Math.max(0, Math.min(100, (n / axisMax) * 100))}%`;

  return (
    <>
      <ContentHeader
        title="측정방식별 달성률표 (달성률 % → 등급)"
        desc="달성률이 몇 % 이상이면 어떤 등급인지 측정방식별로 정해요."
      />
      <div style={{ padding: 24 }} className="space-y-4">
        <HintBox>
          아래 띠는 <b>달성률 축</b>이에요. 예) 달성금액 S를 <b>120% 이상</b>으로
          정하면 목표 대비 120%를 넘긴 KPI는 S 등급이에요. 상한을 비우면 상한
          없음(∞ → 화살표)이에요. 건수(count)는 KPI별 임계 건수에서 관리해요.
        </HintBox>

        {/* 측정방식 탭 */}
        <div style={{ display: 'flex', border: `1px solid ${T.grey200}`, width: 'fit-content' }}>
          {(
            [
              { key: 'amount', label: '달성금액 (amount)' },
              { key: 'rate', label: '증감률 (rate)' },
            ] as const
          ).map((tab) => {
            const on = measureTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onMeasureTabChange(tab.key)}
                style={{
                  padding: '8px 16px',
                  fontSize: 12.5,
                  fontWeight: on ? 600 : 400,
                  color: on ? '#fff' : T.grey700,
                  background: on ? T.blue500 : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 등급별 수평 밴드 바 + stepper */}
        <div className="space-y-2.5">
          {bands.map(({ grade: g, band }) => {
            const minR = band?.minRate ?? 0;
            const maxR = band?.maxRate ?? null;
            const noCap = maxR === null || maxR === undefined;
            const left = pos(minR);
            const width = noCap
              ? `calc(100% - ${pos(minR)})`
              : `${Math.max(0, ((Math.min(maxR, axisMax) - minR) / axisMax) * 100)}%`;
            return (
              <div
                key={g}
                style={{ border: `1px solid ${T.grey200}`, padding: '10px 14px' }}
              >
                <div className="flex items-center gap-3">
                  <GradeBadge grade={g} />
                  {/* 밴드 바 */}
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: 24,
                      background: T.grey50,
                      border: `1px solid ${T.grey100}`,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left,
                        width,
                        top: 0,
                        bottom: 0,
                        background: gradeFill[g],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: noCap ? 'flex-end' : 'center',
                        paddingRight: noCap ? 4 : 0,
                        transition: 'left .15s ease, width .15s ease',
                      }}
                    >
                      {noCap && <ArrowRight size={14} color="#fff" />}
                    </div>
                  </div>
                  {/* stepper: 하한 ~ 상한 */}
                  <Stepper
                    ariaLabel={`${g} 하한`}
                    value={minR}
                    onChange={(n) => onSet(measureTab, g, 'minRate', n ?? 0)}
                    step={5}
                    suffix="%"
                    width={120}
                  />
                  <span style={{ color: T.grey400, fontSize: 13 }}>~</span>
                  <Stepper
                    ariaLabel={`${g} 상한`}
                    value={maxR}
                    onChange={(n) => onSet(measureTab, g, 'maxRate', n)}
                    step={5}
                    suffix="%"
                    width={120}
                    allowEmpty
                    emptyValue={null}
                    placeholder="∞"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* 축 눈금 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingLeft: 38,
            fontSize: 10,
            color: T.grey400,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{Math.round(axisMax * f)}%</span>
          ))}
        </div>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ②-b 매출 절대금액 등급 — 등급별 내림차순 비례 막대 + 억 단위 친화 입력
// ════════════════════════════════════════════════════════════════════
function RevenueGradeScaleSection({
  value,
  onChange,
  error,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
}) {
  const rows = GRADES.map(
    (g) =>
      value.revenueGradeScale.find((e) => e.grade === g) ?? {
        grade: g,
        minAmount: 0,
      },
  );
  // 막대 길이 기준(가장 큰 금액 = S). 0 방지.
  const maxAmount = Math.max(1, ...rows.map((r) => r.minAmount || 0));
  // 내림차순 위반 행(앞 등급 ≤ 뒤 등급) 빨강 경고.
  const rowBad = (i: number) => {
    const cur = rows[i].minAmount;
    if (typeof cur !== 'number' || Number.isNaN(cur) || cur < 0) return true;
    if (i < rows.length - 1 && cur <= rows[i + 1].minAmount) return true;
    return false;
  };
  const setAmount = (grade: Grade, won: number) =>
    onChange({
      ...value,
      revenueGradeScale: GRADES.map((g) => {
        const existing = value.revenueGradeScale.find((e) => e.grade === g);
        const minAmount =
          g === grade ? won : (existing?.minAmount ?? 0);
        return { grade: g, minAmount };
      }),
    });

  return (
    <>
      <ContentHeader
        title="매출 절대금액 등급 (실제 매출액 → 등급)"
        desc="목표 대비 달성률 대신, 실제 매출 절대금액(원)이 얼마 이상이면 어떤 등급인지 정해요."
      />
      <div style={{ padding: 24 }} className="space-y-4">
        <HintBox>
          <b>억 단위</b>로 편하게 입력하면 원 단위로 저장돼요. 예) S를 <b>10억</b>으로
          정하면 실제 매출 10억원 이상은 S 등급이에요. 위 등급의 금액 기준은 아래
          등급보다 커야 해요(내림차순). 이 규칙은 KPI 작성 시{' '}
          <b>‘절대금액 기준 등급’</b>을 켠 매출 KPI에만 적용돼요.
        </HintBox>

        <div className="space-y-2.5">
          {GRADES.map((g, i) => {
            const row = rows[i];
            const bad = rowBad(i);
            const w = `${Math.max(0, (row.minAmount / maxAmount) * 100)}%`;
            const eokVal = wonToEok(row.minAmount);
            return (
              <div
                key={g}
                className="flex items-center gap-3"
                style={{
                  border: `1px solid ${bad ? T.red500 : T.grey200}`,
                  padding: '12px 16px',
                  background: bad ? '#fff5f5' : '#fff',
                }}
              >
                <GradeBadge grade={g} />
                {/* 억 단위 stepper */}
                <Stepper
                  ariaLabel={`${g} 등급 최소 매출(억)`}
                  value={eokVal}
                  onChange={(n) => setAmount(g, eokToWon(n ?? 0))}
                  min={0}
                  step={0.5}
                  suffix="억"
                  width={140}
                  invalid={bad}
                />
                {/* 비례 막대 */}
                <div
                  style={{
                    flex: 1,
                    height: 26,
                    background: T.grey50,
                    position: 'relative',
                    border: `1px solid ${T.grey100}`,
                  }}
                >
                  <div
                    style={{
                      width: w,
                      height: '100%',
                      background: bad ? T.red500 : gradeFill[g],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      transition: 'width .15s ease, background .15s ease',
                      minWidth: row.minAmount > 0 ? 36 : 0,
                    }}
                  >
                    {row.minAmount > 0 ? `${formatWonShort(row.minAmount)}↑` : ''}
                  </div>
                </div>
                {/* 미리보기 칩 */}
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: 132,
                    fontSize: 11.5,
                    color: T.grey600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatWonShort(row.minAmount)} 이상 →{' '}
                  <b style={{ color: T.grey900 }}>{g}</b>
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: T.grey500 }}>
          가장 아래 D 등급은 보통 <b>0억</b>(모든 금액 포함)으로 두어 누락 없이 등급이
          매겨지게 해요.
        </p>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ③ 그룹 풀 비율 — tier별 100% 스택 가로 막대 + 합계 게이지
// ════════════════════════════════════════════════════════════════════
function PoolRatiosSection({
  value,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  onSet: (t: Tier, g: Grade, n: number) => void;
  error?: string;
}) {
  return (
    <>
      <ContentHeader
        title="그룹 풀 비율 (그룹 실적 × 등급)"
        desc="그룹 실적(우수/보통/미흡)마다 S~D를 몇 %씩 줄지 정해요. 행 합은 반드시 100%."
      />
      <div style={{ padding: 24 }} className="space-y-4">
        <HintBox>
          각 줄은 <b>100% 스택 막대</b>예요 — 색 면적이 그 등급에 배정되는 인원
          비율이에요. 예) 우수 그룹의 S를 <b>20%</b>로 하면 인원의 20%까지 S를
          받아요. 우측 게이지가 <b style={{ color: T.green500 }}>100%</b>가 되어야
          저장돼요.
        </HintBox>

        {/* 등급 범례 */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {GRADES.map((g) => (
            <span
              key={g}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.grey600 }}
            >
              <span style={{ width: 12, height: 12, background: gradeFill[g] }} />
              {g}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {TIERS.map((t) => {
            const sum = GRADES.reduce(
              (acc, g) => acc + (value.poolRatios[t][g] || 0),
              0,
            );
            const bad = Math.abs(sum - 100) > 0.01;
            const diff = Math.round((sum - 100) * 10) / 10;
            return (
              <div
                key={t}
                style={{ border: `1px solid ${T.grey200}`, padding: '14px 16px' }}
              >
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 10 }}
                >
                  <TierBadge tier={t} />
                  {/* 합계 게이지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bad ? (
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: T.red500 }}
                      >
                        <AlertTriangle size={12} />
                        {diff > 0 ? `초과 ${diff}%` : `부족 ${-diff}%`}
                      </span>
                    ) : (
                      <span
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: T.green500 }}
                      >
                        <CheckCircle2 size={12} /> 100%
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: bad ? T.red500 : T.green500,
                        minWidth: 42,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(sum * 10) / 10}%
                    </span>
                  </div>
                </div>

                {/* 100% 스택 가로 막대 */}
                <div
                  style={{
                    display: 'flex',
                    height: 30,
                    border: `1px solid ${bad ? T.red500 : T.grey200}`,
                    background: T.grey50,
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  {GRADES.map((g) => {
                    const v = value.poolRatios[t][g] || 0;
                    const wPct = sum > 0 ? (v / Math.max(sum, 100)) * 100 : 0;
                    if (v <= 0) return null;
                    return (
                      <div
                        key={g}
                        title={`${g} ${v}%`}
                        style={{
                          width: `${wPct}%`,
                          background: gradeFill[g],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRight: '1px solid rgba(255,255,255,0.4)',
                          transition: 'width .15s ease',
                        }}
                      >
                        {wPct >= 9 ? `${g} ${v}%` : ''}
                      </div>
                    );
                  })}
                </div>

                {/* 인라인 등급별 stepper */}
                <div
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
                >
                  {GRADES.map((g) => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GradeBadge grade={g} size={22} />
                      <Stepper
                        ariaLabel={`${tierLabel[t]} ${g} 비율`}
                        value={value.poolRatios[t][g]}
                        onChange={(n) => onSet(t, g, n ?? 0)}
                        step={5}
                        min={0}
                        suffix="%"
                        width={108}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ④ 등급별 인상률 — 비례 가로 막대 + 최종 인상률 칩
// ════════════════════════════════════════════════════════════════════
function RaiseRatesSection({
  value,
  onChange,
  error,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
}) {
  const maxRaise = Math.max(1, ...GRADES.map((g) => value.raiseRates[g] || 0));
  return (
    <>
      <ContentHeader
        title="등급별 인상률"
        desc="확정 등급에 따라 내년 연봉이 오르는 비율이에요."
      />
      <div style={{ padding: 24 }} className="space-y-4">
        <HintBox>
          막대 길이가 곧 인상률이라 등급 간 격차가 한눈에 보여요. 예) S{' '}
          <b>+7%</b>면 연봉 1억은 내년에{' '}
          <b style={{ color: T.grey900 }}>1억 700만원</b>이에요. 인상률은 음수가 될
          수 없어요. 우측 칩은 그룹실적 보너스까지 더한 최종 인상률이에요.
        </HintBox>

        <div className="space-y-2.5">
          {GRADES.map((g) => {
            const r = value.raiseRates[g] || 0;
            const w = `${(r / maxRaise) * 100}%`;
            return (
              <div
                key={g}
                className="flex items-center gap-3"
                style={{ border: `1px solid ${T.grey200}`, padding: '12px 16px' }}
              >
                <GradeBadge grade={g} />
                <Stepper
                  ariaLabel={`${g} 등급 인상률`}
                  value={r}
                  onChange={(n) =>
                    onChange({
                      ...value,
                      raiseRates: { ...value.raiseRates, [g]: n ?? 0 },
                    })
                  }
                  min={0}
                  suffix="%"
                  width={130}
                  invalid={r < 0}
                />
                {/* 비례 막대 */}
                <div
                  style={{
                    flex: 1,
                    height: 26,
                    background: T.grey50,
                    position: 'relative',
                    border: `1px solid ${T.grey100}`,
                  }}
                >
                  <div
                    style={{
                      width: w,
                      height: '100%',
                      background: gradeFill[g],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                      color: '#fff',
                      fontSize: 11.5,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      transition: 'width .15s ease',
                      minWidth: r > 0 ? 28 : 0,
                    }}
                  >
                    {r > 0 ? `+${r}%` : ''}
                  </div>
                </div>
                {/* 최종 인상률 칩(표시용 — raiseRates + groupTierBonus) */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {TIERS.map((tt) => {
                    const final = r + (value.groupTierBonus[tt] || 0);
                    return (
                      <div
                        key={tt}
                        title={`${tierLabel[tt]} 그룹 최종 인상률`}
                        style={{
                          textAlign: 'center',
                          minWidth: 46,
                          padding: '4px 6px',
                          border: `1px solid ${T.grey200}`,
                          background: tierBadge[tt].bg,
                        }}
                      >
                        <div style={{ fontSize: 9.5, color: T.grey600, marginBottom: 1 }}>
                          {tierLabel[tt]}
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color:
                              final < 0
                                ? T.red500
                                : final === 0
                                  ? T.grey500
                                  : T.grey900,
                          }}
                        >
                          {final > 0 ? '+' : ''}
                          {final}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: T.grey500 }}>
          칩 = 등급 인상률 + 그룹실적 보너스(우수/보통/미흡). 표시용 계산이며 실제
          산정은 저장 후 백엔드가 수행해요.
        </p>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// ⑤ 그룹실적 보너스 — 3카드 + 큰 stepper + 즉시 환산 예시
// ════════════════════════════════════════════════════════════════════
function GroupTierBonusSection({
  value,
  onChange,
  error,
  thresholdsError,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
  thresholdsError?: string;
}) {
  const sRaise = value.raiseRates.S || 0;
  const gt = value.groupTierThresholds;
  const setThreshold = (field: 'excellent' | 'standard', n: number) =>
    onChange({
      ...value,
      groupTierThresholds: { ...gt, [field]: n },
    });
  // 달성률 축(0~axisMax) — 경계 위치 시각화용(표시 전용).
  const axisMax = Math.max(120, Math.ceil((gt.excellent + 20) / 20) * 20);
  const posPct = (n: number) =>
    `${Math.max(0, Math.min(100, (n / axisMax) * 100))}%`;
  const badThr = gt.excellent <= gt.standard;
  return (
    <>
      <ContentHeader
        title="그룹실적 경계·보너스 (그룹 실적 → 등급·인상률)"
        desc="그룹 실적 달성률이 몇 %부터 우수/보통/미흡인지(경계)와, 그에 따른 인상률 가산을 함께 정해요."
      />
      <div style={{ padding: 24 }} className="space-y-5">
        {/* ── 갭 #1: 그룹실적 tier 경계(달성률 축) ── */}
        <div style={{ border: `1px solid ${T.grey200}`, padding: '16px 18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 700,
              color: T.grey800,
              marginBottom: 10,
            }}
          >
            <Gauge size={14} color={T.orange500} /> 그룹 실적 tier 경계 (달성률 %)
          </div>
          <HintBox>
            그룹 실적 <b>달성률</b>이 <b>{gt.excellent}% 이상</b>이면{' '}
            <b style={{ color: T.green500 }}>우수</b>, <b>{gt.standard}% 이상</b>이면{' '}
            <b>보통</b>, 그 미만이면 <b style={{ color: '#b45309' }}>미흡</b>이에요. 위 우수
            경계는 보통 경계보다 커야 해요.
          </HintBox>

          {/* 달성률 축 + 두 경계(우수/보통) 구간 색칠 */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                position: 'relative',
                height: 40,
                border: `1px solid ${badThr ? T.red500 : T.grey200}`,
                background: '#fef3c7', // 미흡(기본 바탕)
                overflow: 'hidden',
              }}
            >
              {/* 보통 구간(standard~excellent) */}
              <div
                style={{
                  position: 'absolute',
                  left: posPct(Math.min(gt.standard, gt.excellent)),
                  width: `calc(${posPct(Math.max(gt.excellent, gt.standard))} - ${posPct(Math.min(gt.standard, gt.excellent))})`,
                  top: 0,
                  bottom: 0,
                  background: T.grey200,
                  transition: 'left .15s ease, width .15s ease',
                }}
              />
              {/* 우수 구간(excellent~) */}
              <div
                style={{
                  position: 'absolute',
                  left: posPct(gt.excellent),
                  right: 0,
                  top: 0,
                  bottom: 0,
                  background: '#e6f9f2',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                  transition: 'left .15s ease',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: T.green500 }}>
                  우수
                </span>
              </div>
              {/* 경계 마커: standard */}
              <div
                style={{
                  position: 'absolute',
                  left: posPct(gt.standard),
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: T.grey700,
                }}
              />
              {/* 경계 마커: excellent */}
              <div
                style={{
                  position: 'absolute',
                  left: posPct(gt.excellent),
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: T.green500,
                }}
              />
            </div>
            {/* 축 눈금 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
                fontSize: 10,
                color: T.grey400,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span key={f}>{Math.round(axisMax * f)}%</span>
              ))}
            </div>
          </div>

          {/* 경계 stepper */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '3px 9px',
                  background: '#e6f9f2',
                  color: T.green500,
                }}
              >
                우수 경계
              </span>
              <Stepper
                ariaLabel="우수 경계 달성률"
                value={gt.excellent}
                onChange={(n) => setThreshold('excellent', n ?? 0)}
                min={0}
                step={5}
                suffix="%"
                width={130}
                invalid={badThr}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '3px 9px',
                  background: T.grey100,
                  color: T.grey700,
                }}
              >
                보통 경계
              </span>
              <Stepper
                ariaLabel="보통 경계 달성률"
                value={gt.standard}
                onChange={(n) => setThreshold('standard', n ?? 0)}
                min={0}
                step={5}
                suffix="%"
                width={130}
                invalid={badThr}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: T.grey500, marginTop: 8 }}>
            예) 우수 {gt.excellent}% · 보통 {gt.standard}% → 달성률 {gt.excellent}%↑ 우수
            · {gt.standard}~{gt.excellent - 1}% 보통 · {gt.standard}% 미만 미흡
          </p>
          <FieldError msg={thresholdsError} />
        </div>

        {/* ── 그룹실적 보너스(인상률 가산) ── */}
        <HintBox>
          예) 우수 <b>+2%p</b>면 S 등급(+{sRaise}%)인 사람이 우수 그룹이면 최종{' '}
          <b style={{ color: T.grey900 }}>+{sRaise + (value.groupTierBonus.excellent || 0)}%</b>가
          돼요. 미흡은 음수(예 −1)도 입력할 수 있어요.
        </HintBox>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {TIERS.map((t) => {
            const b = value.groupTierBonus[t] || 0;
            const final = sRaise + b;
            return (
              <div
                key={t}
                style={{
                  border: `1px solid ${T.grey200}`,
                  padding: '18px 16px',
                  textAlign: 'center',
                  borderTop: `3px solid ${tierBadge[t].color}`,
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <TierBadge tier={t} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Stepper
                    ariaLabel={`${tierLabel[t]} 보너스`}
                    value={b}
                    onChange={(n) =>
                      onChange({
                        ...value,
                        groupTierBonus: { ...value.groupTierBonus, [t]: n ?? 0 },
                      })
                    }
                    suffix="%p"
                    width={140}
                    big
                  />
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: T.grey600,
                    lineHeight: 1.5,
                  }}
                >
                  S등급이면{' '}
                  <b
                    style={{
                      color: final < 0 ? T.red500 : T.grey900,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {final > 0 ? '+' : ''}
                    {final}%
                  </b>
                </div>
              </div>
            );
          })}
        </div>
        <FieldError msg={error} />
      </div>
    </>
  );
}

// ── 토글 스위치(Toss 사각형) — 켜면 강제 플래그 ──
function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        flexShrink: 0,
        border: `1px solid ${checked ? T.blue500 : T.grey300}`,
        background: checked ? T.blue500 : T.grey200,
        cursor: 'pointer',
        padding: 0,
        transition: 'background .15s ease, border-color .15s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          background: '#fff',
          transition: 'left .15s ease',
        }}
      />
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// ⑦ 가중치 정책 — kpiGroupWeights 연동 도넛(편집 가능, 합100) + 강제 토글
// ════════════════════════════════════════════════════════════════════
function WeightPolicySection({
  value,
  onChange,
  error,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
}) {
  const q = value.weightPolicy.qualitativeMaxPercent;
  const kw = value.weightPolicy.kpiGroupWeights;
  const corePct = kw.performance_core || 0;
  const collabPct = kw.collaboration_growth || 0;
  const kwSum = corePct + collabPct;
  const kwBad = Math.abs(kwSum - 100) > 0.01;
  // 도넛 conic-gradient — kpiGroupWeights 실제값 연동(합이 100이 아니면 비율 그대로 표시).
  const denom = Math.max(kwSum, 1);
  const corePortion = (corePct / denom) * 100;
  const donut = `conic-gradient(${T.blue500} 0% ${corePortion}%, #9333EA ${corePortion}% 100%)`;

  const setWeight = (
    field: 'performance_core' | 'collaboration_growth',
    n: number,
  ) =>
    onChange({
      ...value,
      weightPolicy: {
        ...value.weightPolicy,
        kpiGroupWeights: { ...kw, [field]: n },
      },
    });
  const setFlag = (
    field: 'enforceQualitativeCap' | 'enforceGroupRatio',
    v: boolean,
  ) =>
    onChange({
      ...value,
      weightPolicy: { ...value.weightPolicy, [field]: v },
    });

  return (
    <>
      <ContentHeader
        title="가중치 정책"
        desc="KPI 그룹 가중치(성과중심·협업·성장)와 정성 상한·강제 옵션을 정해요."
      />
      <div style={{ padding: 24 }} className="space-y-5">
        <HintBox>
          모든 KPI 가중치 합은 항상{' '}
          <b style={{ color: T.grey900 }}>{value.weightPolicy.totalMustEqual}%</b>(고정)이에요.
          아래 <b>그룹 가중치</b>는 성과중심·협업·성장이 각각 몇 %를 차지할지 정하고{' '}
          <b>합은 100%</b>여야 해요. 도넛이 입력에 따라 즉시 바뀌어요.
        </HintBox>

        {/* ── 그룹 가중치(편집 가능 도넛) ── */}
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: '200px 1fr', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: '50%',
                background: donut,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 32,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: T.grey500 }}>합계</span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: kwBad ? T.red500 : T.grey900,
                  }}
                >
                  {Math.round(kwSum * 10) / 10}%
                </span>
              </div>
            </div>
            {kwBad ? (
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: T.red500 }}
              >
                <AlertTriangle size={12} /> 합 100% 필요
              </span>
            ) : (
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: T.green500 }}
              >
                <CheckCircle2 size={12} /> 합 100%
              </span>
            )}
          </div>

          {/* 그룹 가중치 stepper */}
          <div className="space-y-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: T.grey800,
                  minWidth: 120,
                }}
              >
                <span style={{ width: 12, height: 12, background: T.blue500 }} /> 성과중심
              </span>
              <Stepper
                ariaLabel="성과중심 그룹 가중치"
                value={corePct}
                onChange={(n) => setWeight('performance_core', n ?? 0)}
                min={0}
                max={100}
                step={5}
                suffix="%"
                width={150}
                invalid={kwBad}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: T.grey800,
                  minWidth: 120,
                }}
              >
                <span style={{ width: 12, height: 12, background: '#9333EA' }} /> 협업·성장
              </span>
              <Stepper
                ariaLabel="협업·성장 그룹 가중치"
                value={collabPct}
                onChange={(n) => setWeight('collaboration_growth', n ?? 0)}
                min={0}
                max={100}
                step={5}
                suffix="%"
                width={150}
                invalid={kwBad}
              />
            </div>
            {/* 합 100 스택 막대(비례) */}
            <div
              style={{
                display: 'flex',
                height: 22,
                border: `1px solid ${kwBad ? T.red500 : T.grey200}`,
                background: T.grey50,
                overflow: 'hidden',
              }}
            >
              {corePct > 0 && (
                <div
                  title={`성과중심 ${corePct}%`}
                  style={{
                    width: `${(corePct / denom) * 100}%`,
                    background: T.blue500,
                    color: '#fff',
                    fontSize: 10.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width .15s ease',
                  }}
                >
                  {(corePct / denom) * 100 >= 14 ? `${corePct}%` : ''}
                </div>
              )}
              {collabPct > 0 && (
                <div
                  title={`협업·성장 ${collabPct}%`}
                  style={{
                    width: `${(collabPct / denom) * 100}%`,
                    background: '#9333EA',
                    color: '#fff',
                    fontSize: 10.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width .15s ease',
                  }}
                >
                  {(collabPct / denom) * 100 >= 14 ? `${collabPct}%` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 정성 KPI 상한 ── */}
        <div>
          <label style={labelStyle}>정성 KPI 상한</label>
          <Stepper
            ariaLabel="정성 KPI 상한"
            value={q}
            onChange={(n) =>
              onChange({
                ...value,
                weightPolicy: {
                  ...value.weightPolicy,
                  qualitativeMaxPercent: n ?? 0,
                },
              })
            }
            min={0}
            max={100}
            step={5}
            suffix="%"
            width={160}
            invalid={q < 0 || q > 100}
          />
          <div
            style={{
              marginTop: 10,
              height: 14,
              background: T.grey100,
              border: `1px solid ${T.grey200}`,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, q))}%`,
                height: '100%',
                background: '#9333EA',
                transition: 'width .15s ease',
              }}
            />
          </div>
          <p style={{ fontSize: 11, color: T.grey500, marginTop: 6 }}>
            정성 KPI는 전체의 최대 <b style={{ color: T.grey900 }}>{q}%</b>까지 차지할 수
            있어요.
          </p>
        </div>

        {/* ── 강제 옵션 토글(갭 #3) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow
            label="정성 상한 강제"
            desc={`켜면 제출 시 정성 KPI 합이 상한(${q}%)을 넘으면 막아요. (현재 전부 서술형 전환으로 기본 꺼짐)`}
            checked={value.weightPolicy.enforceQualitativeCap}
            onChange={(v) => setFlag('enforceQualitativeCap', v)}
          />
          <ToggleRow
            label="그룹 비율 강제"
            desc="켜면 제출 시 성과중심/협업·성장 가중치 비율을 위 설정대로 강제해요. (기본 꺼짐)"
            checked={value.weightPolicy.enforceGroupRatio}
            onChange={(v) => setFlag('enforceGroupRatio', v)}
          />
        </div>

        <FieldError msg={error} />
      </div>
    </>
  );
}

// 토글 한 행(라벨·설명·스위치) — 가중치 정책 강제 옵션.
function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        border: `1px solid ${T.grey200}`,
        background: checked ? T.blue50 : '#fff',
        padding: '12px 14px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>
          {label}
          <span
            style={{
              marginLeft: 8,
              fontSize: 10.5,
              fontWeight: 700,
              color: checked ? T.blue600 : T.grey500,
            }}
          >
            {checked ? '강제 켜짐' : '꺼짐'}
          </span>
        </div>
        <p style={{ fontSize: 11, color: T.grey600, marginTop: 3, lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}
