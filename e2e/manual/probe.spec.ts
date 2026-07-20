import { test } from '@playwright/test';
import { API_URL, API_PREFIX, AUTH_KEYS } from '../config';
import { ROLES, type RoleDef } from './roles';

/**
 * 화면 구조 프로브 — 모달·콜아웃 셀렉터를 짤 때 쓰는 작업 도구.
 *
 * 앱에 data-testid 가 없어 셀렉터를 화면의 한글 텍스트로 잡아야 하는데, 역할·주기 단계에
 * 따라 버튼이 달라진다. 추측으로 캡처를 돌리면 실패 왕복이 길어져서, 먼저 실제로 뜬
 * 버튼 이름을 훑는다.
 *
 *   MANUAL_STACK=1 pnpm -C e2e manual:probe
 *
 * 캡처 대상이 아니므로 매뉴얼 산출물에는 영향이 없다.
 */
/** PROBE_PATHS·MANUAL_ROLE 로 범위를 좁힐 수 있다 — 전 화면을 도는 건 느리다. */
const PATHS = (
  process.env.PROBE_PATHS ??
  '/kpi,/eval/self,/eval/midterm,/appeals,/eval/dept-head,/eval/result,/notifications'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ROLE_FILTER = (process.env.MANUAL_ROLE ?? '').trim();

for (const role of ROLES) {
  if (ROLE_FILTER && role.key !== ROLE_FILTER) continue;
  test(`probe: ${role.slug}`, async ({ page, request }) => {
    // 화면 7개를 순회하며 대상 선택까지 하므로 기본 타임아웃(90s)으로는 모자란다.
    test.setTimeout(300_000);
    const tokens = await login(request, role);
    await page.addInitScript(
      ({ keys, t }) => {
        for (const s of [window.localStorage, window.sessionStorage]) {
          try {
            s.setItem(keys.access, t.access);
            s.setItem(keys.refresh, t.refresh);
            s.setItem(keys.user, t.user);
          } catch {
            /* noop */
          }
        }
      },
      { keys: AUTH_KEYS, t: tokens },
    );

    for (const p of PATHS) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1000);
      if (new URL(page.url()).pathname.startsWith('/login')) {
        console.log(`\n### ${role.slug} ${p} → 로그인으로 튕김`);
        continue;
      }

      console.log(`\n### ${role.slug} ${p}  (실제 URL ${new URL(page.url()).pathname})`);
      console.log('  ' + (await buttons(page)));

      // master-detail 화면은 대상을 골라야 액션 버튼이 나온다.
      const subject = page.locator('.gx-master-detail button, [class*="subject"] button').first();
      if (await subject.count()) {
        await subject.click().catch(() => {});
        await page.waitForTimeout(900);
        console.log('  [대상 선택 후] ' + (await buttons(page)));
      }
    }
  });
}

async function buttons(page: import('@playwright/test').Page): Promise<string> {
  const names = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 30),
  );
  const skip = ['인사평가', '실적관리', '모니터링', '기타'];
  return [...new Set(names)].filter((n) => !skip.includes(n)).join(' | ') || '(없음)';
}

async function login(request: import('@playwright/test').APIRequestContext, role: RoleDef) {
  const res = await request.post(`${API_URL}${API_PREFIX}/auth/login`, {
    data: { email: role.email, password: role.password },
  });
  if (!res.ok()) throw new Error(`${role.label} 로그인 실패(${res.status()})`);
  const d = (await res.json()).data;
  return {
    access: d.accessToken as string,
    refresh: (d.refreshToken ?? '') as string,
    user: JSON.stringify(d.user),
  };
}
