import path from 'node:path';

/**
 * E2E 공유 상수 — playwright.config.ts 와 tests/global.setup.ts 가 함께 사용.
 *
 * 기본값은 로컬 dev/Docker 스택(web :3000 · api :4000) 전제.
 * CI나 다른 호스트는 환경변수로 덮어쓴다.
 */
export const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
export const API_PREFIX = '/api/v1';

/** 인증 storageState 파일 — global.setup 이 생성, chromium 프로젝트가 재사용(쿠키용). */
export const STORAGE_STATE = path.join(__dirname, '.auth', 'state.json');

/**
 * 발급 토큰 파일 — global.setup 이 기록, fixtures 가 읽어 sessionStorage 에 주입.
 * 프론트가 세션 토큰을 sessionStorage 에 보관하므로(브라우저 닫으면 로그아웃),
 * Playwright storageState(localStorage/쿠키만 지원)로는 인증을 심을 수 없어 별도 파일로 전달한다.
 */
export const TOKENS_FILE = path.join(__dirname, '.auth', 'tokens.json');

/** 프론트가 JWT 를 보관하는 sessionStorage 키 (apps/web/lib/auth.ts 와 일치해야 함). */
export const AUTH_KEYS = {
  access: 'gx.accessToken',
  refresh: 'gx.refreshToken',
  user: 'gx.user',
} as const;

/** 전 페이지 데이터가 시드된 테스트 계정 (apps/api/prisma/seed-test-data.ts). */
export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? 'test@energyx.co.kr',
  password: process.env.E2E_USER_PASSWORD ?? '1234',
} as const;
