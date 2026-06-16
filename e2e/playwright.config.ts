import { defineConfig, devices } from '@playwright/test';
import { WEB_URL, API_URL, API_PREFIX, STORAGE_STATE } from './config';

/**
 * Playwright E2E 설정 — 에너지엑스 인사 평가.
 *
 * - baseURL: web(:3000). API 는 same-origin 프록시(/api/v1 → API_PROXY_TARGET)로 호출.
 * - 인증: setup 프로젝트(global.setup)가 /auth/login → JWT 를 storageState localStorage 에 주입,
 *         chromium 프로젝트가 이를 재사용해 매 테스트 로그인 UI 를 건너뛴다.
 * - webServer: 로컬 dev 자동기동(이미 떠 있으면 재사용). DB(:5432)·시드는 사전 가용 전제.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: WEB_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],

  webServer: [
    {
      command: 'pnpm -C ../apps/api run start:dev',
      url: `${API_URL}${API_PREFIX}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm -C ../apps/web run dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // 브라우저는 same-origin(/api/v1)으로 호출 → web 이 API 로 프록시.
      env: { API_PROXY_TARGET: API_URL },
    },
  ],
});
