// 테스트 계정으로 주요 페이지가 쓰는 API를 훑어 200 + 데이터 존재를 확인하는 스모크.
const BASE = 'http://localhost:4000/api/v1';

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@energyx.co.kr', password: '1234' }),
}).then((r) => r.json());
const token = login?.data?.accessToken ?? login?.data?.token;
if (!token) { console.error('LOGIN FAIL', JSON.stringify(login).slice(0, 300)); process.exit(1); }
console.log('LOGIN OK');
const H = { Authorization: `Bearer ${token}` };

const me = await fetch(`${BASE}/auth/me`, { headers: H }).then((r) => r.json());
const myId = me?.data?.id ?? me?.data?.user?.id;
const cycles = await fetch(`${BASE}/cycles`, { headers: H }).then((r) => r.json());
const cycle = (cycles.data ?? []).find((c) => c.year === 2026);
console.log(`me=${myId?.slice(0, 8)} cycle=${cycle?.id?.slice(0, 8)} status=${cycle?.status}`);

const checks = [
  ['내 KPI', `/kpis?cycleId=${cycle.id}&userId=${myId}`],
  ['KPI 검토(팀)', `/kpis?cycleId=${cycle.id}`],
  ['평가 목록(본인 관련)', `/evaluations?cycleId=${cycle.id}`],
  ['부서장 평가 목록', `/evaluations?cycleId=${cycle.id}&evaluatorId=${myId}`],
  ['중간점검(본인)', `/midterm/reviews?cycleId=${cycle.id}`],
  ['보완조치', `/action-items?cycleId=${cycle.id}`],
  ['재조정요청', `/midterm/rebaseline-requests?cycleId=${cycle.id}`],
  ['평가결과 목록', `/results?cycleId=${cycle.id}`],
  ['이의제기', `/appeals`],
  ['보상', `/compensations?cycleId=${cycle.id}`],
  ['월별 실적', `/monthly-performance?cycleId=${cycle.id}`],
  ['그룹 실적', `/group-performance?cycleId=${cycle.id}`],
  ['등급 풀', `/grade-pools?cycleId=${cycle.id}`],
  ['역량 문항', `/competency-questions?cycleId=${cycle.id}`],
  ['역량 응답(본인)', `/competency-responses?cycleId=${cycle.id}`],
  ['알림', `/notifications`],
  ['감사 로그', `/audit-logs?limit=10`],
  ['일정', `/cycles/${cycle.id}/schedules`],
  ['대시보드', `/dashboard/summary?cycleId=${cycle.id}`],
  ['조직도', `/org-chart`],
  ['평가자 정리 표', `/results/summary?cycleId=${cycle.id}`],
];

let fail = 0;
for (const [name, path] of checks) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: H });
    const body = await res.json().catch(() => null);
    const d = body?.data;
    const count = Array.isArray(d) ? d.length
      : Array.isArray(d?.items) ? d.items.length
      : Array.isArray(d?.rows) ? d.rows.length
      : d && typeof d === 'object' ? Object.keys(d).length : (d == null ? 0 : 1);
    const mark = res.status === 200 ? (count > 0 ? '✅' : '⚠️ 빈값') : `❌ ${res.status}`;
    if (res.status !== 200) fail++;
    console.log(`${mark} ${name} (${path.split('?')[0]}) → ${count}`);
    if (res.status !== 200) console.log('   ', JSON.stringify(body).slice(0, 200));
  } catch (e) { fail++; console.log(`❌ ${name} — ${e.message}`); }
}
console.log(fail === 0 ? '\nSMOKE PASS' : `\nSMOKE FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
