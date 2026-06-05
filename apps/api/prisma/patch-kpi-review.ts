/**
 * 패치: KPI 검토 화면 — 승인·반려·수정요청 버튼 시나리오 데이터
 *
 * 일부 팀원의 KPI를 confirmed → submitted 상태로 변경
 * (직원이 과제를 제출했으나 팀장이 아직 검토하지 않은 상태)
 *
 * 각 팀장이 최소 2명 이상의 검토 대기 KPI를 볼 수 있도록 구성.
 */
import { PrismaClient, KpiStatus } from '@prisma/client';

const prisma = new PrismaClient();

const REVIEW_SCENARIO: Array<{
  email: string;
  name: string;
  submitCount: number;
  reviewerEmail: string; // 검토할 팀장
}> = [
  // leadPlant(김팀장) 검토 대상
  { email: 'pro@energyx.co.kr',             name: '이프로',   submitCount: 2, reviewerEmail: 'lead@energyx.co.kr' },
  { email: 'plant.kim@energyx.co.kr',        name: '김플랜',   submitCount: 1, reviewerEmail: 'lead@energyx.co.kr' },
  // leadConstruct(박시공) 검토 대상
  { email: 'construct.park@energyx.co.kr',   name: '박현장',   submitCount: 2, reviewerEmail: 'lead.construct@energyx.co.kr' },
  // leadProcure(최구매) 검토 대상
  { email: 'procure.han@energyx.co.kr',      name: '한조달',   submitCount: 1, reviewerEmail: 'lead.procure@energyx.co.kr' },
  // leadDomestic(정국내) 검토 대상
  { email: 'domestic.yoo@energyx.co.kr',     name: '유세일',   submitCount: 2, reviewerEmail: 'lead.domestic@energyx.co.kr' },
  // leadGlobal(윤해외) 검토 대상
  { email: 'global.bae@energyx.co.kr',       name: '배글로',   submitCount: 1, reviewerEmail: 'lead.global@energyx.co.kr' },
  // leadFinance(조재무) 검토 대상
  { email: 'finance.jang@energyx.co.kr',     name: '장재무',   submitCount: 2, reviewerEmail: 'lead.finance@energyx.co.kr' },
  // leadHR(임총무) 검토 대상
  { email: 'hr.shin@energyx.co.kr',          name: '신인사',   submitCount: 1, reviewerEmail: 'lead.hr@energyx.co.kr' },
  // divEPC(오본부) — 팀장도 본부장에게 검토 대기
  { email: 'lead.construct@energyx.co.kr',   name: '박시공(팀장)', submitCount: 1, reviewerEmail: 'division@energyx.co.kr' },
  { email: 'lead.procure@energyx.co.kr',     name: '최구매(팀장)', submitCount: 1, reviewerEmail: 'division@energyx.co.kr' },
];

async function main() {
  // 진행 주기 조회
  const cycle = await prisma.evaluationCycle.findFirst({
    where: { status: 'mid_review' },
    orderBy: { year: 'desc' },
  });
  if (!cycle) { console.error('❌ 진행 중인 주기 없음 (mid_review)'); return; }
  console.log(`✔ 주기: ${cycle.name} (${cycle.id})`);

  let total = 0;
  for (const s of REVIEW_SCENARIO) {
    const user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) { console.warn(`  ⚠ 사용자 없음: ${s.email}`); continue; }

    // confirmed 상태인 KPI 중 앞에서 N개를 submitted으로 변경
    const kpis = await prisma.kpi.findMany({
      where: { userId: user.id, cycleId: cycle.id, status: KpiStatus.confirmed },
      take: s.submitCount,
      orderBy: { createdAt: 'asc' },
    });

    for (const kpi of kpis) {
      await prisma.kpi.update({
        where: { id: kpi.id },
        data: {
          status: KpiStatus.submitted,
          updatedAt: new Date(),
        },
      });
      console.log(`  ✓ [${s.reviewerEmail.split('@')[0]}→${s.name}] "${kpi.title}" confirmed→submitted`);
      total++;
    }
  }

  // 현황 확인
  const [confirmed, submitted, approved, draft] = await Promise.all([
    prisma.kpi.count({ where: { cycleId: cycle.id, status: KpiStatus.confirmed } }),
    prisma.kpi.count({ where: { cycleId: cycle.id, status: KpiStatus.submitted } }),
    prisma.kpi.count({ where: { cycleId: cycle.id, status: KpiStatus.approved  } }),
    prisma.kpi.count({ where: { cycleId: cycle.id, status: KpiStatus.draft     } }),
  ]);

  console.log(`\n✅ 패치 완료 — ${total}개 KPI submitted 전환`);
  console.log(`   진행 주기 KPI 상태 현황:`);
  console.log(`     draft     : ${draft}`);
  console.log(`     submitted : ${submitted}  ← 검토 대기 (버튼 활성)`);
  console.log(`     approved  : ${approved}`);
  console.log(`     confirmed : ${confirmed}`);
  console.log(`\n   팀장별 검토 대기 현황:`);

  for (const reviewerEmail of [...new Set(REVIEW_SCENARIO.map(s => s.reviewerEmail))]) {
    const reviewer = await prisma.user.findUnique({ where: { email: reviewerEmail } });
    if (!reviewer) continue;
    // 해당 팀장 산하 사용자 목록
    const reports = await prisma.user.findMany({ where: { managerId: reviewer.id } });
    const reportIds = reports.map(r => r.id);
    const cnt = await prisma.kpi.count({
      where: { cycleId: cycle.id, status: KpiStatus.submitted, userId: { in: reportIds } },
    });
    if (cnt > 0) console.log(`     ${reviewer.name} (${reviewerEmail.split('@')[0]}): ${cnt}개 대기`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
