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
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { T, gradeChipColor } from '@/lib/palette';
import { humanizeRateBand } from '@/lib/ui';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const TIERS = ['excellent', 'standard', 'poor'] as const;
type Tier = (typeof TIERS)[number];
const tierLabel: Record<Tier, string> = {
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
};
const tierBadge: Record<Tier, { bg: string; color: string }> = {
  excellent: { bg: T.blue50, color: T.blue700 },
  standard:  { bg: T.grey100, color: T.grey700 },
  poor:      { bg: '#FFF6DC', color: T.orange500 },
};
// 막대/세그먼트용 등급 면색(solid) — 공용 gradeChipColor(Part/ 브리프 §2 Solid 세트) 단일 소스.
const gradeFill: Record<Grade, string> = {
  S: gradeChipColor.S.bg,
  A: gradeChipColor.A.bg,
  B: gradeChipColor.B.bg,
  C: gradeChipColor.C.bg,
  D: gradeChipColor.D.bg,
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
  // (2026-07-07) 매출 절대금액 등급(revenueGradeScale) 편집 UI 제거 — 실사용 0건.
  // DB 의 기존 키는 RulesView toPatchBody 의 weightPolicy 스프레드 머지로 보존된다.
  // 다단계 평가 단계 가중치(1차 팀장·2차 본부장·최종 대표) + 최종점수 실적/역량 가중.
  stageWeights: { teamLeader: number; divisionHead: number; ceo: number };
  perfCompWeights: { perf: number; comp: number };
  weightPolicy: {
    totalMustEqual: number;
    qualitativeMaxPercent: number;
    // 갭 #3 — KPI 그룹 가중치(합 100, 편집 가능)·강제 플래그.
    kpiGroupWeights: { performance_core: number; collaboration_growth: number };
    enforceQualitativeCap: boolean;
    enforceGroupRatio: boolean;
  };
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
  // 위 등급 최소점이 아래 등급 최대점 이하면 두 구간이 겹친다(예: S 80~100 vs A 70~85 → 80~85 겹침).
  const sorted = GRADES.map((g) => v.gradeScale.find((e) => e.grade === g)!);
  for (let i = 0; i < sorted.length - 1; i++) {
    const hi = sorted[i];
    const lo = sorted[i + 1];
    if (!hi || !lo) continue;
    if (hi.min <= lo.max) {
      errors.gradeScale = '등급 구간이 겹치거나 순서가 어긋났어요.';
    } else if (hi.min - lo.max > 1) {
      // 갭 검증 — 백엔드 판정은 min 내림차순 매칭이라 빈 구간의 점수는 화면 표시와 달리
      // 아래 등급으로 떨어진다(예: A ~84 / S 90~ 이면 85~89점은 A). 표시·판정 불일치 차단.
      const gapStart = lo.max + 1;
      const gapEnd = hi.min - 1;
      const range = gapStart === gapEnd ? `${gapStart}점` : `${gapStart}~${gapEnd}점`;
      errors.gradeScale = `등급 사이에 빈 점수 구간이 있어요 — ${range}은 아래 등급(${lo.grade})으로 판정돼요.`;
    }
  }

  // 달성률 밴드: 존재 + 음수 하한 금지 + 상한<하한 금지 + 인접 등급 역전/겹침 없음.
  for (const key of ['amount', 'rate'] as const) {
    const bands = v.gradingScales[key];
    if (!bands || bands.length === 0) {
      errors.gradingScales = '측정방식별 달성률표를 입력해 주세요.';
      continue;
    }
    const byGrade = GRADES.map((g) => bands.find((b) => b.grade === g));
    for (const b of byGrade) {
      if (!b) continue;
      if (typeof b.minRate !== 'number' || Number.isNaN(b.minRate) || b.minRate < 0) {
        errors.gradingScales = '달성률 하한은 0 이상의 숫자여야 해요.';
      } else if (b.maxRate != null && b.maxRate < b.minRate) {
        errors.gradingScales = '달성률 상한이 하한보다 작을 수 없어요.';
      }
    }
    // 인접 등급(위 = 높은 등급): 위 등급 하한은 아래 등급 하한보다 커야 하고(역전),
    // 아래 등급 상한이 위 등급 하한을 넘으면 겹침.
    for (let i = 0; i < byGrade.length - 1; i++) {
      const hi = byGrade[i];
      const lo = byGrade[i + 1];
      if (!hi || !lo) continue;
      if (lo.minRate >= hi.minRate) {
        errors.gradingScales = '위 등급의 달성률 하한은 아래 등급보다 커야 해요.';
      } else if (lo.maxRate != null && lo.maxRate > hi.minRate) {
        errors.gradingScales = '달성률 구간이 겹쳐요. 인접 등급의 상한·하한을 확인해 주세요.';
      }
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

  // 정성 상한: 0~100. + 갭 #3 그룹 가중치 합 100.
  const q = v.weightPolicy.qualitativeMaxPercent;
  const kw = v.weightPolicy.kpiGroupWeights;
  const kwSum = (kw.performance_core || 0) + (kw.collaboration_growth || 0);
  if (q < 0 || q > 100) {
    errors.weightPolicy = '정성 상한은 0~100% 사이여야 해요.';
  } else if (Math.abs(kwSum - 100) > 0.01) {
    errors.weightPolicy = `그룹 가중치 합이 100%가 아니에요(현재 ${Math.round(kwSum * 10) / 10}%).`;
  }

  // 다단계 단계 가중치(1차·2차·최종) 합 = 1(또는 100 스케일) / 실적·역량 가중 합 = 1(또는 100).
  const sumsToOne = (sum: number) =>
    Math.abs(sum - 1) <= 0.001 || Math.abs(sum - 100) <= 0.01;
  const sw = v.stageWeights;
  const swSum = (sw?.teamLeader || 0) + (sw?.divisionHead || 0) + (sw?.ceo || 0);
  if (!errors.weightPolicy && !sumsToOne(swSum)) {
    errors.weightPolicy = `단계 가중치(1차·2차·최종) 합이 1이 아니에요(현재 ${Math.round(swSum * 100) / 100}).`;
  }
  const pcw = v.perfCompWeights;
  const pcSum = (pcw?.perf || 0) + (pcw?.comp || 0);
  if (!errors.weightPolicy && !sumsToOne(pcSum)) {
    errors.weightPolicy = `실적·역량 가중치 합이 1이 아니에요(현재 ${Math.round(pcSum * 100) / 100}).`;
  }

  errors.ok =
    !errors.gradeScale &&
    !errors.gradingScales &&
    !errors.poolRatios &&
    !errors.raiseRates &&
    !errors.groupTierBonus &&
    !errors.groupTierThresholds &&
    !errors.weightPolicy;
  return errors;
}

// ── 공용 스타일 ──
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: T.grey600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

// §2-3 카드 섹션 헤더 — surface-muted 배경 + 헤어라인.
function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div
      style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${T.grey200}`,
        background: T.grey100,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: T.grey900 }}>{title}</h3>
      {desc && (
        <p style={{ fontSize: 11.5, color: T.grey600, marginTop: 2 }}>{desc}</p>
      )}
    </div>
  );
}

// 친절 안내 박스 — 액션 블루 info 톤.
function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid rgba(2,87,206,0.18)',
        background: 'rgba(2,87,206,0.05)',
        borderRadius: 8,
        padding: '11px 14px',
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

// 등급 배지(S~D) — 공용 gradeChipColor(Part/ 브리프 §2 Solid 세트) 단일 소스.
const GRADE_BADGE: Record<Grade, { bg: string; color: string }> = gradeChipColor;
function GradeBadge({ grade, size = 26 }: { grade: Grade; size?: number }) {
  const c = GRADE_BADGE[grade];
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
        borderRadius: 4,
      }}
    >
      {grade}
    </span>
  );
}

// tier 배지(우수/보통/미흡) — Pill.
function TierBadge({ tier }: { tier: Tier }) {
  const b = tierBadge[tier];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 10px',
        background: b.bg,
        color: b.color,
        borderRadius: 999,
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
  // 편집 중 로컬 문자열 — 타이핑 중 빈 값을 0으로 강제하지 않고 blur/Enter 시 커밋.
  // 빈 값 커밋 시 allowEmpty 면 emptyValue(∞ 등), 아니면 이전 값 복원.
  const [editText, setEditText] = useState<string | null>(null);
  const bump = (dir: 1 | -1) => {
    setEditText(null);
    onChange(clamp(current + dir * step));
  };
  const commitEdit = () => {
    if (editText === null) return;
    const raw = editText.trim();
    setEditText(null);
    if (raw === '') {
      if (allowEmpty) onChange(emptyValue);
      return; // 이전 값 복원(변경 없음)
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return; // 이전 값 복원
    onChange(clamp(n));
  };
  const btn: React.CSSProperties = {
    width: big ? 32 : 28,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: `1px solid ${invalid ? T.red500 : 'rgba(204,204,212,0.5)'}`,
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
        style={{ ...btn, borderRight: 'none', borderRadius: '8px 0 0 8px' }}
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
            editText !== null
              ? editText
              : value === null || value === undefined
                ? ''
                : String(value)
          }
          placeholder={placeholder}
          onChange={(ev) => setEditText(ev.target.value)}
          onBlur={commitEdit}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') ev.currentTarget.blur();
          }}
          style={{
            width: '100%',
            border: `1px solid ${invalid ? T.red500 : 'rgba(204,204,212,0.5)'}`,
            borderLeft: 'none',
            borderRight: 'none',
            padding: big ? '0 24px 0 8px' : '0 18px 0 5px',
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
        style={{ ...btn, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}
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
  const kw = value.weightPolicy.kpiGroupWeights;
  const menuSummary: Record<SectionKey, string> = {
    gradeScale: `S ${sSc?.min ?? 0}+ · A ${aSc?.min ?? 0}+`,
    gradingScales: `S ${humanizeRateBand(sBand?.minRate ?? 0, sBand?.maxRate ?? null)} (${measureTab === 'amount' ? '금액' : '증감'})`,
    poolRatios: `우수 S ${value.poolRatios.excellent.S ?? 0}% · 합 ${Math.round(sumPool('excellent'))}%`,
    raiseRates: `S +${value.raiseRates.S ?? 0}% ~ D ${value.raiseRates.D ?? 0}%`,
    groupTierBonus: `경계 ${value.groupTierThresholds.excellent}% · 우수 ${value.groupTierBonus.excellent >= 0 ? '+' : ''}${value.groupTierBonus.excellent}%p`,
    weightPolicy: `성과 ${kw.performance_core}% · 협업 ${kw.collaboration_growth}%`,
  };

  const MENU: { key: SectionKey; label: string; Icon: LucideIcon }[] = [
    { key: 'gradeScale',       label: '등급 척도',        Icon: Layers },
    { key: 'gradingScales',    label: '측정방식별 달성률', Icon: Gauge },
    { key: 'poolRatios',       label: '그룹 풀 비율',     Icon: PieChart },
    { key: 'raiseRates',       label: '등급별 인상률',    Icon: TrendingUp },
    { key: 'groupTierBonus',   label: '그룹실적 보너스',  Icon: Award },
    { key: 'weightPolicy',     label: '가중치 정책',      Icon: Scale },
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
          borderRadius: 10,
          background: '#fff',
          alignSelf: 'start',
          overflow: 'hidden',
        }}
      >
        {MENU.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const hasError = sectionHasError[key];
          const accent = isActive ? T.blue500 : T.grey500;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className="flex w-full items-center gap-3 border-b px-3.5 py-3 text-left transition-all last:border-b-0"
              style={{
                background: isActive ? T.blue50 : '#fff',
                borderColor: 'rgba(204,204,212,0.45)',
                borderLeft: `3px solid ${isActive ? T.blue500 : 'transparent'}`,
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
                style={{
                  width: 30,
                  height: 30,
                  background: isActive ? T.blue500 : T.grey100,
                  color: isActive ? '#fff' : accent,
                  flexShrink: 0,
                  borderRadius: 4,
                }}
              >
                <Icon size={14} />
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
                      style={{ width: 6, height: 6, borderRadius: '50%', background: T.red500 }}
                    />
                  )}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10.5,
                    color: hasError ? T.red500 : T.grey600,
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
          borderRadius: 10,
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
            borderTop: `1px solid rgba(2,87,206,0.15)`,
            background: 'rgba(2,87,206,0.05)',
          }}
        >
          <AlertTriangle size={15} color={T.blue500} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11.5, color: T.blue500, lineHeight: 1.6 }}>
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
    if (next && e.min <= next.max) return true;
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
              border: '1px solid rgba(204,204,212,0.5)',
              background: T.grey100,
              overflow: 'hidden',
              borderRadius: 8,
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
                  border: `1px solid ${bad ? T.red500 : 'rgba(204,204,212,0.5)'}`,
                  padding: '10px 14px',
                  background: bad ? '#FDE8E8' : '#fff',
                  borderRadius: 8,
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
// 밴드 바 행·축 눈금 공용 grid 컬럼 — [바 | 하한 stepper | ~ | 상한 stepper].
const BAND_ROW_GRID = 'minmax(0,1fr) 150px 14px 150px';

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

        {/* 측정방식 탭 — §6-5 세그먼트 토글 */}
        <div
          role="group"
          style={{
            display: 'inline-flex',
            border: '1px solid rgba(204,204,212,0.6)',
            borderRadius: 8,
            overflow: 'hidden',
            background: T.grey100,
          }}
        >
          {(
            [
              { key: 'amount', label: '달성금액 (amount)' },
              { key: 'rate',   label: '증감률 (rate)' },
            ] as const
          ).map((tab) => {
            const on = measureTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={on}
                onClick={() => onMeasureTabChange(tab.key)}
                style={{
                  padding: '6px 16px',
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  color: on ? '#fff' : T.grey600,
                  background: on ? T.blue500 : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background .12s',
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
                style={{ border: '1px solid rgba(204,204,212,0.5)', padding: '10px 14px', borderRadius: 8 }}
              >
                {/* 1행: 사람말 규칙 — 저장값의 꼬리 숫자(110.0001 등)는 숨기고 "110% 초과"로 표기 */}
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <GradeBadge grade={g} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.grey800 }}>
                    {humanizeRateBand(minR, maxR)}
                  </span>
                  <ArrowRight size={13} color={T.grey400} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}>
                    {g} 등급
                  </span>
                </div>
                {/* 2행: 시각화 바 + 정밀 입력(하한 ~ 상한) — 하단 축 눈금과 같은 grid 컬럼 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: BAND_ROW_GRID,
                    columnGap: 12,
                    alignItems: 'center',
                  }}
                >
                  {/* 밴드 바 */}
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: 24,
                      background: T.grey50,
                      border: `1px solid rgba(204,204,212,0.4)`,
                      borderRadius: 4,
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
                  {/* stepper: 하한 ~ 상한 (소수 경계도 안 잘리게 넉넉히) */}
                  <Stepper
                    ariaLabel={`${g} 하한`}
                    value={minR}
                    onChange={(n) => onSet(measureTab, g, 'minRate', n ?? 0)}
                    step={5}
                    suffix="%"
                    width={150}
                  />
                  <span style={{ color: T.grey400, fontSize: 13, textAlign: 'center' }}>~</span>
                  <Stepper
                    ariaLabel={`${g} 상한`}
                    value={maxR}
                    onChange={(n) => onSet(measureTab, g, 'maxRate', n)}
                    step={5}
                    suffix="%"
                    width={150}
                    allowEmpty
                    emptyValue={null}
                    placeholder="∞"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* 축 눈금 — 밴드 바와 같은 grid 첫 컬럼에 정렬(스테퍼 영역 제외) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: BAND_ROW_GRID,
            columnGap: 12,
            padding: '0 15px', // 밴드 박스 border 1px + padding 14px 만큼 들여쓰기
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
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
                style={{ border: '1px solid rgba(204,204,212,0.5)', padding: '14px 16px', borderRadius: 8 }}
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
                    border: `1px solid ${bad ? T.red500 : 'rgba(204,204,212,0.5)'}`,
                    borderRadius: 4,
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
                        width={124}
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
                style={{ border: '1px solid rgba(204,204,212,0.5)', padding: '12px 16px', borderRadius: 8 }}
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
                    border: `1px solid rgba(204,204,212,0.4)`,
                    borderRadius: 4,
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
                          border: `1px solid rgba(204,204,212,0.4)`,
                          borderRadius: 4,
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
        <div style={{ border: '1px solid rgba(204,204,212,0.5)', padding: '16px 18px', borderRadius: 8 }}>
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
            <b>보통</b>, 그 미만이면 <b style={{ color: T.orange500 }}>미흡</b>이에요. 위 우수
            경계는 보통 경계보다 커야 해요.
          </HintBox>

          {/* 달성률 축 + 두 경계(우수/보통) 구간 색칠 */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                position: 'relative',
                height: 40,
                border: `1px solid ${badThr ? T.red500 : 'rgba(204,204,212,0.5)'}`,
                borderRadius: 4,
                background: '#FFF6DC', // 미흡(기본 바탕)
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
                  background: '#E3F7EC',
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
                  borderRadius: 999,
                  background: '#E3F7EC',
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
                  borderRadius: 999,
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
                  border: `1px solid rgba(204,204,212,0.5)`,
                  borderRadius: 8,
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

// ── 토글 스위치 — §6-6 패턴 ──
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
        width: 40,
        height: 22,
        flexShrink: 0,
        border: `1px solid ${checked ? T.blue500 : 'rgba(204,204,212,0.6)'}`,
        background: checked ? T.blue500 : 'rgba(204,204,212,0.4)',
        borderRadius: 999,
        cursor: 'pointer',
        padding: 0,
        transition: 'background .15s ease, border-color .15s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 16,
          height: 16,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,.15)',
          transition: 'left .15s ease',
        }}
      />
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// ⑦ 가중치 정책 — kpiGroupWeights 연동 도넛(편집 가능, 합100) + 강제 토글
// ════════════════════════════════════════════════════════════════════
// 다단계 평가 가중치 — 1차/2차/최종 단계 가중 + 최종점수 실적/역량 가중(편집).
function MultiStageWeights({
  value,
  onChange,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
}) {
  const sw = value.stageWeights;
  const pc = value.perfCompWeights;
  // 표시·입력은 %(정수), 내부 저장은 0~1 소수 유지(계약 불변).
  const toPct = (n: number) => Math.round(n * 100);
  const stagePctSum = toPct(sw.teamLeader) + toPct(sw.divisionHead) + toPct(sw.ceo);
  const pcPctSum = toPct(pc.perf) + toPct(pc.comp);
  const stageBad = stagePctSum !== 100;
  const pcBad = pcPctSum !== 100;
  const setStage = (f: 'teamLeader' | 'divisionHead' | 'ceo', pctN: number | null) =>
    onChange({ ...value, stageWeights: { ...sw, [f]: (pctN ?? 0) / 100 } });
  const setPC = (f: 'perf' | 'comp', pctN: number | null) =>
    onChange({ ...value, perfCompWeights: { ...pc, [f]: (pctN ?? 0) / 100 } });

  const pctField = (
    label: string,
    v: number,
    on: (n: number | null) => void,
    bad: boolean,
  ) => (
    <div className="flex items-center gap-1.5">
      <span style={{ fontSize: 12.5, color: T.grey700 }}>{label}</span>
      <Stepper
        ariaLabel={`${label} 가중치`}
        value={toPct(v)}
        onChange={on}
        step={5}
        min={0}
        max={100}
        suffix="%"
        width={116}
        invalid={bad}
      />
    </div>
  );

  return (
    <div style={{ border: '1px solid rgba(204,204,212,0.5)', borderRadius: 8, padding: 16 }} className="space-y-3">
      <div style={{ fontSize: 13, fontWeight: 700, color: T.grey900 }}>다단계 평가 가중치</div>
      <p style={{ fontSize: 11.5, color: T.grey500, lineHeight: 1.5 }}>
        합산점수 = 1차×가중 + 2차×가중 + 최종×가중(없는 단계는 제외 후 재정규화). 최종점수 = 합산실적×실적 + 합산역량×역량.
        <br />역량 가중은 기본 0%(등급 미반영·참고용)이에요. 예외: 1차=최종평가자 → 1차 100%, 2차=최종평가자 → 1차 70% + 최종 30%로 자동 적용돼요.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {pctField('1차·팀장', sw.teamLeader, (n) => setStage('teamLeader', n), stageBad)}
        {pctField('2차·본부장', sw.divisionHead, (n) => setStage('divisionHead', n), stageBad)}
        {pctField('최종·대표', sw.ceo, (n) => setStage('ceo', n), stageBad)}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: stageBad ? T.red500 : T.green500 }}>
          합 {stagePctSum}%{stageBad ? ' — 100%가 되어야 해요' : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4" style={{ borderTop: '1px solid rgba(204,204,212,0.3)', paddingTop: 12 }}>
        {pctField('실적', pc.perf, (n) => setPC('perf', n), pcBad)}
        {pctField('역량', pc.comp, (n) => setPC('comp', n), pcBad)}
        <span style={{ fontSize: 11.5, fontWeight: 600, color: pcBad ? T.red500 : T.green500 }}>
          합 {pcPctSum}%{pcBad ? ' — 100%가 되어야 해요' : ''}
        </span>
      </div>
    </div>
  );
}

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
  const denom = Math.max(kwSum, 1);
  const donut = T.grey100;

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

        {/* ── 다단계 평가 가중치(1차/2차/최종 + 실적/역량) ── */}
        <MultiStageWeights value={value} onChange={onChange} />

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
                <span style={{ width: 10, height: 10, background: T.grey900, borderRadius: 2 }} /> 성과중심
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
                <span style={{ width: 10, height: 10, background: T.grey500, borderRadius: 2 }} /> 협업·성장
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
                border: `1px solid ${kwBad ? T.red500 : 'rgba(204,204,212,0.5)'}`,
                background: T.grey100,
                overflow: 'hidden',
                borderRadius: 4,
              }}
            >
              {corePct > 0 && (
                <div
                  title={`성과중심 ${corePct}%`}
                  style={{
                    width: `${(corePct / denom) * 100}%`,
                    background: T.grey900,
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
                    background: T.grey500,
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
              borderRadius: 4,
              background: T.grey100,
              border: `1px solid rgba(204,204,212,0.4)`,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, q))}%`,
                height: '100%',
                background: T.green500,
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
        border: `1px solid rgba(204,204,212,0.5)`,
        borderRadius: 8,
        background: checked ? 'rgba(2,87,206,0.05)' : '#fff',
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
              color: checked ? T.blue500 : T.grey500,
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
