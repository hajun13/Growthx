import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import { TEST_USER, TOKENS_FILE, AUTH_KEYS } from '../config';

/**
 * 커스텀 픽스처 — planner/generator 가 생성하는 모든 테스트의 진입점.
 *
 * 프론트가 세션 토큰을 sessionStorage 에 보관하므로(브라우저 닫으면 로그아웃),
 * storageState(localStorage/쿠키만 지원)로는 인증을 심을 수 없다. 대신 global.setup 이
 * 발급해 TOKENS_FILE 에 기록한 토큰을 addInitScript 로 매 페이지 로드 전 sessionStorage 에 주입한다.
 * 앱 스크립트보다 먼저 실행되므로, 여기 `page` 는 로그인된 상태로 시작한다.
 */
type Fixtures = {
  /** 시드된 테스트 계정 정보 (읽기 전용). */
  testUser: typeof TEST_USER;
};

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },
  page: async ({ page }, use) => {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')) as {
      access: string;
      refresh: string;
      user: string;
    };
    await page.addInitScript(
      ({ keys, t }) => {
        window.sessionStorage.setItem(keys.access, t.access);
        window.sessionStorage.setItem(keys.refresh, t.refresh);
        window.sessionStorage.setItem(keys.user, t.user);
      },
      { keys: AUTH_KEYS, t: tokens },
    );
    await use(page);
  },
});

export { expect };
