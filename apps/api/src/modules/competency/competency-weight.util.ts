import { Grade } from '@prisma/client';

/**
 * 역량평가 가중치 = **카테고리 단위**(엑셀 역량평가서와 동일).
 * 같은 주기·같은 카테고리 문항은 모두 같은 weight(=카테고리 가중치)를 갖는다 — 문항당 조각이 아니다.
 * 평가표(직책자/비직책자)마다 그 평가표에 나오는 카테고리 가중치 합 = 100%.
 * 저장은 문항 행에 반복(denormalized) — 서비스가 카테고리 내 동일값을 유지한다.
 */

export const GRADE_SCORE: Record<Grade, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

/** 평가표 대상군 — 'all' 문항은 두 평가표 모두에 들어간다. */
export const COMPETENCY_AUDIENCES = ['manager', 'non_manager'] as const;
export type CompetencyAudience = (typeof COMPETENCY_AUDIENCES)[number];

interface WeightedQuestion {
  id: string;
  categoryId: string;
  weight: number;
}

/**
 * 카테고리 가중치 맵. 정상 데이터는 카테고리 내 동일값이라 max=그 값.
 * 레거시(문항별 상이 값)도 결정적으로 해석되도록 최댓값을 대표값으로 쓴다.
 */
export function categoryWeights(questions: { categoryId: string; weight: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const q of questions) {
    map.set(q.categoryId, Math.max(map.get(q.categoryId) ?? 0, q.weight));
  }
  return map;
}

/**
 * 평가자 1명(한 단계)의 환산 점수 0~100.
 * = Σ_c (카테고리 가중치 × 카테고리 평균점수) / (5 × Σ_c 카테고리 가중치) × 100.
 * 응답이 없는 카테고리는 분모에서 제외. 가중치가 전부 0이면 카테고리 균등.
 * 카테고리별 문항 수가 같으면 기존 엑셀식 Σ(점수×가중치)/(5×Σ가중치)와 같은 값.
 */
export function categoryWeightedScore(
  questions: WeightedQuestion[],
  rows: { questionId: string; grade: Grade }[],
): number | null {
  const weights = categoryWeights(questions);
  const useWeights = [...weights.values()].some((w) => w > 0);
  const categoryOf = new Map(questions.map((q) => [q.id, q.categoryId]));

  const perCategory = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const cat = categoryOf.get(r.questionId);
    if (!cat) continue;
    const acc = perCategory.get(cat) ?? { sum: 0, n: 0 };
    acc.sum += GRADE_SCORE[r.grade];
    acc.n += 1;
    perCategory.set(cat, acc);
  }

  let num = 0;
  let den = 0;
  for (const [cat, acc] of perCategory) {
    const w = useWeights ? (weights.get(cat) ?? 0) : 1;
    if (w <= 0) continue;
    num += (acc.sum / acc.n) * w;
    den += 5 * w;
  }
  if (den === 0) return null;
  return Math.round((num / den) * 100 * 100) / 100;
}

/** 평가표(대상군)별 카테고리 가중치 합 — 활성 문항이 있는 카테고리만. 활성 문항이 없는 평가표는 null. */
export function audienceWeightSums(
  questions: { categoryId: string; weight: number; targetGroup: string; isActive: boolean }[],
): Record<CompetencyAudience, number | null> {
  const result = {} as Record<CompetencyAudience, number | null>;
  for (const audience of COMPETENCY_AUDIENCES) {
    const sheet = questions.filter(
      (q) => q.isActive && (q.targetGroup === audience || q.targetGroup === 'all'),
    );
    result[audience] = sheet.length
      ? [...categoryWeights(sheet).values()].reduce((s, w) => s + w, 0)
      : null;
  }
  return result;
}
