/**
 * 역량평가 가중치 = 카테고리 단위(백엔드 competency-weight.util 과 동일 규칙).
 * 같은 카테고리 문항은 모두 같은 weight 를 공유하고, 평가표(직책자/비직책자)마다
 * 그 평가표에 나오는 카테고리 가중치 합 = 100%. 'all' 문항은 두 평가표에 모두 들어간다.
 */
import type { CompetencyQuestion } from './api';

export type Audience = 'manager' | 'non_manager';

export const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'manager', label: '직책자' },
  { key: 'non_manager', label: '비직책자' },
];

export const inAudience = (q: Pick<CompetencyQuestion, 'targetGroup'>, a: Audience) =>
  q.targetGroup === a || q.targetGroup === 'all';

/** 카테고리 가중치 맵 — 카테고리 내 최댓값(정상 데이터는 모두 같은 값). */
export function categoryWeightMap(
  questions: Pick<CompetencyQuestion, 'categoryId' | 'weight'>[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const q of questions) map.set(q.categoryId, Math.max(map.get(q.categoryId) ?? 0, q.weight));
  return map;
}

/** 평가표별 카테고리 가중치 합(활성 문항 기준). override 로 편집 중 값을 반영. 활성 문항 없으면 null. */
export function audienceSums(
  questions: CompetencyQuestion[],
  override?: Map<string, number>,
): Record<Audience, number | null> {
  const base = categoryWeightMap(questions);
  const result = {} as Record<Audience, number | null>;
  for (const { key } of AUDIENCES) {
    const cats = new Set(questions.filter((q) => q.isActive && inAudience(q, key)).map((q) => q.categoryId));
    result[key] = cats.size
      ? [...cats].reduce((s, c) => s + (override?.get(c) ?? base.get(c) ?? 0), 0)
      : null;
  }
  return result;
}
