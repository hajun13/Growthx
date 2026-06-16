// spec: e2e/specs/04-midterm-checkin.md
// seed: e2e/tests/seed.spec.ts
//
// 현재 시드는 cycle = mid_review 이므로 중간점검이 활성 화면이다.
// hr_admin(showMyTab=false)은 '구성원 점검'(DeptHeadMidterm)을 단일 탭으로 본다.
import { test, expect } from './fixtures';

test.describe('04 중간점검 자가체크', () => {
  test('중간점검 화면이 렌더되고 비구속(점검 기간) 안내가 보인다', async ({ page }) => {
    await page.goto('/eval/midterm');
    await expect(page).not.toHaveURL(/\/login/);

    // 제목
    await expect(page.getByText('중간 점검').first()).toBeVisible();

    // mid_review → '점검 기간' 배지 + 비구속 InfoBanner
    await expect(page.getByText('점검 기간', { exact: true })).toBeVisible();
    await expect(page.getByText('중간평가는 점검·코칭 단계예요')).toBeVisible();
    await expect(page.getByText(/등급·연봉에 반영되지 않아요/)).toBeVisible();
  });

  test('hr_admin은 구성원 진척 검토 탭을 본다', async ({ page }) => {
    await page.goto('/eval/midterm');
    await expect(page).not.toHaveURL(/\/login/);

    // DeptHeadMidterm 상위 탭 3종 중 기본 탭
    await expect(page.getByText('구성원 진척 검토').first()).toBeVisible();
    await expect(page.getByText('조직 진척 요약').first()).toBeVisible();
  });
});
