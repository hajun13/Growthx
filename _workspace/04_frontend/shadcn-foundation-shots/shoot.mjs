// usage: node shoot.mjs <label> <baseUrl>   — 패리티 스크린샷(API 목킹: 로그인 외엔 빈 데이터)
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [label = 'before', base = 'http://localhost:3100'] = process.argv.slice(2);
const out = path.dirname(fileURLToPath(import.meta.url));
const user = { id: 'u1', email: 'hr@example.com', name: '김관리', role: 'hr_admin', position: 'director', departmentId: null, managerId: null, jobLevel: 'chief', mustChangePassword: false, visibilityScope: 'company', isActive: true, employmentStatus: 'active', legalEntity: 'energyx', resignedAt: null, evaluationExempt: false, evaluationExemptReason: null, hireDate: null, birthDate: null, age: null };
const pages = ['/login', '/dashboard', '/kpi', '/eval/my', '/eval/self', '/admin/users', '/admin/rules', '/admin/cycle', '/org', '/reports', '/notifications'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
await ctx.addInitScript((u) => {
  if (location.pathname.startsWith('/login')) return;
  sessionStorage.setItem('gx.accessToken', 'x'); sessionStorage.setItem('gx.refreshToken', 'y'); sessionStorage.setItem('gx.user', JSON.stringify(u));
}, user);
await ctx.route('**/api/v1/**', (route) => {
  const url = route.request().url();
  const cycle = { id: 'c1', name: '2026 연간 평가', year: 2026, type: 'annual', status: 'active', startDate: '2026-01-01', endDate: '2026-12-31' };
  const users = [user, { ...user, id: 'u2', name: '박팀장', email: 'lead@example.com', role: 'team_lead', position: 'team_lead' }, { ...user, id: 'u3', name: '이사원', email: 'emp@example.com', role: 'employee', position: 'pro' }];
  let data = [];
  if (/auth\/(me|login|refresh)/.test(url)) data = user;
  else if (/permissions\/config|dashboard\/summary/.test(url)) data = {};
  else if (/\/cycles(\?|$)/.test(url)) data = [cycle];
  else if (/\/users(\?|$)/.test(url)) data = users;
  const body = { data, meta: { total: Array.isArray(data) ? data.length : 0, page: 1, pageSize: 20 } };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
for (const p of pages) {
  const page = await ctx.newPage();
  await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);
  const name = p.replace(/\//g, '_').replace(/^_/, '') || 'root';
  await page.screenshot({ path: path.join(out, `${label}__${name}.png`), fullPage: false });
  console.log(label, p, '->', page.url().replace(base, ''));
  await page.close();
}
await browser.close();
