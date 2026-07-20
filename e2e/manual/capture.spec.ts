import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API_URL, API_PREFIX, AUTH_KEYS } from '../config';
import { SCREENS } from './screens';
import { ROLES, type RoleDef } from './roles';
import { annotate } from './annotate';
import { writeManuals, type CaptureRow } from './manual-doc';

/**
 * 사용자 매뉴얼용 화면 캡처 — 1920x1080 고정, 역할별.
 *
 * 캡처 대상은 매뉴얼 격리 스택(MANUAL_STACK=1 → :3100/:4100)을 전제로 한다.
 * 그 DB 는 익명화된 사본이라 주기 단계·일정 창을 자유롭게 바꿀 수 있다.
 *
 * 인증은 역할별 계정으로 API 로그인한 토큰을 addInitScript 로 sessionStorage 에 심는다
 * (프론트가 sessionStorage 를 쓰므로 storageState 로는 심을 수 없다).
 */
const OUT_ROOT = path.join(__dirname, '..', '..', 'docs', 'manual', 'images');
const REPORT = path.join(__dirname, '..', '..', 'docs', 'manual', '.capture-report.json');

/**
 * 일부만 다시 찍을 때 — 화면마다 필요한 주기 단계가 다르다.
 *   MANUAL_ONLY=eval-my,competency-eval pnpm -C e2e manual
 *   MANUAL_ROLE=team_lead pnpm -C e2e manual
 */
const ONLY = (process.env.MANUAL_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const ROLE_FILTER = (process.env.MANUAL_ROLE ?? '').trim();

const rows: CaptureRow[] = [];

test.afterAll(() => {
  // 부분 재캡처여도 문서에는 전 화면이 담겨야 하므로 이전 실행 기록과 병합한다.
  const prev: CaptureRow[] = fs.existsSync(REPORT)
    ? (JSON.parse(fs.readFileSync(REPORT, 'utf8')) as CaptureRow[])
    : [];
  const merged = new Map(prev.map((r) => [`${r.role}/${r.key}`, r]));
  for (const r of rows) merged.set(`${r.role}/${r.key}`, r);
  const all = [...merged.values()];

  fs.writeFileSync(REPORT, JSON.stringify(all, null, 2), 'utf8');
  const files = writeManuals(all);

  const missing = rows.flatMap((r) =>
    r.missing.map((m) => `${r.role}/${r.key} #${m.index} (${m.reason})`),
  );
  console.log(`\n매뉴얼 생성: ${files.join(', ')}`);
  console.log(`이번 실행 ${rows.length}장 · 문서 전체 ${all.length}장`);
  if (missing.length) console.log(`⚠ 표시 실패 콜아웃 ${missing.length}건:\n  ${missing.join('\n  ')}`);
});

test.use({ viewport: { width: 1920, height: 1080 } });

for (const role of ROLES) {
  if (ROLE_FILTER && role.key !== ROLE_FILTER) continue;

  const targets = SCREENS.filter(
    (s) => s.roles.includes(role.key) && (ONLY.length === 0 || ONLY.includes(s.key)),
  );
  if (targets.length === 0) continue;

  test.describe(`${role.label}(${role.key})`, () => {
    let tokens: { access: string; refresh: string; user: string };

    test.beforeAll(async () => {
      fs.mkdirSync(path.join(OUT_ROOT, role.slug), { recursive: true });
      tokens = await login(role);
    });

    for (const screen of targets) {
      test(`${role.slug}: ${screen.key} (${screen.title})`, async ({ page }) => {
        await page.addInitScript(
          ({ keys, t }) => {
            for (const store of [window.localStorage, window.sessionStorage]) {
              try {
                store.setItem(keys.access, t.access);
                store.setItem(keys.refresh, t.refresh);
                store.setItem(keys.user, t.user);
              } catch {
                /* 접근 불가 저장소는 건너뛴다 */
              }
            }
          },
          { keys: AUTH_KEYS, t: tokens },
        );

        await page
          .addStyleTag({
            content: `*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`,
          })
          .catch(() => {});

        await page.goto(screen.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});

        // 인증이 깨지면 앱이 클라이언트에서 /login 으로 되돌린다. 로딩이 끝난 뒤 확인해야
        // 리다이렉트 이전에 통과해 로그인 화면을 조용히 캡처하는 일을 막는다.
        if (new URL(page.url()).pathname.startsWith('/login')) {
          throw new Error(`${role.slug}/${screen.key}: 인증 실패로 /login 으로 튕김`);
        }
        await expect(page.locator('aside').first()).toBeVisible({ timeout: 15_000 });

        await page
          .locator('.animate-pulse')
          .first()
          .waitFor({ state: 'detached', timeout: 10_000 })
          .catch(() => {});

        if (screen.setup) await screen.setup(page);

        // setup 뒤에 확인한다 — 모달 화면은 setup 이 열어줘야 비로소 존재한다.
        if (screen.waitFor) {
          await page.locator(screen.waitFor).first().waitFor({ state: 'visible', timeout: 15_000 });
        }
        await page.waitForTimeout(700);

        const result = screen.callouts?.length
          ? await annotate(page, screen.callouts)
          : { drawn: [], missing: [] };

        const image = `${screen.key}.png`;
        await page.screenshot({ path: path.join(OUT_ROOT, role.slug, image) });

        rows.push({
          role: role.key,
          key: screen.key,
          image,
          missing: result.missing,
        });

        if (screen.callouts?.length && result.drawn.length === 0) {
          throw new Error(
            `${role.slug}/${screen.key}: 콜아웃 ${screen.callouts.length}개 전부 매칭 실패`,
          );
        }
      });
    }
  });
}

/** 역할 계정으로 로그인해 프론트에 심을 토큰을 받는다. */
async function login(role: RoleDef) {
  const api = await playwrightRequest.newContext();
  const res = await api.post(`${API_URL}${API_PREFIX}/auth/login`, {
    data: { email: role.email, password: role.password },
  });
  if (!res.ok()) {
    throw new Error(
      `${role.label} 로그인 실패(${res.status()}) — 계정 ${role.email} · 스택 ${API_URL} 확인`,
    );
  }
  const body = await res.json();
  const data = body?.data ?? body;
  await api.dispose();
  return {
    access: data.accessToken as string,
    refresh: (data.refreshToken ?? '') as string,
    user: JSON.stringify(data.user),
  };
}
