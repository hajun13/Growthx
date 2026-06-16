import { test as base, expect } from '@playwright/test';
import { TEST_USER } from '../config';

/**
 * 커스텀 픽스처 — planner/generator 가 생성하는 모든 테스트의 진입점.
 *
 * 인증은 playwright.config 의 chromium 프로젝트가 storageState 로 이미 적용하므로,
 * 여기 `page` 는 로그인된 상태로 시작한다. 추가 도메인 헬퍼는 이 파일에 픽스처로 더한다.
 */
type Fixtures = {
  /** 시드된 테스트 계정 정보 (읽기 전용). */
  testUser: typeof TEST_USER;
};

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    await use(TEST_USER);
  },
});

export { expect };
