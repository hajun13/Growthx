// spec: e2e/specs/01-login-dashboard.md
// seed: e2e/tests/seed.spec.ts
import { test, expect } from './fixtures';

test.describe('01 로그인 → 대시보드 진입', () => {
  test('인증된 사용자는 대시보드로 진입한다', async ({ page }) => {
    // 1. 대시보드로 이동
    await page.goto('/dashboard');

    // 2. 로그인 페이지로 튕기지 않는다(세션 유효)
    await expect(page).not.toHaveURL(/\/login/);

    // 3. 대시보드 인삿말(김테스트)
    await expect(page.getByText(/안녕하세요, 김테스트/)).toBeVisible();

    // 4. 핵심 섹션
    await expect(page.getByText('나의 평가 진행 상황')).toBeVisible();
    await expect(page.getByText('바로가기')).toBeVisible();
  });

  test('비인증 상태로 보호 경로 접근 시 로그인으로 리다이렉트', async ({ browser }) => {
    // storageState 없는 깨끗한 컨텍스트
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    // 1. 보호 경로 직접 접근
    await page.goto('/dashboard');

    // 2. 로그인으로 리다이렉트 + 로그인 폼
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();

    await ctx.close();
  });
});
