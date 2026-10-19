import { describe, it, expect } from 'vitest';
import { Grade } from '@prisma/client';
import {
  GRADE_SCORE,
  audienceWeightSums,
  categoryWeightedScore,
  categoryWeights,
} from './competency-weight.util';

// 2025 엑셀 양식: 4카테고리 × 4문항, 카테고리 가중치 30/25/15/30 을 문항마다 반복 저장.
const CATS = [
  ['c1', 30],
  ['c2', 25],
  ['c3', 15],
  ['c4', 30],
] as const;
const excelQuestions = CATS.flatMap(([cat, w]) =>
  [0, 1, 2, 3].map((i) => ({ id: `${cat}-q${i}`, categoryId: cat, weight: w })),
);
const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

/** 기존(엑셀 환산표2) 식 — Σ(점수×문항가중치)/(5×Σ가중치)×100. */
function legacyExcelScore(qs: typeof excelQuestions, rows: { questionId: string; grade: Grade }[]) {
  const w = new Map(qs.map((q) => [q.id, q.weight]));
  let num = 0;
  let den = 0;
  for (const r of rows) {
    num += GRADE_SCORE[r.grade] * (w.get(r.questionId) ?? 0);
    den += 5 * (w.get(r.questionId) ?? 0);
  }
  return Math.round((num / den) * 100 * 100) / 100;
}

describe('categoryWeightedScore', () => {
  it('카테고리별 문항 수가 같으면 기존 엑셀 환산식과 같은 값(2025 아카이브 불변)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rows = excelQuestions.map((q, i) => ({
        questionId: q.id,
        grade: GRADES[(i * 7 + seed * 3) % 5],
      }));
      expect(categoryWeightedScore(excelQuestions, rows)).toBe(legacyExcelScore(excelQuestions, rows));
    }
  });

  it('카테고리별 문항 수가 달라도 카테고리 가중치 비중을 그대로 지킨다', () => {
    // c1(70%) 문항 1개 = S(5점), c2(30%) 문항 3개 = D(1점)
    const qs = [
      { id: 'a', categoryId: 'c1', weight: 70 },
      { id: 'b1', categoryId: 'c2', weight: 30 },
      { id: 'b2', categoryId: 'c2', weight: 30 },
      { id: 'b3', categoryId: 'c2', weight: 30 },
    ];
    const rows = [
      { questionId: 'a', grade: 'S' as Grade },
      { questionId: 'b1', grade: 'D' as Grade },
      { questionId: 'b2', grade: 'D' as Grade },
      { questionId: 'b3', grade: 'D' as Grade },
    ];
    // (0.7×5 + 0.3×1) / 5 × 100 = 76
    expect(categoryWeightedScore(qs, rows)).toBe(76);
  });

  it('응답 없는 카테고리는 분모에서 빠지고, 응답이 없으면 null', () => {
    const rows = [{ questionId: 'c1-q0', grade: 'A' as Grade }];
    expect(categoryWeightedScore(excelQuestions, rows)).toBe(80);
    expect(categoryWeightedScore(excelQuestions, [])).toBeNull();
  });

  it('가중치가 전부 0이면 카테고리 균등', () => {
    const qs = [
      { id: 'a', categoryId: 'c1', weight: 0 },
      { id: 'b1', categoryId: 'c2', weight: 0 },
      { id: 'b2', categoryId: 'c2', weight: 0 },
    ];
    const rows = [
      { questionId: 'a', grade: 'S' as Grade },
      { questionId: 'b1', grade: 'D' as Grade },
      { questionId: 'b2', grade: 'D' as Grade },
    ];
    expect(categoryWeightedScore(qs, rows)).toBe(60);
  });

  it('가중치 0 카테고리는 환산에서 제외', () => {
    const qs = [
      { id: 'a', categoryId: 'c1', weight: 100 },
      { id: 'b', categoryId: 'c2', weight: 0 },
    ];
    const rows = [
      { questionId: 'a', grade: 'B' as Grade },
      { questionId: 'b', grade: 'S' as Grade },
    ];
    expect(categoryWeightedScore(qs, rows)).toBe(60);
  });
});

describe('categoryWeights / audienceWeightSums', () => {
  it('카테고리 대표값 = 카테고리 내 최댓값(레거시 상이값도 결정적)', () => {
    const m = categoryWeights([
      { categoryId: 'c1', weight: 10 },
      { categoryId: 'c1', weight: 30 },
      { categoryId: 'c2', weight: 25 },
    ]);
    expect(Object.fromEntries(m)).toEqual({ c1: 30, c2: 25 });
  });

  it("평가표별 합 — 'all' 문항 카테고리는 양쪽에 포함, 비활성 문항만 있는 카테고리는 제외", () => {
    const sums = audienceWeightSums([
      { categoryId: 'shared', weight: 40, targetGroup: 'all', isActive: true },
      { categoryId: 'lead', weight: 60, targetGroup: 'manager', isActive: true },
      { categoryId: 'lead', weight: 60, targetGroup: 'manager', isActive: true },
      { categoryId: 'work', weight: 50, targetGroup: 'non_manager', isActive: true },
      { categoryId: 'off', weight: 99, targetGroup: 'non_manager', isActive: false },
    ]);
    expect(sums).toEqual({ manager: 100, non_manager: 90 });
  });

  it('활성 문항이 없는 평가표는 null', () => {
    const sums = audienceWeightSums([
      { categoryId: 'lead', weight: 100, targetGroup: 'manager', isActive: true },
    ]);
    expect(sums).toEqual({ manager: 100, non_manager: null });
  });
});
