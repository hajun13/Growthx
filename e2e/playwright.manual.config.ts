import { defineConfig, devices } from '@playwright/test';
import { WEB_URL } from './config';

/**
 * 사용자 매뉴얼 캡처 전용 설정.
 *
 * 기능 테스트(playwright.config.ts)와 분리한 이유:
 *  - 뷰포트를 1920x1080 으로 고정해야 한다(매뉴얼 규격)
 *  - 재시도·병렬 실행이 캡처 순서/일관성을 흐트러뜨린다 → workers 1, retries 0
 *  - webServer 를 띄우지 않는다. 이미 기동된 스택(로컬 Docker :3000/:4000)을 그대로 찍는다.
 *    스택이 없으면 setup 의 로그인 요청이 즉시 실패하며 원인을 알려준다.
 */
export default defineConfig({
  testDir: __dirname,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  // 인증 셋업 프로젝트가 없다. 역할마다 다른 계정으로 로그인해야 해서
  // capture.spec 이 역할별로 직접 로그인하고 토큰을 주입한다.
  projects: [
    {
      name: 'manual',
      testMatch: /manual[\\/].*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
