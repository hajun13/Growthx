import type { Kpi, KpiGroup, KpiCategory, CreateKpiRequest, KpiGradingCriteria } from '@/lib/types';
import type { DraftKpi, GradingDraft } from './types';

// ── 도메인 상수 ────────────────────────────────────────────────────
export const CATEGORY_BY_GROUP: Record<KpiGroup, KpiCategory[]> = {
  performance_core: ['revenue', 'construction', 'orders'],
  collaboration_growth: ['collaboration', 'development'],
};

export const KPI_GROUP_BASE: Record<KpiGroup, number> = {
  performance_core: 4,
  collaboration_growth: 2,
};
export const KPI_GROUP_MAX_EXTRA = 1;

export const EMPTY_GRADING: GradingDraft = { S: '', A: '', B: '', C: '', D: '' };

// ── 헬퍼 함수 ────────────────────────────────────────────────────
export function toDraft(k: Kpi): DraftKpi {
  return {
    id: k.id,
    rejectReason: k.rejectReason ?? null,
    group: k.group,
    category: k.category,
    coreStrategy: k.coreStrategy ?? '',
    csf: k.csf ?? '',
    title: k.title,
    targetText: k.targetText ?? '',
    measureMethod: k.measureMethod ?? '',
    weight: String(k.weight),
    isQualitative: k.isQualitative,
    gradingCriteria: {
      S: k.gradingCriteria?.S ?? '',
      A: k.gradingCriteria?.A ?? '',
      B: k.gradingCriteria?.B ?? '',
      C: k.gradingCriteria?.C ?? '',
      D: k.gradingCriteria?.D ?? '',
    },
  };
}

export function emptyDraft(role?: string): DraftKpi {
  const isEmployee = !role || role === 'employee';
  return {
    group: isEmployee ? 'collaboration_growth' : 'performance_core',
    category: isEmployee ? 'collaboration' : 'orders',
    coreStrategy: '',
    csf: '',
    title: '',
    targetText: '',
    measureMethod: '',
    weight: '',
    isQualitative: false,
    gradingCriteria: { ...EMPTY_GRADING },
  };
}

// BUG-A(클리어 불가): 전량 비워도 undefined(미전송=기존값 유지)가 아니라 5밴드 객체를
// 항상 전송한다 — "전송했지만 빈 값 = 클리어 의도". 백엔드가 전 밴드 빈 값이면 null 로 정규화.
function gradingToPayload(g: GradingDraft): KpiGradingCriteria {
  return {
    S: g.S.trim() || null,
    A: g.A.trim() || null,
    B: g.B.trim() || null,
    C: g.C.trim() || null,
    D: g.D.trim() || null,
  };
}

/**
 * create/update 공통 필드. **cycleId 는 넣지 않는다** — UpdateKpiDto 에 없어서
 * PATCH 에 실으면 whitelist 가 조용히 버린다(forbidNonWhitelisted 를 켜면 400).
 * 생성 시에는 draftToCreatePayload 가 cycleId 를 얹는다.
 */
export function draftToPayload(d: DraftKpi): Omit<CreateKpiRequest, 'cycleId'> {
  // 제품 결정(2026-07-07): 전 KPI 서술형 — 절대금액 기준 등급(useAbsoluteAmount) 생성 경로 제거.
  // measureType 은 항상 qualitative, useAbsoluteAmount 는 항상 false 로 전송한다.
  return {
    group: d.group,
    category: d.category,
    measureType: 'qualitative',
    // BUG-A: 빈 값도 그대로 전송(`|| undefined` 로 미전송 처리하면 지운 값이 서버에서 부활).
    // 백엔드가 빈 문자열을 null(클리어)로 정규화한다.
    coreStrategy: d.coreStrategy,
    csf: d.csf,
    title: d.title,
    targetText: d.targetText.trim(),
    measureMethod: d.measureMethod.trim(),
    // BUG-A: 목표 금액 입력이 사라졌으므로 항상 null(클리어) 전송 — 잔존 값 부활 방지.
    // 계약 타입(number|undefined)에는 null 클리어 표현이 없어 국소 캐스트(백엔드 DTO 는 number|null 수용).
    targetValue: null as unknown as number | undefined,
    weight: Number(d.weight) || 0,
    isQualitative: d.isQualitative,
    useAbsoluteAmount: false,
    gradingCriteria: gradingToPayload(d.gradingCriteria),
  };
}

/** 생성 전용 — cycleId 는 CreateKpiDto 에만 있다. */
export function draftToCreatePayload(cycleId: string, d: DraftKpi): CreateKpiRequest {
  return { cycleId, ...draftToPayload(d) };
}
