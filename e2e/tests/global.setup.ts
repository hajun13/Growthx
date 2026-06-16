import { test as setup, expect, request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  WEB_URL, API_URL, API_PREFIX, STORAGE_STATE, AUTH_KEYS, TEST_USER,
} from '../config';

/**
 * 인증 셋업 — 매 실행 1회.
 *
 * 프론트는 JWT 를 쿠키가 아니라 localStorage(gx.*) 에 보관하므로, storageState 의
 * origins[].localStorage 에 토큰을 주입한다. (쿠키만 저장하면 전 테스트가 미인증)
 * JWT 만료로 state 가 무효화될 수 있어 매 실행 재발급한다.
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
  fs.writeFileSync(
    STORAGE_STATE,
    JSON.stringify(
      {
        cookies: [],
        origins: [
          {
            origin: WEB_URL,
            localStorage: [
              { name: AUTH_KEYS.access, value: accessToken },
              { name: AUTH_KEYS.refresh, value: refreshToken ?? '' },
              { name: AUTH_KEYS.user, value: JSON.stringify(user) },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  await api.dispose();
});
