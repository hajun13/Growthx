/**
 * 인사평가 솔루션 — 시드 (에너지엑스 2026 기본값) · v2 도메인 대정정 반영
 * business-rules.md §1~5 의 2026 기본값을 RuleSet에 주입하고,
 * 조직(그룹→본부→팀)·역할별 사용자·active Cycle·KPI 양식(category/group)·
 * 그룹 실적·등급 풀·데모 KPI를 생성한다.
 *
 * ⚠️ 역량/다면 잔재 제거: CompetencyItem 시드 없음, KPI 양식은 category/group/measureType 기반.
 */
import {
  PrismaClient,
  Role,
  Position,
  JobLevel,
  DepartmentType,
  CycleStatus,
  KpiCategory,
  KpiGroup,
  MeasureType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// business-rules 2026 기본값 (측정방식별 gradingScales 포함)
const RULE_SET_2026 = {
  // §1 점수 → 등급
  gradeScale: [
    { grade: 'S', min: 96, max: 100 },
    { grade: 'A', min: 91, max: 95 },
    { grade: 'B', min: 85, max: 90 },
    { grade: 'C', min: 80, max: 84 },
    { grade: 'D', min: 0, max: 79 },
  ],
  // §2 측정방식별 달성률 → 등급 (amount/rate). count 는 KPI별 grading, qualitative 는 직접 부여.
  gradingScales: {
    amount: [
      { grade: 'S', minRate: 110.0001, maxRate: null },
      { grade: 'A', minRate: 101, maxRate: 110 },
      { grade: 'B', minRate: 100, maxRate: 100 },
      { grade: 'C', minRate: 90, maxRate: 99 },
      { grade: 'D', minRate: 0, maxRate: 89.9999 },
    ],
    rate: [
      { grade: 'S', minRate: 110.0001, maxRate: null },
      { grade: 'A', minRate: 101, maxRate: 110 },
      { grade: 'B', minRate: 100, maxRate: 100 },
      { grade: 'C', minRate: 90, maxRate: 99 },
      { grade: 'D', minRate: 0, maxRate: 89.9999 },
    ],
  },
  // §3 그룹 tier별 등급 분포 상한
  poolRatios: {
    excellent: { S: 10, A: 20, B: 50, C: 15, D: 5 },
    standard: { S: 5, A: 10, B: 60, C: 20, D: 5 },
    poor: { S: 3, A: 7, B: 60, C: 25, D: 5 },
  },
  // §5 인상률
  raiseRates: { S: 7, A: 5, B: 3, C: 1, D: 0 },
  // §4 가중치 정책
  weightPolicy: { totalMustEqual: 100, qualitativeMaxPercent: 30 },
};

// count 측정방식 KPI별 건수 임계값 예시 (협업성과 본부장: 20/15/10/5건)
const COUNT_GRADING_COLLAB = [
  { grade: 'S', minCount: 20, maxCount: null },
  { grade: 'A', minCount: 15, maxCount: 19 },
  { grade: 'B', minCount: 10, maxCount: 14 },
  { grade: 'C', minCount: 5, maxCount: 9 },
  { grade: 'D', minCount: 0, maxCount: 4 },
];

async function main() {
  const passwordHash = await bcrypt.hash('Passw0rd!', 10);

  // ── 조직 트리: 그룹(최상위) → 본부 → 팀 ──
  const group = await prisma.department.create({
    data: { name: '성장그룹', type: DepartmentType.group },
  });
  const division = await prisma.department.create({
    data: { name: '사업본부', type: DepartmentType.division, parentId: group.id },
  });
  const team = await prisma.department.create({
    data: { name: '플랫폼팀', type: DepartmentType.team, parentId: division.id },
  });

  // ── 사용자(역할별) ──
  const hr = await prisma.user.create({
    data: {
      email: 'hr@energyx.co.kr',
      name: '한인사',
      passwordHash,
      role: Role.hr_admin,
      position: Position.chief,
      departmentId: group.id,
    },
  });

  const divisionHead = await prisma.user.create({
    data: {
      email: 'division@energyx.co.kr',
      name: '본부장',
      passwordHash,
      role: Role.division_head,
      position: Position.division_head,
      jobLevel: JobLevel.division_head,
      departmentId: division.id,
    },
  });

  const teamLead = await prisma.user.create({
    data: {
      email: 'lead@energyx.co.kr',
      name: '팀장',
      passwordHash,
      role: Role.team_lead,
      position: Position.team_lead,
      jobLevel: JobLevel.team_lead,
      departmentId: team.id,
      managerId: divisionHead.id,
    },
  });

  const senior = await prisma.user.create({
    data: {
      email: 'senior@energyx.co.kr',
      name: '김선임',
      passwordHash,
      role: Role.employee,
      position: Position.senior,
      jobLevel: JobLevel.senior_plus,
      departmentId: team.id,
      managerId: teamLead.id,
    },
  });

  const pro = await prisma.user.create({
    data: {
      email: 'pro@energyx.co.kr',
      name: '이프로',
      passwordHash,
      role: Role.employee,
      position: Position.pro,
      jobLevel: JobLevel.senior_minus,
      departmentId: team.id,
      managerId: teamLead.id,
    },
  });

  // ── RuleSet + active Cycle (1:1) ──
  const ruleSet = await prisma.ruleSet.create({
    data: {
      gradeScale: RULE_SET_2026.gradeScale,
      gradingScales: RULE_SET_2026.gradingScales,
      poolRatios: RULE_SET_2026.poolRatios,
      raiseRates: RULE_SET_2026.raiseRates,
      weightPolicy: RULE_SET_2026.weightPolicy,
    },
  });

  const cycle = await prisma.evaluationCycle.create({
    data: {
      name: '2026년 정기 성과평가',
      year: 2026,
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
      status: CycleStatus.active,
      ruleSetId: ruleSet.id,
    },
  });

  // ── 직급별 KPI 양식 (jobLevel별 category/group 샘플) ──
  // 선임 이상(senior_plus): 성과중심 80% + 협업·성장 20%
  await prisma.kpiTemplate.create({
    data: {
      cycleId: cycle.id,
      jobLevel: JobLevel.senior_plus,
      items: {
        create: [
          {
            category: KpiCategory.revenue,
            group: KpiGroup.performance_core,
            sampleStrategy: '그룹 매출 달성 기여',
            defaultMeasureType: MeasureType.amount,
            defaultWeight: 40,
            isQualitative: false,
          },
          {
            category: KpiCategory.orders,
            group: KpiGroup.performance_core,
            sampleStrategy: '수주 및 업무수행 성과',
            defaultMeasureType: MeasureType.amount,
            defaultWeight: 40,
            isQualitative: false,
          },
          {
            category: KpiCategory.collaboration,
            group: KpiGroup.collaboration_growth,
            sampleStrategy: '타본부 협업 지원',
            defaultMeasureType: MeasureType.count,
            defaultWeight: 10,
            isQualitative: false,
          },
          {
            category: KpiCategory.development,
            group: KpiGroup.collaboration_growth,
            sampleStrategy: 'AI 활용 자기개발',
            defaultMeasureType: MeasureType.qualitative,
            defaultWeight: 10,
            isQualitative: true,
          },
        ],
      },
    },
  });

  // 본부장 양식: 공정액·수주 성과중심 70% + 협업·성장 30%
  await prisma.kpiTemplate.create({
    data: {
      cycleId: cycle.id,
      jobLevel: JobLevel.division_head,
      items: {
        create: [
          {
            category: KpiCategory.construction,
            group: KpiGroup.performance_core,
            sampleStrategy: '본부 공정액 달성(140억)',
            defaultMeasureType: MeasureType.amount,
            defaultWeight: 40,
            isQualitative: false,
          },
          {
            category: KpiCategory.orders,
            group: KpiGroup.performance_core,
            sampleStrategy: '본부 수주액 달성(28억)',
            defaultMeasureType: MeasureType.amount,
            defaultWeight: 30,
            isQualitative: false,
          },
          {
            category: KpiCategory.collaboration,
            group: KpiGroup.collaboration_growth,
            sampleStrategy: '협업성과(20건)',
            defaultMeasureType: MeasureType.count,
            defaultWeight: 20,
            isQualitative: false,
          },
          {
            category: KpiCategory.development,
            group: KpiGroup.collaboration_growth,
            sampleStrategy: '조직 역량 강화',
            defaultMeasureType: MeasureType.qualitative,
            defaultWeight: 10,
            isQualitative: true,
          },
        ],
      },
    },
  });

  // ── 그룹 실적 + 등급 풀 (excellent tier 예시) ──
  await prisma.groupPerformance.create({
    data: {
      groupId: group.id,
      cycleId: cycle.id,
      revenue: 12000,
      orders: 340,
      profit: 1800,
      achievementRate: 115,
      tier: 'excellent',
    },
  });

  const pool = RULE_SET_2026.poolRatios.excellent;
  await prisma.gradePool.create({
    data: {
      cycleId: cycle.id,
      groupId: group.id,
      tier: 'excellent',
      sRatio: pool.S,
      aRatio: pool.A,
      bRatio: pool.B,
      cRatio: pool.C,
      dRatio: pool.D,
    },
  });

  // ── 데모 KPI (선임, category/group/measureType) ──
  await prisma.kpi.create({
    data: {
      userId: senior.id,
      cycleId: cycle.id,
      category: KpiCategory.orders,
      group: KpiGroup.performance_core,
      coreStrategy: '플랫폼 매출 성장',
      csf: '신규 고객 확보',
      title: '신규 계약 수주 달성',
      measureMethod: '수주액(백만원)',
      measureType: MeasureType.amount,
      targetValue: 1000,
      weight: 80,
      isQualitative: false,
      status: 'draft',
    },
  });

  await prisma.kpi.create({
    data: {
      userId: senior.id,
      cycleId: cycle.id,
      category: KpiCategory.collaboration,
      group: KpiGroup.collaboration_growth,
      coreStrategy: '협업 강화',
      csf: '타본부 지원',
      title: '설계/견적/영업 지원',
      measureMethod: '지원 건수',
      measureType: MeasureType.count,
      targetValue: 20,
      weight: 20,
      isQualitative: false,
      grading: COUNT_GRADING_COLLAB,
      status: 'draft',
    },
  });

  console.log('✅ Seed 완료');
  console.log(`  - 조직(그룹→본부→팀): ${group.name} > ${division.name} > ${team.name}`);
  console.log(`  - 사용자 5명 (hr/division/lead/senior/pro) 비밀번호: Passw0rd!`);
  console.log(`  - Cycle: ${cycle.name} (${cycle.status})`);
  console.log(`  - RuleSet: 2026 기본값 (gradingScales 측정방식별 포함)`);
  console.log({ hrId: hr.id, proId: pro.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
