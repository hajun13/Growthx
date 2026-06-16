// spec: e2e/specs/02-self-eval-submit.md
// seed: e2e/tests/seed.spec.ts
//
// 멱등성: 비가역 '최종 제출'은 시드 상태를 뒤집으므로 실행하지 않는다(spec 문서화).
// 본 테스트는 화면 렌더 + (활성 기간일 때) 제출 게이트까지를 상태-내성으로 검증한다.
// 현재 시드는 mid_review 라 self 기간이 비활성일 수 있어, 그 경우 렌더 검증까지만 수행.
import { test, expect } from './fixtures';

test.describe('02 본인평가(self)', () => {
  test('본인평가 화면이 크래시 없이 렌더된다', async ({ page }) => {
    await page.goto('/eval/self');
    await expect(page).not.toHaveURL(/\/login/);

    // 활성/비활성/대상아님 등 알려진 상태 중 하나가 보인다(빈 화면·크래시 아님).
    await expect(page.getByText(/본인평가|평가 대상이 아니에요|평가 주기가 없어요/).first())
      .toBeVisible();
  });

  test('본인평가 활성 기간이면 KPI 그룹·제출 게이트가 보인다', async ({ page }) => {
    await page.goto('/eval/self');
    await expect(page).not.toHaveURL(/\/login/);

    // 활성 폼(성과중심 지표 섹션)이 렌더된 경우에만 심화 검증.
    const formActive = await page
      .getByText('성과중심 지표').first()
      .isVisible()
      .catch(() => false);
    test.skip(!formActive, '현재 주기에서 본인평가 입력 기간이 아님(mid_review 등) — 렌더 검증은 위 테스트에서 수행');

    await expect(page.getByText('협업·성장 지표').first()).toBeVisible();
    // 제출하기 버튼이 존재한다(완료 전엔 비활성 게이트).
    await expect(page.getByRole('button', { name: /제출하기/ })).toBeVisible();
  });
});
