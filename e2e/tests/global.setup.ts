import { test as setup, expect, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  API_URL, API_PREFIX, STORAGE_STATE, TOKENS_FILE, TEST_USER,
} from '../config';

/**
 * 인증 셋업 — 매 실행 1회.
 *
 * 프론트는 세션 토큰을 sessionStorage(gx.*) 에 보관한다(브라우저 닫으면 로그아웃).
 * Playwright storageState 는 sessionStorage 를 지원하지 않으므로, 토큰을 별도 파일
 * (TOKENS_FILE)로 기록하고 fixtures 가 addInitScript 로 sessionStorage 에 주입한다.
 * (빈 storageState 도 함께 남겨 chromium 프로젝트의 storageState 참조를 만족시킨다.)
 * JWT 만료로 토큰이 무효화될 수 있어 매 실행 재발급한다.
 */
setup('authenticate', async () => {
  const api = await request.newContext();
  const res = await api.post(`${API_URL}${API_PREFIX}/auth/login`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });
  expect(res.ok(), `로그인 실패(${res.status()}) — API/DB/시드 기동 확인`).toBeTruthy();

  const body = await res.json();
  const data = body?.data ?? body; // 응답 봉투 { data: {...} } unwrap
  const { accessToken, refreshToken, user } = data;
  expect(accessToken, '응답에 accessToken 이 없음').toBeTruthy();

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  // fixtures 가 sessionStorage 로 주입할 토큰.
  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({ access: accessToken, refresh: refreshToken ?? '', user: JSON.stringify(user) }, null, 2),
  );
  // chromium 프로젝트가 storageState 파일을 참조하므로 빈 상태라도 생성(쿠키 없음).
  fs.writeFileSync(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }, null, 2));
  await api.dispose();
});
