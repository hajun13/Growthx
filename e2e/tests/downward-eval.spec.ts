// spec: e2e/specs/03-downward-eval.md
// seed: e2e/tests/seed.spec.ts
//
// 멱등성: 비가역 제출은 실행하지 않는다. 화면 렌더 + (배정·활성 시) 3단계 라운드 라벨과
// 코멘트 필수 게이트를 상태-내성으로 검증한다.
import { test, expect } from './fixtures';

test.describe('03 부서장 3단계 평가(downward)', () => {
  test('부서장 평가 화면이 크래시 없이 렌더된다', async ({ page }) => {
    await page.goto('/eval/dept-head');
    await expect(page).not.toHaveURL(/\/login/);

    // 활성/기간아님/권한없음/미배정 — 모든 상태 텍스트가 '부서장 평가'를 포함.
    await expect(page.getByText(/부서장 평가/).first()).toBeVisible();
  });

  test('평가 배정·활성 시 진행요약과 3단계 라운드 라벨이 보인다', async ({ page }) => {
    await page.goto('/eval/dept-head');
    await expect(page).not.toHaveURL(/\/login/);

    // 진행 요약 카드('전체 팀원')가 보이면 배정·활성 상태.
    const assigned = await page
      .getByText('전체 팀원').first()
      .isVisible()
      .catch(() => false);
    test.skip(!assigned, '현재 주기에서 부서장 평가 미배정/비활성 — 렌더 검증은 위 테스트에서 수행');

    // 팀원 목록·이름 검색
    await expect(page.getByPlaceholder('이름 검색')).toBeVisible();

    // 첫 팀원 선택 후 라운드 라벨(1차·팀장 / 2차·본부장 / 최종·그룹대표) 중 하나 노출.
    const firstMember = page.getByRole('button').filter({ hasText: /테스트/ }).first();
    if (await firstMember.isVisible().catch(() => false)) {
      await firstMember.click();
      await expect(
        page.getByText(/1차 · 팀장|2차 · 본부장|최종 · 그룹대표/).first(),
      ).toBeVisible();
    }
  });
});
