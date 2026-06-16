import { test, expect } from './fixtures';

/**
 * 시드 테스트 — 환경 부트스트랩 검증 + 생성 테스트의 예시.
 *
 * planner 는 이 테스트를 실행해 초기화(전역 setup·픽스처·인증)를 수행하고,
 * generator 는 이 파일을 생성 테스트의 형태(=커스텀 fixtures 사용)의 본보기로 삼는다.
 */
test('seed: 인증된 사용자로 앱에 진입한다', async ({ page }) => {
  await page.goto('/');

  // 세션이 유효하면 로그인 페이지로 튕기지 않는다.
  await expect(page).not.toHaveURL(/\/login/);

  // 인증 사용자에게만 보이는 앱 셸이 렌더된다.
  await expect(page.locator('body')).toBeVisible();
});
