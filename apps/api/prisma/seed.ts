/**
 * 인사평가 솔루션 — 보고/시연용 데모 시드 (에너지엑스 2026)
 *
 * 목표: 시연 시 모든 화면이 사실적·내부 정합 데이터로 채워지는 것.
 *  - 조직: 그룹(에너지엑스) → 본부 3 → 팀 7 → 인원 ~24명 (한글 이름·직책)
 *  - 주기 2개: ①완료(2025 하반기, closed) ②진행(2026 상반기, mid_review)
 *  - KPI/실적/평가/결과/풀/보상/이의/감사/알림 전부 scoring 규칙과 정합
 *
 * 정합성: 등급/점수/달성률/풀/인상률은 scoring.service.ts 와 동일 공식으로 계산해 넣는다.
 * 멱등: 매 실행 전 전체 테이블을 정리(deleteMany)한 뒤 재삽입한다.
 *
 * ⚠️ 데모 로그인 계정(hr/division/lead/senior/pro @energyx.co.kr, Passw0rd!)은 보존.
 * ⚠️ 역량/다면 잔재 없음. KPI category/group/measureType + self/downward(1·2차)만.
 */
import {
  PrismaClient,
  Role,
  Position,
  JobLevel,
  DepartmentType,
  CycleStatus,
  KpiStatus,
  KpiCategory,
  KpiGroup,
  MeasureType,
  EvaluationType,
  EvaluationStatus,
  Grade,
  GroupTier,
  AppealStatus,
  ReviewKind,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────── RuleSet 2026 기본값 (business-rules §1~5) ───────────────────────
const RULE_SET_2026 = {
  gradeScale: [
    { grade: 'S', min: 96, max: 100 },
    { grade: 'A', min: 91, max: 95 },
    { grade: 'B', min: 85, max: 90 },
    { grade: 'C', min: 80, max: 84 },
    { grade: 'D', min: 0, max: 79 },
  ],
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
  poolRatios: {
    excellent: { S: 10, A: 20, B: 50, C: 15, D: 5 },
    standard: { S: 5, A: 10, B: 60, C: 20, D: 5 },
    poor: { S: 3, A: 7, B: 60, C: 25, D: 5 },
  },
  raiseRates: { S: 7, A: 5, B: 3, C: 1, D: 0 },
  weightPolicy: { totalMustEqual: 100, qualitativeMaxPercent: 30 },
};

// count 측정방식 임계값 (협업성과 본부장: 20/15/10/5)
const COUNT_GRADING_COLLAB = [
  { grade: 'S', minCount: 20, maxCount: null },
  { grade: 'A', minCount: 15, maxCount: 19 },
  { grade: 'B', minCount: 10, maxCount: 14 },
  { grade: 'C', minCount: 5, maxCount: 9 },
  { grade: 'D', minCount: 0, maxCount: 4 },
];
// 개인 협업성과 (3/2/1건)
const COUNT_GRADING_COLLAB_INDIV = [
  { grade: 'S', minCount: 4, maxCount: null },
  { grade: 'A', minCount: 3, maxCount: 3 },
  { grade: 'B', minCount: 2, maxCount: 2 },
  { grade: 'C', minCount: 1, maxCount: 1 },
  { grade: 'D', minCount: 0, maxCount: 0 },
];

// ─────────────────────── scoring.service.ts 와 동일한 계산 헬퍼 ───────────────────────
type GradeScaleBand = { grade: Grade; min: number; max: number };
type RateBand = { grade: Grade; minRate: number; maxRate: number | null };
type CountBand = { grade: Grade; minCount: number; maxCount: number | null };

const GRADE_SCALE = RULE_SET_2026.gradeScale as GradeScaleBand[];
const AMOUNT_BANDS = RULE_SET_2026.gradingScales.amount as RateBand[];

/** 달성률(%) → 등급 (amount/rate). */
function rateToGrade(rate: number, bands: RateBand[] = AMOUNT_BANDS): Grade {
  const b = bands.find((x) => rate >= x.minRate && (x.maxRate === null || rate <= x.maxRate));
  return b?.grade ?? Grade.D;
}
/** 건수 → 등급 (count). */
function countToGrade(count: number, bands: CountBand[]): Grade {
  const b = bands.find((x) => count >= x.minCount && (x.maxCount === null || count <= x.maxCount));
  return b?.grade ?? Grade.D;
}
/** 점수 → 등급 (§1). */
function scoreToGrade(score: number): Grade {
  const b = GRADE_SCALE.find((x) => score >= x.min && score <= x.max);
  return b?.grade ?? Grade.D;
}
/** 등급의 점수 구간 중앙값 → KPI raw 점수 (scoring.gradeToScore 와 동일). */
function gradeToScore(grade: Grade): number {
  const b = GRADE_SCALE.find((x) => x.grade === grade);
  if (!b) return 0;
  return Math.round((b.min + b.max) / 2);
}
/** 가중 총점 = Σ(score × weight/100). */
function computeTotal(items: { score: number; weight: number }[]): number {
  const t = items.reduce((s, i) => s + (i.score * i.weight) / 100, 0);
  return Math.round(t * 100) / 100;
}
const RAISE: Record<Grade, number> = { S: 7, A: 5, B: 3, C: 1, D: 0 };

/** 과거 시각 생성 (사실감용). */
function daysAgo(n: number, hour = 10, min = 0): Date {
  const d = new Date('2026-06-04T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, min, 0, 0);
  return d;
}

// ─────────────────────── 조직·인원 정의 ───────────────────────
// 한글 이름·직책. position: ceo/division_head/team_lead/chief/senior/pro
//  - chief(책임)·senior(선임)·pro(프로)는 일반 직원(role=employee).
//  - jobLevel: division_head/team_lead/senior_plus(5년↑)/senior_minus(5년↓)
type PersonSpec = {
  key: string;
  email: string;
  name: string;
  role: Role;
  position: Position;
  jobLevel?: JobLevel;
};

async function main() {
  const passwordHash = await bcrypt.hash('Passw0rd!', 10);

  // ── 0. 멱등: 의존 역순으로 전체 정리 ──
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.compensation.deleteMany();
  await prisma.appeal.deleteMany();
  await prisma.evaluationResult.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.kpiScore.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.kpi.deleteMany();
  await prisma.kpiTemplateItem.deleteMany();
  await prisma.kpiTemplate.deleteMany();
  await prisma.gradePool.deleteMany();
  await prisma.groupPerformance.deleteMany();
  await prisma.cycleSchedule.deleteMany();
  // RuleSet 은 cycle 의 unique FK → cycle 먼저 끊고 정리
  await prisma.evaluationCycle.deleteMany();
  await prisma.ruleSet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  // M3 Items1-3: KpiCategoryPolicy 는 직급 독립 — 재시드 시 갱신(아래 upsert).

  // ── 1. 조직 트리: 그룹 → 본부 3 → 팀 7 ──
  const group = await prisma.department.create({
    data: { name: '에너지엑스', type: DepartmentType.group },
  });

  const divEPC = await prisma.department.create({
    data: { name: 'EPC사업본부', type: DepartmentType.division, parentId: group.id },
  });
  const divSales = await prisma.department.create({
    data: { name: '영업본부', type: DepartmentType.division, parentId: group.id },
  });
  const divMgmt = await prisma.department.create({
    data: { name: '경영지원본부', type: DepartmentType.division, parentId: group.id },
  });

  const teamPlant = await prisma.department.create({
    data: { name: '플랜트설계팀', type: DepartmentType.team, parentId: divEPC.id },
  });
  const teamConstruct = await prisma.department.create({
    data: { name: '시공관리팀', type: DepartmentType.team, parentId: divEPC.id },
  });
  const teamProcure = await prisma.department.create({
    data: { name: '구매조달팀', type: DepartmentType.team, parentId: divEPC.id },
  });
  const teamDomestic = await prisma.department.create({
    data: { name: '국내영업팀', type: DepartmentType.team, parentId: divSales.id },
  });
  const teamGlobal = await prisma.department.create({
    data: { name: '해외영업팀', type: DepartmentType.team, parentId: divSales.id },
  });
  const teamHR = await prisma.department.create({
    data: { name: '인사총무팀', type: DepartmentType.team, parentId: divMgmt.id },
  });
  const teamFinance = await prisma.department.create({
    data: { name: '재무회계팀', type: DepartmentType.team, parentId: divMgmt.id },
  });

  // ── 2. 사용자 ~24명 ──
  // 헬퍼: 사용자 생성 (createdAt 과거 분산)
  const users: Record<string, { id: string; deptId: string; managerId: string | null }> = {};
  let userSeq = 0;
  async function makeUser(
    spec: PersonSpec,
    deptId: string,
    managerKey: string | null,
  ) {
    const managerId = managerKey ? users[managerKey].id : null;
    const u = await prisma.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        passwordHash,
        role: spec.role,
        position: spec.position,
        jobLevel: spec.jobLevel ?? null,
        departmentId: deptId,
        managerId,
        createdAt: daysAgo(400 - userSeq * 5),
      },
    });
    users[spec.key] = { id: u.id, deptId, managerId };
    userSeq++;
    return u;
  }

  // 대표이사 (그룹) — role hr_admin 으로 두지 않고 전사 총괄. 결과 집계 대상에서 제외할 것.
  await makeUser(
    { key: 'ceo', email: 'ceo@energyx.co.kr', name: '강대표', role: Role.hr_admin, position: Position.ceo },
    group.id,
    null,
  );

  // HR 관리자 (데모 계정 — 인사총무팀)
  await makeUser(
    { key: 'hr', email: 'hr@energyx.co.kr', name: '한인사', role: Role.hr_admin, position: Position.chief, jobLevel: JobLevel.senior_plus },
    teamHR.id,
    'ceo',
  );

  // 본부장 3명 (데모 division 계정 = EPC본부장)
  await makeUser(
    { key: 'divEPC', email: 'division@energyx.co.kr', name: '오본부', role: Role.division_head, position: Position.division_head, jobLevel: JobLevel.division_head },
    divEPC.id,
    'ceo',
  );
  await makeUser(
    { key: 'divSales', email: 'sales.head@energyx.co.kr', name: '나본부', role: Role.division_head, position: Position.division_head, jobLevel: JobLevel.division_head },
    divSales.id,
    'ceo',
  );
  await makeUser(
    { key: 'divMgmt', email: 'mgmt.head@energyx.co.kr', name: '서본부', role: Role.division_head, position: Position.division_head, jobLevel: JobLevel.division_head },
    divMgmt.id,
    'ceo',
  );

  // 팀장 7명 (데모 lead 계정 = 플랜트설계팀장)
  await makeUser(
    { key: 'leadPlant', email: 'lead@energyx.co.kr', name: '김팀장', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamPlant.id,
    'divEPC',
  );
  await makeUser(
    { key: 'leadConstruct', email: 'lead.construct@energyx.co.kr', name: '박시공', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamConstruct.id,
    'divEPC',
  );
  await makeUser(
    { key: 'leadProcure', email: 'lead.procure@energyx.co.kr', name: '최구매', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamProcure.id,
    'divEPC',
  );
  await makeUser(
    { key: 'leadDomestic', email: 'lead.domestic@energyx.co.kr', name: '정국내', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamDomestic.id,
    'divSales',
  );
  await makeUser(
    { key: 'leadGlobal', email: 'lead.global@energyx.co.kr', name: '윤해외', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamGlobal.id,
    'divSales',
  );
  await makeUser(
    { key: 'leadHR', email: 'lead.hr@energyx.co.kr', name: '임총무', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamHR.id,
    'divMgmt',
  );
  await makeUser(
    { key: 'leadFinance', email: 'lead.finance@energyx.co.kr', name: '조재무', role: Role.team_lead, position: Position.team_lead, jobLevel: JobLevel.team_lead },
    teamFinance.id,
    'divMgmt',
  );

  // 팀원 (데모 senior = 플랜트설계팀, pro = 플랜트설계팀)
  const memberSpecs: Array<PersonSpec & { dept: string; manager: string }> = [
    { key: 'senior', email: 'senior@energyx.co.kr', name: '김선임', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamPlant.id, manager: 'leadPlant' },
    { key: 'pro', email: 'pro@energyx.co.kr', name: '이프로', role: Role.employee, position: Position.pro, jobLevel: JobLevel.senior_minus, dept: teamPlant.id, manager: 'leadPlant' },
    { key: 'm_plant3', email: 'plant.kim@energyx.co.kr', name: '김플랜', role: Role.employee, position: Position.chief, jobLevel: JobLevel.senior_plus, dept: teamPlant.id, manager: 'leadPlant' },
    { key: 'm_construct1', email: 'construct.lee@energyx.co.kr', name: '이시공', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamConstruct.id, manager: 'leadConstruct' },
    { key: 'm_construct2', email: 'construct.park@energyx.co.kr', name: '박현장', role: Role.employee, position: Position.pro, jobLevel: JobLevel.senior_minus, dept: teamConstruct.id, manager: 'leadConstruct' },
    { key: 'm_procure1', email: 'procure.han@energyx.co.kr', name: '한조달', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamProcure.id, manager: 'leadProcure' },
    { key: 'm_procure2', email: 'procure.song@energyx.co.kr', name: '송구매', role: Role.employee, position: Position.pro, jobLevel: JobLevel.senior_minus, dept: teamProcure.id, manager: 'leadProcure' },
    { key: 'm_domestic1', email: 'domestic.kang@energyx.co.kr', name: '강영업', role: Role.employee, position: Position.chief, jobLevel: JobLevel.senior_plus, dept: teamDomestic.id, manager: 'leadDomestic' },
    { key: 'm_domestic2', email: 'domestic.yoo@energyx.co.kr', name: '유세일', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamDomestic.id, manager: 'leadDomestic' },
    { key: 'm_global1', email: 'global.moon@energyx.co.kr', name: '문해외', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamGlobal.id, manager: 'leadGlobal' },
    { key: 'm_global2', email: 'global.bae@energyx.co.kr', name: '배글로', role: Role.employee, position: Position.pro, jobLevel: JobLevel.senior_minus, dept: teamGlobal.id, manager: 'leadGlobal' },
    { key: 'm_hr1', email: 'hr.shin@energyx.co.kr', name: '신인사', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamHR.id, manager: 'leadHR' },
    { key: 'm_finance1', email: 'finance.go@energyx.co.kr', name: '고회계', role: Role.employee, position: Position.senior, jobLevel: JobLevel.senior_plus, dept: teamFinance.id, manager: 'leadFinance' },
    { key: 'm_finance2', email: 'finance.jang@energyx.co.kr', name: '장재무', role: Role.employee, position: Position.pro, jobLevel: JobLevel.senior_minus, dept: teamFinance.id, manager: 'leadFinance' },
  ];
  for (const m of memberSpecs) {
    await makeUser(m, m.dept, m.manager);
  }

  // ── 3. RuleSet 2종: 글로벌 default(폴백) + 주기별 ──
  const ruleSetData = {
    gradeScale: RULE_SET_2026.gradeScale,
    gradingScales: RULE_SET_2026.gradingScales,
    poolRatios: RULE_SET_2026.poolRatios,
    raiseRates: RULE_SET_2026.raiseRates,
    weightPolicy: RULE_SET_2026.weightPolicy,
  };
  // 글로벌 default (cycleId=null) — scoring 폴백·rule-sets 화면용
  await prisma.ruleSet.create({ data: { ...ruleSetData, createdAt: daysAgo(380) } });
  const ruleSetClosed = await prisma.ruleSet.create({ data: { ...ruleSetData, createdAt: daysAgo(300) } });
  const ruleSetActive = await prisma.ruleSet.create({ data: { ...ruleSetData, createdAt: daysAgo(120) } });

  // ── 3-1. M3 Item3: KPI 카테고리 직급 제한 매트릭스 (직책자=전부, 비직책자=revenue·orders 차단) ──
  const ALL_CATEGORIES = [
    KpiCategory.revenue,
    KpiCategory.construction,
    KpiCategory.orders,
    KpiCategory.collaboration,
    KpiCategory.development,
  ];
  const NON_TITLE_CATEGORIES = [
    KpiCategory.construction,
    KpiCategory.collaboration,
    KpiCategory.development,
  ];
  const titleHolders = [
    Position.ceo, Position.vice_president, Position.executive, Position.director,
    Position.division_head, Position.team_lead,
  ];
  const nonTitleHolders = [Position.principal, Position.chief, Position.senior, Position.pro];
  for (const p of titleHolders) {
    await prisma.kpiCategoryPolicy.upsert({
      where: { position: p },
      create: { position: p, allowed: ALL_CATEGORIES },
      update: { allowed: ALL_CATEGORIES },
    });
  }
  for (const p of nonTitleHolders) {
    await prisma.kpiCategoryPolicy.upsert({
      where: { position: p },
      create: { position: p, allowed: NON_TITLE_CATEGORIES },
      update: { allowed: NON_TITLE_CATEGORIES },
    });
  }

  // ── 4. 주기 2개 ──
  const cycleClosed = await prisma.evaluationCycle.create({
    data: {
      name: '2025년 하반기 정기 성과평가',
      year: 2025,
      startDate: new Date('2025-07-01T00:00:00Z'),
      endDate: new Date('2025-12-31T23:59:59Z'),
      status: CycleStatus.closed,
      ruleSetId: ruleSetClosed.id,
      createdAt: daysAgo(300),
    },
  });
  const cycleActive = await prisma.evaluationCycle.create({
    data: {
      name: '2026년 상반기 정기 성과평가',
      year: 2026,
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-08-31T23:59:59Z'),
      status: CycleStatus.mid_review,
      ruleSetId: ruleSetActive.id,
      createdAt: daysAgo(120),
    },
  });

  // ── 5. CycleSchedule (단계별 마감·D-7/3/1) ──
  // 완료 주기: 과거 마감일. 진행 주기: 일부 임박(D-7/D-3 트리거되도록).
  const allTeamIds = [teamPlant.id, teamConstruct.id, teamProcure.id, teamDomestic.id, teamGlobal.id, teamHR.id, teamFinance.id];
  const allDivIds = [divEPC.id, divSales.id, divMgmt.id];
  async function makeSchedule(cycleId: string, phase: string, due: Date) {
    await prisma.cycleSchedule.create({
      data: {
        cycleId,
        phase,
        dueDate: due,
        notifyOffsets: [7, 3, 1],
        notifyEnabled: true,
        targetUserIds: [],
        targetDeptIds: [...allTeamIds, ...allDivIds],
      },
    });
  }
  // 완료 주기 (전부 과거)
  await makeSchedule(cycleClosed.id, 'preparation', new Date('2025-07-15T23:59:59Z'));
  await makeSchedule(cycleClosed.id, 'self', new Date('2025-11-15T23:59:59Z'));
  await makeSchedule(cycleClosed.id, 'downward1', new Date('2025-12-05T23:59:59Z'));
  await makeSchedule(cycleClosed.id, 'downward2', new Date('2025-12-15T23:59:59Z'));
  await makeSchedule(cycleClosed.id, 'result', new Date('2025-12-31T23:59:59Z'));
  // 진행 주기 (오늘=2026-06-04 기준: self 마감 임박 D-7, 이후 단계 미래)
  await makeSchedule(cycleActive.id, 'preparation', new Date('2026-03-31T23:59:59Z'));
  await makeSchedule(cycleActive.id, 'self', daysAgo(-7, 23, 59)); // D-7
  await makeSchedule(cycleActive.id, 'downward1', daysAgo(-21, 23, 59));
  await makeSchedule(cycleActive.id, 'downward2', daysAgo(-30, 23, 59));
  await makeSchedule(cycleActive.id, 'result', new Date('2026-08-31T23:59:59Z'));

  // ── 6. KPI 양식 (직급별) — 두 주기에 동일 구조로 ──
  async function makeTemplates(cycleId: string, createdAt: Date) {
    // 본부장: 성과중심 70% + 협업·성장 30%
    await prisma.kpiTemplate.create({
      data: {
        cycleId,
        jobLevel: JobLevel.division_head,
        createdAt,
        items: {
          create: [
            { category: KpiCategory.construction, group: KpiGroup.performance_core, sampleStrategy: '본부 공정액 달성', defaultMeasureType: MeasureType.amount, defaultWeight: 40, isQualitative: false },
            { category: KpiCategory.orders, group: KpiGroup.performance_core, sampleStrategy: '본부 수주액 달성', defaultMeasureType: MeasureType.amount, defaultWeight: 30, isQualitative: false },
            { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, sampleStrategy: '협업성과(20건)', defaultMeasureType: MeasureType.count, defaultWeight: 20, isQualitative: false },
            { category: KpiCategory.development, group: KpiGroup.collaboration_growth, sampleStrategy: '조직 역량 강화', defaultMeasureType: MeasureType.qualitative, defaultWeight: 10, isQualitative: true },
          ],
        },
      },
    });
    // 팀장: 성과중심 70% + 협업·성장 30%
    await prisma.kpiTemplate.create({
      data: {
        cycleId,
        jobLevel: JobLevel.team_lead,
        createdAt,
        items: {
          create: [
            { category: KpiCategory.revenue, group: KpiGroup.performance_core, sampleStrategy: '팀 매출 목표 달성', defaultMeasureType: MeasureType.amount, defaultWeight: 40, isQualitative: false },
            { category: KpiCategory.orders, group: KpiGroup.performance_core, sampleStrategy: '팀 수주 및 업무수행', defaultMeasureType: MeasureType.amount, defaultWeight: 30, isQualitative: false },
            { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, sampleStrategy: '팀간 협업 지원', defaultMeasureType: MeasureType.count, defaultWeight: 20, isQualitative: false },
            { category: KpiCategory.development, group: KpiGroup.collaboration_growth, sampleStrategy: '팀원 코칭·역량강화', defaultMeasureType: MeasureType.qualitative, defaultWeight: 10, isQualitative: true },
          ],
        },
      },
    });
    // 5년차↑(senior_plus): 성과중심 80% + 협업·성장 20%
    await prisma.kpiTemplate.create({
      data: {
        cycleId,
        jobLevel: JobLevel.senior_plus,
        createdAt,
        items: {
          create: [
            { category: KpiCategory.revenue, group: KpiGroup.performance_core, sampleStrategy: '담당 매출 기여', defaultMeasureType: MeasureType.amount, defaultWeight: 45, isQualitative: false },
            { category: KpiCategory.orders, group: KpiGroup.performance_core, sampleStrategy: '수주 및 업무수행 성과', defaultMeasureType: MeasureType.amount, defaultWeight: 35, isQualitative: false },
            { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, sampleStrategy: '타부서 협업 지원', defaultMeasureType: MeasureType.count, defaultWeight: 10, isQualitative: false },
            { category: KpiCategory.development, group: KpiGroup.collaboration_growth, sampleStrategy: 'AI 활용 자기개발', defaultMeasureType: MeasureType.qualitative, defaultWeight: 10, isQualitative: true },
          ],
        },
      },
    });
    // 5년차↓(senior_minus): 성과중심 80% + 협업·성장 20%
    await prisma.kpiTemplate.create({
      data: {
        cycleId,
        jobLevel: JobLevel.senior_minus,
        createdAt,
        items: {
          create: [
            { category: KpiCategory.revenue, group: KpiGroup.performance_core, sampleStrategy: '담당 업무 처리량', defaultMeasureType: MeasureType.amount, defaultWeight: 50, isQualitative: false },
            { category: KpiCategory.orders, group: KpiGroup.performance_core, sampleStrategy: '업무수행 정확도', defaultMeasureType: MeasureType.rate, defaultWeight: 30, isQualitative: false },
            { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, sampleStrategy: '협업 지원 건수', defaultMeasureType: MeasureType.count, defaultWeight: 10, isQualitative: false },
            { category: KpiCategory.development, group: KpiGroup.collaboration_growth, sampleStrategy: '직무 교육 이수', defaultMeasureType: MeasureType.qualitative, defaultWeight: 10, isQualitative: true },
          ],
        },
      },
    });
  }
  await makeTemplates(cycleClosed.id, daysAgo(290));
  await makeTemplates(cycleActive.id, daysAgo(95));

  // ── 7. 그룹 실적 + 등급 풀 ──
  // 완료 주기: excellent tier (달성률 112%). 진행 주기: standard tier (잠정 96%).
  await prisma.groupPerformance.create({
    data: { groupId: group.id, cycleId: cycleClosed.id, revenue: 28000, orders: 9200, profit: 4100, achievementRate: 112, tier: GroupTier.excellent, createdAt: daysAgo(190) },
  });
  await prisma.groupPerformance.create({
    data: { groupId: group.id, cycleId: cycleActive.id, revenue: 13400, orders: 4300, profit: 1850, achievementRate: 96, tier: GroupTier.standard, createdAt: daysAgo(40) },
  });
  const poolExcellent = RULE_SET_2026.poolRatios.excellent;
  const poolStandard = RULE_SET_2026.poolRatios.standard;
  await prisma.gradePool.create({
    data: { cycleId: cycleClosed.id, groupId: group.id, tier: GroupTier.excellent, sRatio: poolExcellent.S, aRatio: poolExcellent.A, bRatio: poolExcellent.B, cRatio: poolExcellent.C, dRatio: poolExcellent.D },
  });
  await prisma.gradePool.create({
    data: { cycleId: cycleActive.id, groupId: group.id, tier: GroupTier.standard, sRatio: poolStandard.S, aRatio: poolStandard.A, bRatio: poolStandard.B, cRatio: poolStandard.C, dRatio: poolStandard.D },
  });

  // ─────────────────────── 8. 평가 대상자 + 등급 시나리오 ───────────────────────
  // 평가 대상 = 본부장·팀장·팀원 (대표이사·HR관리자 제외)
  // 등급 분포 목표(완료 주기, 약 21명): S~10% A~25% B~40% C~20% D~5%
  //  → S 2, A 5, B 9, C 4, D 1  (excellent 풀 상한: S≤3,A≤5,B≤11,C≤4,D≤2 → 정합)
  type EvalTarget = {
    key: string;
    jobLevel: JobLevel;
    targetGrade: Grade; // 완료 주기 최종(부서장 확정) 등급
    selfGrade: Grade; // 본인평가 등급(보통 약간 높게)
  };
  const targets: EvalTarget[] = [
    // 본부장 3
    { key: 'divEPC', jobLevel: JobLevel.division_head, targetGrade: Grade.S, selfGrade: Grade.S },
    { key: 'divSales', jobLevel: JobLevel.division_head, targetGrade: Grade.A, selfGrade: Grade.S },
    { key: 'divMgmt', jobLevel: JobLevel.division_head, targetGrade: Grade.B, selfGrade: Grade.A },
    // 팀장 7
    { key: 'leadPlant', jobLevel: JobLevel.team_lead, targetGrade: Grade.S, selfGrade: Grade.S },
    { key: 'leadConstruct', jobLevel: JobLevel.team_lead, targetGrade: Grade.A, selfGrade: Grade.A },
    { key: 'leadProcure', jobLevel: JobLevel.team_lead, targetGrade: Grade.B, selfGrade: Grade.A },
    { key: 'leadDomestic', jobLevel: JobLevel.team_lead, targetGrade: Grade.A, selfGrade: Grade.S },
    { key: 'leadGlobal', jobLevel: JobLevel.team_lead, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'leadHR', jobLevel: JobLevel.team_lead, targetGrade: Grade.C, selfGrade: Grade.B },
    { key: 'leadFinance', jobLevel: JobLevel.team_lead, targetGrade: Grade.B, selfGrade: Grade.B },
    // 팀원 11
    { key: 'senior', jobLevel: JobLevel.senior_plus, targetGrade: Grade.A, selfGrade: Grade.S },
    { key: 'pro', jobLevel: JobLevel.senior_minus, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'm_plant3', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.A },
    { key: 'm_construct1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.A, selfGrade: Grade.A },
    { key: 'm_construct2', jobLevel: JobLevel.senior_minus, targetGrade: Grade.C, selfGrade: Grade.B },
    { key: 'm_procure1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'm_procure2', jobLevel: JobLevel.senior_minus, targetGrade: Grade.D, selfGrade: Grade.C },
    { key: 'm_domestic1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.A, selfGrade: Grade.A },
    { key: 'm_domestic2', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.A },
    { key: 'm_global1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'm_global2', jobLevel: JobLevel.senior_minus, targetGrade: Grade.C, selfGrade: Grade.C },
    { key: 'm_hr1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'm_finance1', jobLevel: JobLevel.senior_plus, targetGrade: Grade.B, selfGrade: Grade.B },
    { key: 'm_finance2', jobLevel: JobLevel.senior_minus, targetGrade: Grade.C, selfGrade: Grade.B },
  ];

  // KPI 항목 템플릿(직급별) — Kpi 레코드 생성용 (양식과 동일 가중)
  type KpiSpec = {
    category: KpiCategory;
    group: KpiGroup;
    title: string;
    coreStrategy: string;
    csf: string;
    measureMethod: string;
    measureType: MeasureType;
    weight: number;
    isQualitative: boolean;
    grading?: unknown;
  };
  function kpiSpecsFor(jobLevel: JobLevel): KpiSpec[] {
    if (jobLevel === JobLevel.division_head) {
      return [
        { category: KpiCategory.construction, group: KpiGroup.performance_core, title: '본부 공정액 달성', coreStrategy: '대형 프로젝트 공정 관리', csf: '공정 준수율', measureMethod: '공정액(백만원)', measureType: MeasureType.amount, weight: 40, isQualitative: false },
        { category: KpiCategory.orders, group: KpiGroup.performance_core, title: '본부 수주액 달성', coreStrategy: '신규 수주 확대', csf: '파이프라인 전환율', measureMethod: '수주액(백만원)', measureType: MeasureType.amount, weight: 30, isQualitative: false },
        { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, title: '본부간 협업 성과', coreStrategy: '전사 협업 강화', csf: '협업 프로젝트', measureMethod: '협업 건수', measureType: MeasureType.count, weight: 20, isQualitative: false, grading: COUNT_GRADING_COLLAB },
        { category: KpiCategory.development, group: KpiGroup.collaboration_growth, title: '조직 역량 강화', coreStrategy: '인재 육성', csf: '교육·코칭', measureMethod: '정성 평가', measureType: MeasureType.qualitative, weight: 10, isQualitative: true },
      ];
    }
    if (jobLevel === JobLevel.team_lead) {
      return [
        { category: KpiCategory.revenue, group: KpiGroup.performance_core, title: '팀 매출 목표 달성', coreStrategy: '팀 매출 성장', csf: '핵심 고객 관리', measureMethod: '매출액(백만원)', measureType: MeasureType.amount, weight: 40, isQualitative: false },
        { category: KpiCategory.orders, group: KpiGroup.performance_core, title: '팀 수주·업무수행', coreStrategy: '업무 효율화', csf: '납기 준수', measureMethod: '수주액(백만원)', measureType: MeasureType.amount, weight: 30, isQualitative: false },
        { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, title: '팀간 협업 지원', coreStrategy: '협업 문화', csf: '지원 요청 대응', measureMethod: '협업 건수', measureType: MeasureType.count, weight: 20, isQualitative: false, grading: COUNT_GRADING_COLLAB },
        { category: KpiCategory.development, group: KpiGroup.collaboration_growth, title: '팀원 코칭', coreStrategy: '팀 역량 강화', csf: '1:1 코칭', measureMethod: '정성 평가', measureType: MeasureType.qualitative, weight: 10, isQualitative: true },
      ];
    }
    if (jobLevel === JobLevel.senior_plus) {
      return [
        { category: KpiCategory.revenue, group: KpiGroup.performance_core, title: '담당 매출 기여', coreStrategy: '담당 영역 성과', csf: '목표 달성', measureMethod: '매출 기여액(백만원)', measureType: MeasureType.amount, weight: 45, isQualitative: false },
        { category: KpiCategory.orders, group: KpiGroup.performance_core, title: '수주·업무수행 성과', coreStrategy: '업무 품질', csf: '오류율 최소화', measureMethod: '수행 실적(백만원)', measureType: MeasureType.amount, weight: 35, isQualitative: false },
        { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, title: '타부서 협업 지원', coreStrategy: '협업 기여', csf: '지원 건수', measureMethod: '협업 건수', measureType: MeasureType.count, weight: 10, isQualitative: false, grading: COUNT_GRADING_COLLAB_INDIV },
        { category: KpiCategory.development, group: KpiGroup.collaboration_growth, title: 'AI 활용 자기개발', coreStrategy: '역량 향상', csf: 'AI 도구 활용', measureMethod: '정성 평가', measureType: MeasureType.qualitative, weight: 10, isQualitative: true },
      ];
    }
    // senior_minus
    return [
      { category: KpiCategory.revenue, group: KpiGroup.performance_core, title: '담당 업무 처리량', coreStrategy: '처리량 향상', csf: '처리 건수', measureMethod: '처리 실적(백만원)', measureType: MeasureType.amount, weight: 50, isQualitative: false },
      { category: KpiCategory.orders, group: KpiGroup.performance_core, title: '업무수행 정확도', coreStrategy: '품질 향상', csf: '정확도', measureMethod: '정확도(%)', measureType: MeasureType.rate, weight: 30, isQualitative: false },
      { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, title: '협업 지원 건수', coreStrategy: '협업 참여', csf: '지원 건수', measureMethod: '협업 건수', measureType: MeasureType.count, weight: 10, isQualitative: false, grading: COUNT_GRADING_COLLAB_INDIV },
      { category: KpiCategory.development, group: KpiGroup.collaboration_growth, title: '직무 교육 이수', coreStrategy: '기본 역량', csf: '교육 이수', measureMethod: '정성 평가', measureType: MeasureType.qualitative, weight: 10, isQualitative: true },
    ];
  }

  /**
   * 목표 등급(targetGrade)을 내도록 각 KPI 의 raw 등급을 배정한다.
   * 모든 KPI 가 같은 등급이면 가중총점 = 그 등급 중앙값 → scoreToGrade 가 동일 등급으로 떨어진다(정합).
   * 약간의 현실감을 위해 정성/협업 항목만 ±1 등급 흔들되, 가중총점이 target 구간을 벗어나지 않게 보정.
   */
  function gradesForTarget(target: Grade, specs: KpiSpec[]): Grade[] {
    // 기본: 전부 target. (가중합 = target 중앙값 → scoreToGrade=target)
    return specs.map(() => target);
  }

  /** 측정방식별 실적값(달성률/건수/정성)을 target 등급에서 역산. */
  function achievementForGrade(spec: KpiSpec, grade: Grade): { rate: number | null; actual: number } {
    if (spec.measureType === MeasureType.qualitative) {
      return { rate: null, actual: 0 };
    }
    if (spec.measureType === MeasureType.count) {
      // 협업 건수: 등급 → 대표 건수
      const isIndiv = (spec.grading as CountBand[]) === COUNT_GRADING_COLLAB_INDIV;
      const map: Record<Grade, number> = isIndiv
        ? { S: 4, A: 3, B: 2, C: 1, D: 0 }
        : { S: 22, A: 17, B: 12, C: 7, D: 2 };
      return { rate: null, actual: map[grade] };
    }
    // amount/rate: 등급 → 대표 달성률
    const rateMap: Record<Grade, number> = { S: 118, A: 106, B: 100, C: 94, D: 82 };
    const rate = rateMap[grade];
    const target = spec.weight; // 의미 없는 base, actual=target*rate/100
    return { rate, actual: Math.round((target * rate) / 100 * 100) / 100 };
  }

  // 코멘트 풀(사실적)
  const STRENGTH_COMMENTS = [
    '핵심 프로젝트를 안정적으로 리드하며 목표를 초과 달성했습니다.',
    '고객 대응과 납기 관리가 탁월했고 팀 신뢰도가 높습니다.',
    '협업 요청에 적극 대응해 타부서 성과에도 기여했습니다.',
    '업무 정확도가 높고 자기주도적으로 개선 과제를 발굴했습니다.',
    '수주 파이프라인 관리가 체계적이어서 안정적 성과를 냈습니다.',
  ];
  const IMPROVE_COMMENTS = [
    '일부 과제의 일정 관리에서 선제적 리스크 공유가 필요합니다.',
    '협업 지표 비중을 높여 타부서 기여를 확대하면 좋겠습니다.',
    '문서화·인수인계 품질을 보완하면 업무 연속성이 개선됩니다.',
    '목표 대비 달성률 편차가 있어 분기별 점검 강화가 필요합니다.',
    'AI 도구 활용 등 자기개발 활동을 더 적극적으로 권장합니다.',
  ];
  function pick<T>(arr: T[], i: number): T {
    return arr[i % arr.length];
  }

  // 결과 누적(percentile·companyAvg 계산용)
  const closedResultRows: Array<{ userId: string; finalScore: number; finalGrade: Grade; key: string }> = [];

  // 평가자 결정: downward1 = 본인 managerId(팀장 또는 본부장), downward2 = 그 위(본부장 또는 대표)
  function evaluatorChain(key: string): { d1: string | null; d2: string | null } {
    const u = users[key];
    const d1 = u.managerId; // 1차
    // 2차 = d1 의 manager
    let d2: string | null = null;
    if (d1) {
      const mgrEntry = Object.values(users).find((v) => v.id === d1);
      d2 = mgrEntry?.managerId ?? null;
    }
    return { d1, d2 };
  }

  let kpiSeqIndex = 0;

  // ── 완료 주기: 전원 self + downward1 + downward2 finalized + 결과 ──
  for (const t of targets) {
    const u = users[t.key];
    const specs = kpiSpecsFor(t.jobLevel);

    // 8-1. 개인 KPI (confirmed) + 실적
    const kpiIds: string[] = [];
    for (const spec of specs) {
      const k = await prisma.kpi.create({
        data: {
          userId: u.id,
          cycleId: cycleClosed.id,
          category: spec.category,
          group: spec.group,
          coreStrategy: spec.coreStrategy,
          csf: spec.csf,
          title: spec.title,
          measureMethod: spec.measureMethod,
          measureType: spec.measureType,
          targetValue: spec.measureType === MeasureType.qualitative ? null : 1000,
          weight: spec.weight,
          isQualitative: spec.isQualitative,
          grading: (spec.grading as any) ?? undefined,
          status: KpiStatus.confirmed,
          createdAt: daysAgo(180 - kpiSeqIndex),
        },
      });
      kpiIds.push(k.id);
      // 실적(분기별 1~2건)
      const tg = t.targetGrade;
      const ach = achievementForGrade(spec, tg);
      if (spec.measureType !== MeasureType.qualitative) {
        await prisma.achievement.create({
          data: {
            kpiId: k.id,
            quarter: 3,
            actualValue: ach.actual,
            achievementRate: ach.rate ?? (spec.measureType === MeasureType.count ? ach.actual : 100),
            createdAt: daysAgo(170 - kpiSeqIndex),
          },
        });
        await prisma.achievement.create({
          data: {
            kpiId: k.id,
            quarter: 4,
            actualValue: ach.actual,
            achievementRate: ach.rate ?? (spec.measureType === MeasureType.count ? ach.actual : 100),
            createdAt: daysAgo(160 - kpiSeqIndex),
          },
        });
      }
      kpiSeqIndex++;
    }

    // 8-2. 평가 3종 (self / downward1 / downward2)
    const { d1, d2 } = evaluatorChain(t.key);

    // KpiScore 산출 헬퍼: 등급 배열 → 점수
    function buildScores(gradeList: Grade[]) {
      return specs.map((spec, idx) => {
        const grade = gradeList[idx];
        const score = gradeToScore(grade);
        const ach = achievementForGrade(spec, grade);
        return {
          kpiId: kpiIds[idx],
          grade,
          score,
          weight: spec.weight,
          achievementRate:
            spec.measureType === MeasureType.qualitative
              ? null
              : spec.measureType === MeasureType.count
                ? ach.actual
                : ach.rate,
        };
      });
    }

    // self: selfGrade
    const selfGrades = gradesForTarget(t.selfGrade, specs);
    const selfScores = buildScores(selfGrades);
    const selfTotal = computeTotal(selfScores.map((s) => ({ score: s.score, weight: s.weight })));
    const selfEval = await prisma.evaluation.create({
      data: {
        cycleId: cycleClosed.id,
        evaluatorId: u.id,
        evaluateeId: u.id,
        type: EvaluationType.self,
        round: null,
        status: EvaluationStatus.finalized,
        totalScore: selfTotal,
        finalGrade: scoreToGrade(selfTotal),
        createdAt: daysAgo(150),
        kpiScores: { create: selfScores },
      },
    });

    // downward1 (1차): targetGrade
    if (d1) {
      const d1Grades = gradesForTarget(t.targetGrade, specs);
      const d1Scores = buildScores(d1Grades);
      const d1Total = computeTotal(d1Scores.map((s) => ({ score: s.score, weight: s.weight })));
      const d1Eval = await prisma.evaluation.create({
        data: {
          cycleId: cycleClosed.id,
          evaluatorId: d1,
          evaluateeId: u.id,
          type: EvaluationType.downward,
          round: 1,
          status: EvaluationStatus.finalized,
          totalScore: d1Total,
          finalGrade: scoreToGrade(d1Total),
          createdAt: daysAgo(140),
          kpiScores: { create: d1Scores },
          comments: {
            create: [
              { authorId: d1, quarter: 4, content: pick(STRENGTH_COMMENTS, kpiSeqIndex), createdAt: daysAgo(139) },
              { authorId: d1, quarter: 4, content: pick(IMPROVE_COMMENTS, kpiSeqIndex + 1), createdAt: daysAgo(139, 11) },
            ],
          },
        },
      });
      void d1Eval;
    }

    // downward2 (2차, 확정 기준): targetGrade
    if (d2) {
      const d2Grades = gradesForTarget(t.targetGrade, specs);
      const d2Scores = buildScores(d2Grades);
      const d2Total = computeTotal(d2Scores.map((s) => ({ score: s.score, weight: s.weight })));
      await prisma.evaluation.create({
        data: {
          cycleId: cycleClosed.id,
          evaluatorId: d2,
          evaluateeId: u.id,
          type: EvaluationType.downward,
          round: 2,
          status: EvaluationStatus.finalized,
          totalScore: d2Total,
          finalGrade: scoreToGrade(d2Total),
          overallGrade: t.targetGrade,
          overallReason: '그룹 등급 풀·본부 기여도 반영 확정',
          createdAt: daysAgo(130),
          kpiScores: { create: d2Scores },
          comments: {
            create: [
              { authorId: d2, quarter: 4, content: pick(STRENGTH_COMMENTS, kpiSeqIndex + 2), createdAt: daysAgo(129) },
            ],
          },
        },
      });
    }
    void selfEval;

    // 확정 점수 = 2차(없으면 1차) 총점 = targetGrade 중앙값
    const finalScore = gradeToScore(t.targetGrade);
    closedResultRows.push({ userId: u.id, finalScore, finalGrade: t.targetGrade, key: t.key });
  }

  // 8-3. EvaluationResult (완료 주기 전원) — percentile·companyAvg·byType·byGroup
  const allScores = closedResultRows.map((r) => r.finalScore);
  const companyAvg = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100;
  for (const r of closedResultRows) {
    const t = targets.find((x) => x.key === r.key)!;
    const below = allScores.filter((s) => s < r.finalScore).length;
    const percentile = Math.round((1 - below / allScores.length) * 100 * 100) / 100;
    const selfScore = gradeToScore(t.selfGrade);
    const d1Score = gradeToScore(t.targetGrade);
    const d2Score = gradeToScore(t.targetGrade);
    const byType = {
      self: { score: selfScore, grade: t.selfGrade, comment: null },
      downward1: { score: d1Score, grade: t.targetGrade, comment: pick(STRENGTH_COMMENTS, allScores.indexOf(r.finalScore)) },
      downward2: { score: d2Score, grade: t.targetGrade, comment: pick(IMPROVE_COMMENTS, allScores.indexOf(r.finalScore)) },
    };
    // byGroup: 모든 KPI 가 target 등급이므로 두 그룹 모두 target 등급 중앙값
    const groupScore = gradeToScore(t.targetGrade);
    const byGroup = {
      performance_core: { score: groupScore, grade: t.targetGrade },
      collaboration_growth: { score: groupScore, grade: t.targetGrade },
    };
    await prisma.evaluationResult.create({
      data: {
        userId: r.userId,
        cycleId: cycleClosed.id,
        finalGrade: r.finalGrade,
        finalScore: r.finalScore,
        percentile,
        byType: byType as any,
        byGroup: byGroup as any,
        companyAvg,
        createdAt: daysAgo(125),
      },
    });
  }

  // ── 9. 진행 주기: KPI(submitted/approved) + 평가 일부 in_progress/submitted ──
  // 전원에게 KPI 생성, 상태 섞기. self 평가는 일부만 submitted/in_progress (미제출 위젯용).
  let activeKpiSeq = 0;
  let activeSelfDone = 0;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const u = users[t.key];
    const specs = kpiSpecsFor(t.jobLevel);
    const kpiIds: string[] = [];
    // KPI 상태: 2/3 approved, 1/3 submitted, 가끔 하나는 draft(반려 후 재작성 느낌)
    for (let s = 0; s < specs.length; s++) {
      const spec = specs[s];
      let status: KpiStatus = KpiStatus.approved;
      if (i % 3 === 1) status = KpiStatus.submitted;
      let rejectReason: string | undefined;
      if (i % 5 === 2 && s === 0) {
        status = KpiStatus.draft;
        rejectReason = '측정 지표를 더 구체화해 주세요(목표 수치 명시 필요).';
      }
      const k = await prisma.kpi.create({
        data: {
          userId: u.id,
          cycleId: cycleActive.id,
          category: spec.category,
          group: spec.group,
          coreStrategy: spec.coreStrategy,
          csf: spec.csf,
          title: spec.title,
          measureMethod: spec.measureMethod,
          measureType: spec.measureType,
          targetValue: spec.measureType === MeasureType.qualitative ? null : 1000,
          weight: spec.weight,
          isQualitative: spec.isQualitative,
          grading: (spec.grading as any) ?? undefined,
          status,
          rejectReason,
          createdAt: daysAgo(80 - activeKpiSeq),
        },
      });
      kpiIds.push(k.id);
      // 중간 실적(분기 2 일부)
      if (spec.measureType !== MeasureType.qualitative && status !== KpiStatus.draft) {
        const midGrade: Grade = t.targetGrade;
        const ach = achievementForGrade(spec, midGrade);
        await prisma.achievement.create({
          data: {
            kpiId: k.id,
            quarter: 2,
            actualValue: ach.actual,
            achievementRate: ach.rate ?? (spec.measureType === MeasureType.count ? ach.actual : 100),
            createdAt: daysAgo(20 - (activeKpiSeq % 10)),
          },
        });
      }
      activeKpiSeq++;
    }

    // self 평가: 약 60%만 submitted, 일부 in_progress, 나머지 not_started(미생성=미제출)
    const r = i % 5;
    if (r === 0 || r === 1 || r === 2) {
      // submitted
      const selfGrades = gradesForTarget(t.selfGrade, specs);
      const selfScores = specs.map((spec, idx) => {
        const grade = selfGrades[idx];
        return { kpiId: kpiIds[idx], grade, score: gradeToScore(grade), weight: spec.weight, achievementRate: null };
      });
      const selfTotal = computeTotal(selfScores.map((s) => ({ score: s.score, weight: s.weight })));
      await prisma.evaluation.create({
        data: {
          cycleId: cycleActive.id,
          evaluatorId: u.id,
          evaluateeId: u.id,
          type: EvaluationType.self,
          round: null,
          status: EvaluationStatus.submitted,
          totalScore: selfTotal,
          finalGrade: scoreToGrade(selfTotal),
          createdAt: daysAgo(10),
          kpiScores: { create: selfScores },
        },
      });
      activeSelfDone++;
    } else if (r === 3) {
      // in_progress (점수 미완)
      await prisma.evaluation.create({
        data: {
          cycleId: cycleActive.id,
          evaluatorId: u.id,
          evaluateeId: u.id,
          type: EvaluationType.self,
          round: null,
          status: EvaluationStatus.in_progress,
          createdAt: daysAgo(5),
        },
      });
    }
    // r === 4: not_started → 평가 미생성(미제출자)
  }

  // ── 10. 이의제기 4건 (다양한 상태) — 완료 주기 결과 대상 ──
  // 결과 createdAt 이 daysAgo(125) 라 7일 윈도우는 지났지만, 시드는 직접 상태를 박는다(데모).
  const appealResults = await prisma.evaluationResult.findMany({
    where: { cycleId: cycleClosed.id },
    include: { user: true },
  });
  const findResult = (key: string) => appealResults.find((r) => r.userId === users[key].id)!;
  const hrId = users['hr'].id;

  // (a) submitted — 아직 미검토
  const aSub = findResult('m_procure2'); // D 등급 → 이의 자연스러움
  await prisma.appeal.create({
    data: {
      resultId: aSub.id,
      userId: aSub.userId,
      reason: '하반기 후반 신규 프로젝트 투입 성과가 평가에 반영되지 않은 것 같습니다. 재검토 요청드립니다.',
      status: AppealStatus.submitted,
      createdAt: daysAgo(8),
    },
  });
  // (b) under_review — 팀장 검토 중
  const aUnder = findResult('leadHR'); // C 등급
  await prisma.appeal.create({
    data: {
      resultId: aUnder.id,
      userId: aUnder.userId,
      reason: '협업 지표 건수 집계 기준에 대한 확인이 필요합니다.',
      status: AppealStatus.under_review,
      createdAt: daysAgo(9),
    },
  });
  // (c) answered — 팀장 1차 답변 완료
  const aAns = findResult('m_finance2'); // C 등급
  await prisma.appeal.create({
    data: {
      resultId: aAns.id,
      userId: aAns.userId,
      reason: '정확도 지표 산정 방식에 이견이 있어 재검토를 요청합니다.',
      status: AppealStatus.answered,
      response: '정확도 지표는 분기 평균으로 산정되었으며, 제출하신 자료를 반영해 4분기 수치를 재확인했습니다. 등급 변동은 없습니다.',
      respondedById: users['leadFinance'].id,
      createdAt: daysAgo(11),
    },
  });
  // (d) closed — HR 최종 결정(조정)
  const aClosed = findResult('m_global2'); // C 등급
  await prisma.appeal.create({
    data: {
      resultId: aClosed.id,
      userId: aClosed.userId,
      reason: '해외 프로젝트 환율 영향으로 달성률이 과소 평가되었습니다.',
      status: AppealStatus.closed,
      response: '환율 영향분을 재계산했습니다. 일부 달성률 보정이 타당합니다.',
      respondedById: users['leadGlobal'].id,
      decision: '환율 보정 반영해 협업 지표 1건 추가 인정. 최종 등급 C 유지(점수 상향).',
      decidedById: hrId,
      createdAt: daysAgo(13),
    },
  });

  // ── 11. 보상 (완료 주기 등급 → 인상률, 실제 연동) ──
  let raiseSum = 0;
  for (const r of closedResultRows) {
    const raiseRate = RAISE[r.finalGrade];
    raiseSum += raiseRate;
    await prisma.compensation.create({
      data: {
        userId: r.userId,
        cycleId: cycleClosed.id,
        finalGrade: r.finalGrade,
        raiseRate,
        simulated: false,
        createdAt: daysAgo(120),
      },
    });
  }
  const avgRaise = Math.round((raiseSum / closedResultRows.length) * 100) / 100;

  // ── 12. 감사 로그 (사실적 타임라인 ~20건) ──
  const auditEntries: Array<{
    entity: string;
    entityId: string;
    action: string;
    userId: string | null;
    before?: any;
    after?: any;
    at: Date;
  }> = [
    { entity: 'RuleSet', entityId: ruleSetClosed.id, action: 'rule_set.create', userId: hrId, after: { note: '2025 하반기 규칙 세트 생성' }, at: daysAgo(300) },
    { entity: 'EvaluationCycle', entityId: cycleClosed.id, action: 'cycle.create', userId: hrId, after: { name: '2025년 하반기 정기 성과평가', status: 'draft' }, at: daysAgo(298) },
    { entity: 'EvaluationCycle', entityId: cycleClosed.id, action: 'cycle.activate', userId: hrId, before: { status: 'draft' }, after: { status: 'active' }, at: daysAgo(295) },
    { entity: 'Kpi', entityId: kpiIdSample(), action: 'kpi.approve', userId: users['leadPlant'].id, before: { status: 'submitted' }, after: { status: 'approved' }, at: daysAgo(175) },
    { entity: 'Kpi', entityId: kpiIdSample(), action: 'kpi.reject', userId: users['leadConstruct'].id, before: { status: 'submitted' }, after: { status: 'draft', reason: '목표 수치 구체화 필요' }, at: daysAgo(172) },
    { entity: 'GroupPerformance', entityId: group.id, action: 'group_performance.create', userId: hrId, after: { achievementRate: 112, tier: 'excellent' }, at: daysAgo(190) },
    { entity: 'GradePool', entityId: group.id, action: 'grade_pool.compute', userId: hrId, after: { tier: 'excellent', ratios: poolExcellent }, at: daysAgo(188) },
    { entity: 'Evaluation', entityId: cycleClosed.id, action: 'evaluation.submit', userId: users['senior'].id, before: { status: 'in_progress' }, after: { status: 'submitted', type: 'self' }, at: daysAgo(150) },
    { entity: 'Evaluation', entityId: cycleClosed.id, action: 'evaluation.submit', userId: users['leadPlant'].id, before: { status: 'in_progress' }, after: { status: 'submitted', type: 'downward', round: 1 }, at: daysAgo(140) },
    { entity: 'Evaluation', entityId: cycleClosed.id, action: 'evaluation.finalize', userId: users['divEPC'].id, before: { status: 'submitted' }, after: { status: 'finalized', round: 2 }, at: daysAgo(130) },
    { entity: 'EvaluationCycle', entityId: cycleClosed.id, action: 'cycle.calibrate', userId: hrId, before: { status: 'mid_review' }, after: { status: 'calibration' }, at: daysAgo(128) },
    { entity: 'EvaluationResult', entityId: findResult('senior').id, action: 'result.grade_change', userId: hrId, before: { finalGrade: 'S' }, after: { finalGrade: 'A', reason: '그룹 풀 상한 조정' }, at: daysAgo(127) },
    { entity: 'EvaluationResult', entityId: findResult('leadProcure').id, action: 'result.grade_change', userId: hrId, before: { finalGrade: 'A' }, after: { finalGrade: 'B', reason: '풀 상한 초과로 하향' }, at: daysAgo(127, 11) },
    { entity: 'EvaluationCycle', entityId: cycleClosed.id, action: 'cycle.close', userId: hrId, before: { status: 'calibration' }, after: { status: 'closed' }, at: daysAgo(125) },
    { entity: 'Compensation', entityId: cycleClosed.id, action: 'compensation.compute', userId: hrId, after: { companyAvgRaise: avgRaise, count: closedResultRows.length }, at: daysAgo(120) },
    { entity: 'RuleSet', entityId: ruleSetActive.id, action: 'rule_set.update', userId: hrId, before: { qualitativeMaxPercent: 30 }, after: { qualitativeMaxPercent: 30, note: '2026 상반기 규칙 검토' }, at: daysAgo(118) },
    { entity: 'EvaluationCycle', entityId: cycleActive.id, action: 'cycle.create', userId: hrId, after: { name: '2026년 상반기 정기 성과평가', status: 'draft' }, at: daysAgo(115) },
    { entity: 'EvaluationCycle', entityId: cycleActive.id, action: 'cycle.activate', userId: hrId, before: { status: 'draft' }, after: { status: 'active' }, at: daysAgo(95) },
    { entity: 'EvaluationCycle', entityId: cycleActive.id, action: 'cycle.mid_review', userId: hrId, before: { status: 'active' }, after: { status: 'mid_review' }, at: daysAgo(30) },
    { entity: 'Appeal', entityId: aClosed.id, action: 'appeal.decide', userId: hrId, before: { status: 'answered' }, after: { status: 'closed', decision: '환율 보정 반영, 등급 유지' }, at: daysAgo(13) },
    { entity: 'Appeal', entityId: aAns.id, action: 'appeal.respond', userId: users['leadFinance'].id, before: { status: 'under_review' }, after: { status: 'answered' }, at: daysAgo(11) },
    { entity: 'CycleSchedule', entityId: cycleActive.id, action: 'cycle.schedule.update', userId: hrId, after: { phase: 'self', notifyOffsets: [7, 3, 1] }, at: daysAgo(40) },
  ];
  function kpiIdSample(): string {
    // 감사 로그 entityId 용 — 첫 완료주기 KPI 가 없을 수 있으니 group.id 폴백은 위에서 회피.
    return group.id;
  }
  await prisma.auditLog.createMany({
    data: auditEntries.map((e) => ({
      entity: e.entity,
      entityId: e.entityId,
      action: e.action,
      userId: e.userId,
      before: e.before ?? undefined,
      after: e.after ?? undefined,
      ip: '10.0.1.' + (Math.floor(Math.random() * 200) + 10),
      at: e.at,
    })),
  });

  // ── 13. 알림 (다수 사용자, 읽음/미읽음 섞기) ──
  type NotifSpec = { key: string; type: string; message: string; read?: boolean; at: Date };
  const notifs: NotifSpec[] = [
    // 진행 주기 마감 임박 (D-7)
    { key: 'senior', type: 'deadline_d7', message: '본인평가 마감이 7일 남았어요. (2026 상반기)', at: daysAgo(1) },
    { key: 'pro', type: 'deadline_d7', message: '본인평가 마감이 7일 남았어요. (2026 상반기)', at: daysAgo(1) },
    { key: 'm_construct1', type: 'deadline_d7', message: '본인평가 마감이 7일 남았어요.', at: daysAgo(1) },
    { key: 'm_global1', type: 'deadline_d7', message: '본인평가 마감이 7일 남았어요.', read: true, at: daysAgo(1, 14) },
    // D-3 독촉(코멘트 미작성 팀장/본부장)
    { key: 'leadConstruct', type: 'deadline_d3', message: '코멘트 미작성 팀원이 있어요. 마감 3일 전입니다.', at: daysAgo(0, 9) },
    { key: 'divSales', type: 'deadline_d3', message: '2차 평가 코멘트 작성을 완료해 주세요. (D-3)', at: daysAgo(0, 9, 30) },
    // KPI 반려
    { key: 'm_procure1', type: 'kpi_rejected', message: 'KPI "담당 업무 처리량"이 반려되었어요. 목표 수치를 구체화해 주세요.', at: daysAgo(35) },
    { key: 'm_finance2', type: 'kpi_rejected', message: 'KPI가 반려되었어요. 측정 방법을 보완해 주세요.', read: true, at: daysAgo(36) },
    // 결과 확정 (완료 주기)
    { key: 'senior', type: 'result_finalized', message: '2025 하반기 평가 결과가 확정되었어요. (A 등급)', read: true, at: daysAgo(124) },
    { key: 'pro', type: 'result_finalized', message: '2025 하반기 평가 결과가 확정되었어요. (B 등급)', read: true, at: daysAgo(124) },
    { key: 'leadPlant', type: 'result_finalized', message: '2025 하반기 평가 결과가 확정되었어요. (S 등급)', read: true, at: daysAgo(124) },
    { key: 'm_procure2', type: 'result_finalized', message: '2025 하반기 평가 결과가 확정되었어요. (D 등급)', at: daysAgo(124) },
    // 이의제기 답변/결정
    { key: 'm_finance2', type: 'appeal_answered', message: '이의제기 1차 답변이 등록되었어요.', at: daysAgo(11) },
    { key: 'm_global2', type: 'appeal_decided', message: '이의제기 최종 결정이 내려졌어요. (등급 유지)', read: true, at: daysAgo(13) },
    { key: 'm_procure2', type: 'appeal_answered', message: '이의제기가 접수되어 검토 중이에요.', at: daysAgo(7) },
    // HR 관리자 알림(미제출 현황 등)
    { key: 'hr', type: 'deadline_d3', message: '본인평가 미제출자 6명이 있어요. 독촉이 필요해요.', at: daysAgo(0, 8) },
    { key: 'hr', type: 'result_finalized', message: '2025 하반기 보상 산정이 완료되었어요. (평균 인상률 ' + avgRaise + '%)', read: true, at: daysAgo(120) },
  ];
  for (const n of notifs) {
    await prisma.notification.create({
      data: {
        userId: users[n.key].id,
        type: n.type,
        payload: { message: n.message, cycleId: n.type.startsWith('deadline') ? cycleActive.id : cycleClosed.id },
        readAt: n.read ? new Date(n.at.getTime() + 3600_000) : null,
        createdAt: n.at,
      },
    });
  }

  // ─────────────────────── 요약 출력 ───────────────────────
  const [
    cntUsers, cntDepts, cntKpis, cntAch, cntEvals, cntScores, cntResults,
    cntAppeals, cntComps, cntAudit, cntNotif, cntPools, cntPerf, cntSched, cntTpl,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.department.count(),
    prisma.kpi.count(),
    prisma.achievement.count(),
    prisma.evaluation.count(),
    prisma.kpiScore.count(),
    prisma.evaluationResult.count(),
    prisma.appeal.count(),
    prisma.compensation.count(),
    prisma.auditLog.count(),
    prisma.notification.count(),
    prisma.gradePool.count(),
    prisma.groupPerformance.count(),
    prisma.cycleSchedule.count(),
    prisma.kpiTemplate.count(),
  ]);

  const dist = closedResultRows.reduce(
    (acc, r) => {
      acc[r.finalGrade]++;
      return acc;
    },
    { S: 0, A: 0, B: 0, C: 0, D: 0 } as Record<Grade, number>,
  );

  console.log('✅ Seed 완료 (보고/시연용 데모 데이터)');
  console.log('───────────────────────────────────────────');
  console.log('  조직: 에너지엑스(그룹) → 본부 3 → 팀 7');
  console.log(`  주기: 완료(2025 하반기, closed) + 진행(2026 상반기, mid_review)`);
  console.log('  ── 테이블별 건수 ──');
  console.log(`    departments        : ${cntDepts}`);
  console.log(`    users              : ${cntUsers}`);
  console.log(`    kpi_templates      : ${cntTpl}`);
  console.log(`    kpis               : ${cntKpis}`);
  console.log(`    achievements       : ${cntAch}`);
  console.log(`    evaluations        : ${cntEvals}`);
  console.log(`    kpi_scores         : ${cntScores}`);
  console.log(`    evaluation_results : ${cntResults}`);
  console.log(`    group_performances : ${cntPerf}`);
  console.log(`    grade_pools        : ${cntPools}`);
  console.log(`    cycle_schedules    : ${cntSched}`);
  console.log(`    appeals            : ${cntAppeals}`);
  console.log(`    compensations      : ${cntComps}`);
  console.log(`    audit_logs         : ${cntAudit}`);
  console.log(`    notifications      : ${cntNotif}`);
  console.log('  ── 완료 주기 등급 분포 ──');
  console.log(`    S:${dist.S} A:${dist.A} B:${dist.B} C:${dist.C} D:${dist.D}  (전사평균점수 ${companyAvg}, 평균인상률 ${avgRaise}%)`);
  console.log('  ── 데모 로그인 (비밀번호: Passw0rd!) ──');
  console.log('    hr@energyx.co.kr        (HR관리자)  | division@energyx.co.kr (EPC본부장)');
  console.log('    lead@energyx.co.kr      (플랜트팀장)| senior@energyx.co.kr   (선임)');
  console.log('    pro@energyx.co.kr       (프로)');
  console.log('───────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
