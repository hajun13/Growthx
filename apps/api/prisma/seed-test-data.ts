/**
 * 에너지엑스 인사평가 — 테스트 계정·전체 페이지 데이터 시드 (2026-06-12)
 *
 * 목적: 계정 하나(test@energyx.co.kr / 1234, hr_admin)로 모든 페이지를 데이터와 함께
 *       확인할 수 있도록, 현재 2026 사이클에 평가·실적·모니터링 데이터를 채운다.
 *
 * 구성:
 *  - 테스트팀(경영그룹>경영관리본부 산하) + 김테스트(hr_admin·팀장) + 팀원 3명
 *  - KPI 4건/인(서술형, 기존 임포트와 동일 모양) + 분기실적 + 검토의견 + 스냅샷
 *  - 본인평가·부서장평가(상태 다양: finalized/submitted/in_progress/not_started)
 *  - 중간점검(MidtermReview·KPI별 체크인·보완조치·재조정요청) — mid_review 단계 전환
 *  - 평가결과(2026 live shape + 2025 import shape) + 이의제기 + 보상
 *  - 월별실적·그룹실적·등급풀·역량문항/응답·일정·알림·감사로그
 *
 * 멱등: test* 계정 관련 데이터를 먼저 정리 후 재생성. 공용 테이블(그룹실적 등)은 upsert.
 * 실행: apps/api 에서 DATABASE_URL=<host용 URL> npx ts-node prisma/seed-test-data.ts
 */
import {
  PrismaClient, Role, JobLevel, DepartmentType, CycleStatus,
  KpiCategory, KpiGroup, MeasureType, KpiStatus, VisibilityScope,
  EvaluationType, EvaluationStatus, Grade, GroupTier, AppealStatus,
  MidtermReviewStatus, ActionItemStatus, RebaselineRequestStatus, ReviewKind,
} from '@prisma/client';
import type { Kpi, CompetencyQuestion, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_TEAM_NAME = '테스트팀';
const T = {
  lead: { email: 'test@energyx.co.kr', name: '김테스트', position: 'team_lead', jobLevel: JobLevel.team_lead, role: Role.hr_admin, scope: VisibilityScope.company, salary: 98_000_000, prevSalary: 93_000_000, birthDate: '1982-04-12', hireDate: '2015-03-02' },
  m1: { email: 'test1@energyx.co.kr', name: '박테스트', position: 'chief', jobLevel: JobLevel.senior_plus, role: Role.employee, scope: VisibilityScope.self, salary: 84_000_000, prevSalary: 81_000_000, birthDate: '1988-09-23', hireDate: '2018-07-01' },
  m2: { email: 'test2@energyx.co.kr', name: '이테스트', position: 'senior', jobLevel: JobLevel.senior_plus, role: Role.employee, scope: VisibilityScope.self, salary: 72_000_000, prevSalary: 70_000_000, birthDate: '1991-12-05', hireDate: '2020-01-06' },
  m3: { email: 'test3@energyx.co.kr', name: '최테스트', position: 'pro', jobLevel: JobLevel.senior_minus, role: Role.employee, scope: VisibilityScope.self, salary: 58_000_000, prevSalary: 56_000_000, birthDate: '1995-06-18', hireDate: '2022-09-01' },
};
const TEST_EMAILS = Object.values(T).map((t) => t.email);

// gradeScale(S96~100/A91~95/B85~90/C80~84/D0~79) 구간 중앙값 — scoring.gradeToScore 와 동일.
const MID: Record<Grade, number> = { S: 98, A: 93, B: 88, C: 82, D: 40 };

// 서술형 KPI 4종(임포트 데이터와 동일 모양: measureType=qualitative + targetText + gradingCriteria).
// isQualitative=false 가 "정량(서술형)" — 진실소스는 isQualitative(kpi-quant-qual-source).
const KPI_DEFS = [
  { category: KpiCategory.orders, group: KpiGroup.performance_core, weight: 30, isQualitative: false, title: '담당 프로젝트 수주·업무수행 목표 달성', targetText: '연간 수주지원 12건 완수, 업무수행 오류율 1% 이하 유지' },
  { category: KpiCategory.revenue, group: KpiGroup.performance_core, weight: 30, isQualitative: false, title: '담당 영역 매출 기여 목표 달성', targetText: '담당 매출 기여 8억원(전년 대비 +10%) 달성' },
  { category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, weight: 20, isQualitative: false, title: '부서 간 협업 지원 건수', targetText: '타 부서 협업 지원 10건 이상 수행 및 만족도 확보' },
  { category: KpiCategory.development, group: KpiGroup.collaboration_growth, weight: 20, isQualitative: true, title: 'AI 활용 업무 자동화·자기개발', targetText: 'AI 도구 기반 업무 자동화 2건 적용, 직무 교육 16시간 이수' },
] as const;

const GRADING_CRITERIA = {
  S: '목표 대비 110% 초과 달성, 전사 확산 가능한 성과 창출',
  A: '목표 대비 101~110% 달성, 조직 기여도 우수',
  B: '목표 100% 달성, 계획대로 안정적 수행',
  C: '목표 대비 90~99% 달성, 일부 보완 필요',
  D: '목표 대비 90% 미만, 적극적인 개선 필요',
};

type Ctx = {
  cycleId: string; cycle2025Id: string | null;
  users: Record<keyof typeof T, { id: string }>;
  teamId: string; divisionId: string; groupId: string;
  divHeadId: string; groupRepId: string;
};

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const evalWhere = { OR: [{ evaluatorId: { in: ids } }, { evaluateeId: { in: ids } }] };
    await prisma.evaluationEvidence.deleteMany({ where: { evaluation: evalWhere } });
    await prisma.kpiScore.deleteMany({ where: { evaluation: evalWhere } });
    await prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { evaluation: evalWhere }] } });
    await prisma.evaluation.deleteMany({ where: evalWhere });
    await prisma.midtermKpiCheckIn.deleteMany({ where: { midtermReview: { evaluateeId: { in: ids } } } });
    await prisma.midtermReview.deleteMany({ where: { OR: [{ evaluateeId: { in: ids } }, { reviewerId: { in: ids } }] } });
    await prisma.actionItem.deleteMany({ where: { OR: [{ evaluateeId: { in: ids } }, { createdById: { in: ids } }, { assigneeId: { in: ids } }] } });
    await prisma.rebaselineRequest.deleteMany({ where: { OR: [{ evaluateeId: { in: ids } }, { reviewerId: { in: ids } }] } });
    await prisma.kpiSnapshot.deleteMany({ where: { userId: { in: ids } } });
    await prisma.appeal.deleteMany({ where: { OR: [{ userId: { in: ids } }, { respondedById: { in: ids } }, { decidedById: { in: ids } }] } });
    await prisma.compensation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.compensationAdjustment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.evaluationResult.deleteMany({ where: { userId: { in: ids } } });
    await prisma.competencyResponse.deleteMany({ where: { userId: { in: ids } } });
    await prisma.competencyQuestion.deleteMany({ where: { createdById: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.monthlyPerformance.deleteMany({ where: { enteredById: { in: ids } } });
    await prisma.review.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { kpi: { userId: { in: ids } } }] } });
    await prisma.achievement.deleteMany({ where: { kpi: { userId: { in: ids } } } });
    await prisma.kpi.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  const team = await prisma.department.findFirst({ where: { name: TEST_TEAM_NAME, type: DepartmentType.team } });
  if (team) {
    await prisma.user.updateMany({ where: { departmentId: team.id }, data: { departmentId: null } });
    await prisma.department.delete({ where: { id: team.id } });
  }
  console.log('🧹 기존 테스트 픽스처 정리 완료');
}

async function createKpisFor(userId: string, cycleId: string, statuses: KpiStatus[]) {
  const kpis: Kpi[] = [];
  for (let i = 0; i < KPI_DEFS.length; i++) {
    const d = KPI_DEFS[i];
    kpis.push(await prisma.kpi.create({ data: {
      userId, cycleId, category: d.category, group: d.group,
      coreStrategy: d.category === KpiCategory.development ? 'AI 역량 강화' : '2026 성과 목표 달성',
      csf: '분기별 진척 점검 및 증빙 관리',
      title: d.title, measureMethod: '서술형 목표 대비 달성 수준 평가',
      measureType: MeasureType.qualitative, targetText: d.targetText,
      weight: d.weight, isQualitative: d.isQualitative,
      gradingCriteria: GRADING_CRITERIA, status: statuses[i] ?? statuses[0],
    }}));
  }
  return kpis;
}

/** 평가(self/downward) + KpiScore + Comment 생성. grades 길이 = kpi 수. */
async function createEvaluation(opts: {
  cycleId: string; evaluatorId: string; evaluateeId: string;
  type: EvaluationType; round: number | null; status: EvaluationStatus;
  kpis: { id: string; weight: number; isQualitative: boolean }[];
  grades?: Grade[]; noteAs?: 'self' | 'reviewer'; comment?: string;
  scoreOnlyFirstN?: number; // in_progress: 앞 N개만 점수 저장
}) {
  const { kpis, grades } = opts;
  let totalScore: number | null = null;
  let finalGrade: Grade | null = null;
  const scored = grades ? kpis.slice(0, opts.scoreOnlyFirstN ?? kpis.length) : [];
  if (grades && scored.length === kpis.length) {
    totalScore = Math.round(kpis.reduce((s, k, i) => s + MID[grades[i]] * k.weight, 0)) / 100;
    finalGrade = totalScore >= 96 ? Grade.S : totalScore >= 91 ? Grade.A : totalScore >= 85 ? Grade.B : totalScore >= 80 ? Grade.C : Grade.D;
  }
  const ev = await prisma.evaluation.create({ data: {
    cycleId: opts.cycleId, evaluatorId: opts.evaluatorId, evaluateeId: opts.evaluateeId,
    type: opts.type, round: opts.round, status: opts.status,
    totalScore, finalGrade,
  }});
  if (grades) {
    for (let i = 0; i < scored.length; i++) {
      const k = scored[i];
      await prisma.kpiScore.create({ data: {
        evaluationId: ev.id, kpiId: k.id,
        achievementRate: k.isQualitative ? null : [104.2, 101.5, 100, 96.4][i % 4],
        grade: grades[i], score: MID[grades[i]], weight: k.weight,
        selfNote: opts.noteAs === 'self' ? '상반기 목표 대비 계획대로 진행했고, 하반기 가속을 위한 준비를 마쳤습니다.' : null,
        reviewerNote: opts.noteAs === 'reviewer' ? '목표 수준을 안정적으로 달성 중입니다. 하반기 협업 확대를 기대합니다.' : null,
      }});
    }
  }
  if (opts.comment) {
    await prisma.comment.create({ data: { evaluationId: ev.id, authorId: opts.evaluatorId, quarter: 2, content: opts.comment } });
  }
  return { ev, totalScore, finalGrade };
}

async function main() {
  const passwordHash = await bcrypt.hash('1234', 10);

  // ── 0. 사이클·앵커 확보 ──
  const cycle = await prisma.evaluationCycle.findFirst({ where: { year: 2026 } });
  if (!cycle) throw new Error('2026 사이클이 없습니다. 기본 seed 먼저 실행하세요.');
  const cycle2025 = await prisma.evaluationCycle.findFirst({ where: { year: 2025 } });

  // 6월 = 중간점검 루틴 → mid_review 단계(재조정 승인/반려 등 중간점검 쓰기 동작 허용).
  if (cycle.status === CycleStatus.draft || cycle.status === CycleStatus.active) {
    await prisma.evaluationCycle.update({ where: { id: cycle.id }, data: { status: CycleStatus.mid_review } });
    console.log(`🔁 2026 사이클 단계 전환: ${cycle.status} → mid_review`);
  }

  const group = await prisma.department.findFirst({ where: { name: '경영그룹', type: DepartmentType.group } });
  const division = await prisma.department.findFirst({ where: { name: '경영관리본부', type: DepartmentType.division } });
  const divHead = await prisma.user.findUnique({ where: { email: 'hlee5032@energyx.co.kr' } });
  const groupRep = await prisma.user.findUnique({ where: { email: 'dhong@energyx.co.kr' } });
  if (!group || !division || !divHead || !groupRep) throw new Error('앵커 조직/사용자(경영그룹·경영관리본부·이현우·홍두화)가 없습니다.');

  await cleanup();

  // ── 1. 테스트팀 + 계정 4개 ──
  const team = await prisma.department.create({ data: { name: TEST_TEAM_NAME, type: DepartmentType.team, parentId: division.id } });
  const mk = async (t: { email: string; name: string; position: string; jobLevel: JobLevel; role: Role; scope: VisibilityScope; salary: number; prevSalary: number; birthDate: string; hireDate: string }, managerId: string | null) =>
    prisma.user.create({ data: {
      email: t.email, name: t.name, passwordHash, role: t.role, position: t.position,
      jobLevel: t.jobLevel, departmentId: team.id, managerId, visibilityScope: t.scope,
      currentSalary: t.salary, previousSalary: t.prevSalary, mustChangePassword: false,
      birthDate: new Date(`${t.birthDate}T00:00:00Z`), hireDate: new Date(`${t.hireDate}T00:00:00Z`),
    }});
  const lead = await mk(T.lead, divHead.id);
  const m1 = await mk(T.m1, lead.id);
  const m2 = await mk(T.m2, lead.id);
  const m3 = await mk(T.m3, lead.id);
  await prisma.department.update({ where: { id: team.id }, data: { headUserId: lead.id } });
  console.log('👤 테스트 계정 4개 + 테스트팀 생성');

  // ── 2. KPI (4건/인) + 분기실적 + 검토의견 + 스냅샷 ──
  const kLead = await createKpisFor(lead.id, cycle.id, [KpiStatus.confirmed, KpiStatus.confirmed, KpiStatus.confirmed, KpiStatus.confirmed]);
  const kM1 = await createKpisFor(m1.id, cycle.id, [KpiStatus.confirmed, KpiStatus.confirmed, KpiStatus.confirmed, KpiStatus.confirmed]);
  const kM2 = await createKpisFor(m2.id, cycle.id, [KpiStatus.submitted, KpiStatus.submitted, KpiStatus.submitted, KpiStatus.submitted]);
  const kM3 = await createKpisFor(m3.id, cycle.id, [KpiStatus.confirmed, KpiStatus.confirmed, KpiStatus.draft, KpiStatus.draft]);

  for (const k of [...kLead.slice(0, 2), ...kM1.slice(0, 2)]) {
    await prisma.achievement.create({ data: { kpiId: k.id, quarter: 1, actualValue: 25, achievementRate: 98.5 } });
    await prisma.achievement.create({ data: { kpiId: k.id, quarter: 2, actualValue: 52, achievementRate: 103.2 } });
  }
  await prisma.review.create({ data: { kpiId: kM1[0].id, quarter: 2, kind: ReviewKind.strength, content: '수주 지원 품질이 높고 일정 준수가 우수합니다.', authorId: lead.id } });
  await prisma.review.create({ data: { kpiId: kM1[3].id, quarter: 2, kind: ReviewKind.improvement, content: 'AI 자동화 적용 범위를 팀 공통 업무로 확대해 주세요.', authorId: lead.id } });

  const snapData = (ks: typeof kLead) => ks.map((k) => ({
    id: k.id, title: k.title, category: k.category, group: k.group,
    measureType: k.measureType, targetValue: k.targetValue, targetText: k.targetText,
    weight: k.weight, isQualitative: k.isQualitative, status: k.status,
  }));
  await prisma.kpiSnapshot.create({ data: { cycleId: cycle.id, userId: lead.id, label: '1차 확정', data: snapData(kLead), createdBy: lead.id } });
  await prisma.kpiSnapshot.create({ data: { cycleId: cycle.id, userId: m1.id, label: '1차 확정', data: snapData(kM1), createdBy: lead.id } });
  console.log('📋 KPI 16건 + 분기실적 + 검토의견 + 스냅샷 생성');

  // ── 3. 평가 (본인 + 부서장 다단계) ──
  const slim = (ks: typeof kLead) => ks.map((k) => ({ id: k.id, weight: k.weight, isQualitative: k.isQualitative }));

  // 본인평가: 김테스트 submitted / 박 finalized / 이 submitted / 최 not_started
  const selfLead = await createEvaluation({ cycleId: cycle.id, evaluatorId: lead.id, evaluateeId: lead.id, type: EvaluationType.self, round: null, status: EvaluationStatus.submitted, kpis: slim(kLead), grades: [Grade.A, Grade.S, Grade.A, Grade.B], noteAs: 'self', comment: '상반기 핵심 과제를 계획대로 완수했습니다. 하반기에는 협업 확대에 집중하겠습니다.' });
  await createEvaluation({ cycleId: cycle.id, evaluatorId: m1.id, evaluateeId: m1.id, type: EvaluationType.self, round: null, status: EvaluationStatus.finalized, kpis: slim(kM1), grades: [Grade.B, Grade.A, Grade.A, Grade.B], noteAs: 'self', comment: '수주 지원 12건 중 7건을 상반기에 완료했습니다.' });
  await createEvaluation({ cycleId: cycle.id, evaluatorId: m2.id, evaluateeId: m2.id, type: EvaluationType.self, round: null, status: EvaluationStatus.submitted, kpis: slim(kM2), grades: [Grade.S, Grade.S, Grade.A, Grade.S], noteAs: 'self', comment: '목표를 초과 달성 중입니다. 신규 고객 2건을 추가 확보했습니다.' });
  await createEvaluation({ cycleId: cycle.id, evaluatorId: m3.id, evaluateeId: m3.id, type: EvaluationType.self, round: null, status: EvaluationStatus.not_started, kpis: slim(kM3) });

  // 부서장 평가(1차 = 김테스트): 박 finalized / 이 in_progress(2개만 점수) / 최 not_started
  const d1M1 = await createEvaluation({ cycleId: cycle.id, evaluatorId: lead.id, evaluateeId: m1.id, type: EvaluationType.downward, round: 1, status: EvaluationStatus.finalized, kpis: slim(kM1), grades: [Grade.B, Grade.B, Grade.A, Grade.B], noteAs: 'reviewer', comment: '안정적인 수행 능력이 강점입니다. 하반기 매출 기여 확대를 기대합니다.' });
  await createEvaluation({ cycleId: cycle.id, evaluatorId: lead.id, evaluateeId: m2.id, type: EvaluationType.downward, round: 1, status: EvaluationStatus.in_progress, kpis: slim(kM2), grades: [Grade.S, Grade.S, Grade.A, Grade.S], noteAs: 'reviewer', scoreOnlyFirstN: 2 });
  await createEvaluation({ cycleId: cycle.id, evaluatorId: lead.id, evaluateeId: m3.id, type: EvaluationType.downward, round: 1, status: EvaluationStatus.not_started, kpis: slim(kM3) });

  // 김테스트 본인이 받는 평가: 1차 이현우(finalized) + 2차 홍두화(finalized)
  const d1Lead = await createEvaluation({ cycleId: cycle.id, evaluatorId: divHead.id, evaluateeId: lead.id, type: EvaluationType.downward, round: 1, status: EvaluationStatus.finalized, kpis: slim(kLead), grades: [Grade.A, Grade.S, Grade.A, Grade.B], noteAs: 'reviewer', comment: '팀 운영과 본인 성과 모두 우수합니다.' });
  const d2Lead = await createEvaluation({ cycleId: cycle.id, evaluatorId: groupRep.id, evaluateeId: lead.id, type: EvaluationType.downward, round: 2, status: EvaluationStatus.finalized, kpis: slim(kLead), grades: [Grade.A, Grade.A, Grade.A, Grade.B], noteAs: 'reviewer', comment: '그룹 차원 협업 기여가 돋보입니다.' });

  // 팀원들의 2차(본부장) 평가 — 대기 상태로 배정만
  for (const [m, ks] of [[m1, kM1], [m2, kM2], [m3, kM3]] as const) {
    await createEvaluation({ cycleId: cycle.id, evaluatorId: divHead.id, evaluateeId: m.id, type: EvaluationType.downward, round: 2, status: EvaluationStatus.not_started, kpis: slim(ks) });
  }

  // 증빙 첨부(본인평가 × 첫 KPI)
  await prisma.evaluationEvidence.create({ data: {
    evaluationId: selfLead.ev.id, kpiId: kLead[0].id,
    filename: '상반기_수주지원_실적증빙.txt', mimeType: 'text/plain',
    size: 120, data: Buffer.from('2026 상반기 수주 지원 실적: 7건 완료 (목표 12건 대비 58%)\n- 상세 내역은 ERP 수주관리 화면 참조', 'utf-8'),
    uploadedById: lead.id,
  }});
  console.log('📝 평가 11건(본인 4 + 부서장 7) + 점수 + 코멘트 + 증빙 생성');

  // ── 4. 중간점검 (mid_review 루틴 전체) ──
  const mkMidterm = async (user: { id: string }, ks: typeof kLead, status: MidtermReviewStatus, opts?: { reviewerId?: string; grades?: Grade[] }) => {
    const mr = await prisma.midtermReview.create({ data: {
      cycleId: cycle.id, evaluateeId: user.id, status,
      selfNote: status !== MidtermReviewStatus.pending ? '상반기 목표 대비 순항 중입니다. 일부 지표는 하반기 보완 계획을 수립했습니다.' : null,
      selfSubmittedAt: status !== MidtermReviewStatus.pending ? new Date('2026-06-08T09:30:00Z') : null,
      reviewerId: opts?.reviewerId ?? null,
      reviewerNote: status === MidtermReviewStatus.confirmed ? '진척 상황을 확인했습니다. 매출 기여 KPI는 3분기 집중 관리가 필요합니다.' : null,
      confirmedAt: status === MidtermReviewStatus.confirmed ? new Date('2026-06-10T14:00:00Z') : null,
    }});
    if (status !== MidtermReviewStatus.pending) {
      for (let i = 0; i < ks.length; i++) {
        await prisma.midtermKpiCheckIn.create({ data: {
          midtermReviewId: mr.id, kpiId: ks[i].id,
          selfActualText: ['수주 지원 7건 완료(연간 12건 목표)', '상반기 매출 기여 3.8억(연간 8억 목표)', '협업 지원 6건 수행', 'AI 자동화 1건 적용, 교육 8시간 이수'][i],
          selfActualValue: [58.3, 47.5, 60, 50][i],
          selfNote: '하반기 가속 계획 수립 완료',
          selfGrade: (opts?.grades ?? [Grade.B, Grade.B, Grade.A, Grade.B])[i],
          reviewerNote: status === MidtermReviewStatus.confirmed ? '확인했습니다.' : null,
          reviewerGrade: status === MidtermReviewStatus.confirmed ? (opts?.grades ?? [Grade.B, Grade.B, Grade.A, Grade.B])[i] : null,
          confirmedAt: status === MidtermReviewStatus.confirmed ? new Date('2026-06-10T14:00:00Z') : null,
        }});
      }
    }
    return mr;
  };
  await mkMidterm(lead, kLead, MidtermReviewStatus.self_done, { grades: [Grade.A, Grade.B, Grade.A, Grade.B] });
  await mkMidterm(m1, kM1, MidtermReviewStatus.confirmed, { reviewerId: lead.id });
  await mkMidterm(m2, kM2, MidtermReviewStatus.self_done, { grades: [Grade.S, Grade.A, Grade.A, Grade.S] });
  await mkMidterm(m3, kM3, MidtermReviewStatus.pending);

  // 보완 조치(ActionItem)
  await prisma.actionItem.create({ data: { cycleId: cycle.id, evaluateeId: m1.id, kpiId: kM1[1].id, title: '하반기 매출 기여 가속 계획 수립', detail: '3분기 신규 안건 2건 발굴 및 제안서 제출', assigneeId: m1.id, dueDate: new Date('2026-09-30T00:00:00Z'), status: ActionItemStatus.in_progress, createdById: lead.id } });
  await prisma.actionItem.create({ data: { cycleId: cycle.id, evaluateeId: m1.id, kpiId: kM1[3].id, title: 'AI 자동화 팀 공통 업무 확대', detail: '보고서 자동화 템플릿을 팀 전체에 배포', assigneeId: m1.id, dueDate: new Date('2026-07-31T00:00:00Z'), status: ActionItemStatus.done, completedAt: new Date('2026-06-11T10:00:00Z'), completionNote: '템플릿 배포 완료, 팀 적용률 100%', createdById: lead.id } });
  await prisma.actionItem.create({ data: { cycleId: cycle.id, evaluateeId: m2.id, kpiId: kM2[2].id, title: '협업 만족도 조사 실시', detail: '협업 수혜 부서 대상 만족도 설문', assigneeId: m2.id, dueDate: new Date('2026-08-31T00:00:00Z'), status: ActionItemStatus.planned, createdById: lead.id } });
  await prisma.actionItem.create({ data: { cycleId: cycle.id, evaluateeId: lead.id, kpiId: kLead[2].id, title: '그룹 간 협업 사례 공유회 개최', detail: '상반기 협업 우수 사례 3건 전사 공유', assigneeId: lead.id, dueDate: new Date('2026-07-15T00:00:00Z'), status: ActionItemStatus.in_progress, createdById: divHead.id } });

  // KPI 목표 재조정 요청
  await prisma.rebaselineRequest.create({ data: {
    cycleId: cycle.id, evaluateeId: m1.id, status: RebaselineRequestStatus.submitted,
    reason: '담당 프로젝트 1건이 고객사 사정으로 4분기로 연기되어 연간 수주 목표 조정이 필요합니다.',
    items: [{ kpiId: kM1[0].id, targetText: '연간 수주지원 10건 완수(연기 1건 제외), 업무수행 오류율 1% 이하 유지', weight: 30 }],
  }});
  await prisma.rebaselineRequest.create({ data: {
    cycleId: cycle.id, evaluateeId: m2.id, status: RebaselineRequestStatus.rejected,
    reason: '협업 지원 건수 목표를 상향 조정하고 싶습니다.',
    items: [{ kpiId: kM2[2].id, targetText: '타 부서 협업 지원 15건 이상 수행', weight: 20 }],
    reviewerId: lead.id, reviewComment: '목표 상향은 긍정적이나 현행 목표 유지 후 초과 달성으로 평가에 반영하는 것이 적절합니다.',
    reviewedAt: new Date('2026-06-09T11:00:00Z'),
  }});
  await prisma.rebaselineRequest.create({ data: {
    cycleId: cycle.id, evaluateeId: lead.id, status: RebaselineRequestStatus.submitted,
    reason: '조직 개편으로 협업 범위가 그룹 전체로 확대되어 협업 KPI 목표 조정이 필요합니다.',
    items: [{ kpiId: kLead[2].id, targetText: '그룹 전체 협업 지원 14건 이상 수행', weight: 20 }],
  }});
  console.log('🔄 중간점검 4건 + 체크인 12건 + 보완조치 4건 + 재조정요청 3건 생성');

  // ── 5. 평가 결과 (2026 live + 2025 import) ──
  const orgSnap = { groupSnapshot: group.name, divisionSnapshot: division.name, teamSnapshot: team.name, groupIdSnapshot: group.id, divisionIdSnapshot: division.id, teamIdSnapshot: team.id };
  const mkResult = (userId: string, self: number | null, d1: number | null, d2: number | null, finalScore: number, finalGrade: Grade, compScore: number | null) => {
    const g = (s: number | null): Grade | null => s == null ? null : s >= 96 ? Grade.S : s >= 91 ? Grade.A : s >= 85 ? Grade.B : s >= 80 ? Grade.C : Grade.D;
    return prisma.evaluationResult.create({ data: {
      userId, cycleId: cycle.id, finalGrade, finalScore, percentile: null,
      byType: {
        self: { score: self, grade: g(self), comment: self != null ? '본인평가 제출 완료' : null },
        downward1: { score: d1, grade: g(d1), comment: d1 != null ? '1차(팀장) 평가 완료' : null },
        downward2: { score: d2, grade: g(d2), comment: d2 != null ? '2차(본부장) 평가 완료' : null },
        downward3: { score: null, grade: null, comment: null },
        compScore, perfSum: finalScore,
        stageMode: d2 != null ? 'normal' : 'exception1',
        source: 'live',
      },
      byGroup: {
        performance_core: { score: finalScore, grade: finalGrade },
        collaboration_growth: { score: Math.min(100, finalScore + 1.5), grade: g(Math.min(100, finalScore + 1.5)) },
      },
      companyAvg: 89.9, ...orgSnap,
    }});
  };
  // 김테스트: 1차 93.5(이현우) + 2차 92.5(홍두화) → 가중 (0.5·93.5+0.3·92.5)/0.8 = 93.13 → A
  const rLead = await mkResult(lead.id, selfLead.totalScore, d1Lead.totalScore, d2Lead.totalScore, 93.13, Grade.A, 88);
  const rM1 = await mkResult(m1.id, 89.5, d1M1.totalScore, null, d1M1.totalScore ?? 89, Grade.B, 84);
  const rM2 = await mkResult(m2.id, 97, 97, null, 97, Grade.S, null);

  // 2025 결과(임포트 모양) — YoY 개인 타임라인용
  if (cycle2025) {
    await prisma.evaluationResult.create({ data: {
      userId: lead.id, cycleId: cycle2025.id, finalGrade: Grade.B, finalScore: 88.5,
      byType: { sum: { perf: 88.5, comp: 86 }, final: { perf: 88, comp: 85 }, round1: { perf: 89, comp: 87 }, round2: { perf: 88.5, comp: 86 }, source: 'import' },
      companyAvg: 87.2, ...orgSnap,
    }});
  }
  console.log('🏆 평가결과 4건(2026×3 + 2025×1) 생성');

  // ── 6. 이의제기 + 보상 ──
  await prisma.appeal.create({ data: { resultId: rM1.id, userId: m1.id, status: AppealStatus.submitted, reason: '협업성과 KPI는 목표 10건 대비 상반기에만 6건을 완료했는데 B 등급은 과소평가라고 생각합니다. 재검토 부탁드립니다.' } });
  await prisma.appeal.create({ data: { resultId: rM2.id, userId: m2.id, status: AppealStatus.answered, reason: '매출 기여 산정에 4월 계약 건이 누락된 것 같습니다.', response: '확인 결과 4월 계약 건은 6월 정산분에 반영 예정입니다. 점수 영향은 없습니다.', respondedById: lead.id } });

  const raise: Record<Grade, number> = { S: 7, A: 5, B: 3, C: 1, D: 0 };
  for (const [u, t, grade] of [[lead, T.lead, Grade.A], [m1, T.m1, Grade.B], [m2, T.m2, Grade.S], [m3, T.m3, Grade.C]] as const) {
    await prisma.compensation.create({ data: {
      userId: u.id, cycleId: cycle.id, finalGrade: grade, raiseRate: raise[grade],
      baseSalary: t.salary, nextYearSalary: Math.round(t.salary * (1 + raise[grade] / 100)),
      simulated: false,
    }});
  }

  // 보상 조정(2026 연봉갱신 엑셀 양식 — 조정분·승격·인센티브·비고). 일부만 채워 빈/채움 혼합 확인.
  await prisma.compensationAdjustment.create({ data: { userId: lead.id, cycleId: cycle.id, adjustmentAmount: 2_000_000, incentiveAmount: 5_000_000, note: '리더십 보너스 반영' } });
  await prisma.compensationAdjustment.create({ data: { userId: m1.id, cycleId: cycle.id, adjustmentAmount: -500_000, note: '직무 재배치 조정' } });
  await prisma.compensationAdjustment.create({ data: { userId: m2.id, cycleId: cycle.id, promotionPositionCode: 'chief', incentiveAmount: 8_000_000, note: 'S등급 승격 + 성과 인센티브' } });
  console.log('⚖️ 이의제기 2건 + 보상 4건 + 보상조정 3건 생성');

  // ── 7. 월별 실적 + 그룹 실적 + 등급 풀 ──
  const groups = await prisma.department.findMany({ where: { type: DepartmentType.group } });
  // month=0 = 전년도(2024) 연간 참고 sentinel(집계 제외), month 1~6 = 2026 월별 실적.
  const mgmtMonthly = [
    [0, 5800, 5620], [1, 500, 472], [2, 500, 515], [3, 500, 488], [4, 500, 542], [5, 500, 561], [6, 500, 530],
  ] as const;
  for (const dept of [group, division]) {
    for (const [month, target, actual] of mgmtMonthly) {
      for (const [cat, mul] of [[KpiCategory.revenue, 1_000_000], [KpiCategory.orders, 800_000]] as const) {
        // 원가는 매출의 ~72%(원가목표)·~70%(원가실적) → 매출총이익 가시화. 수주 카테고리는 원가 미집계(null).
        const costTarget = cat === KpiCategory.revenue ? Math.round(target * mul * 0.72) : null;
        const costActual = cat === KpiCategory.revenue ? Math.round(actual * mul * 0.70) : null;
        await prisma.monthlyPerformance.upsert({
          where: { cycleId_departmentId_year_month_category: { cycleId: cycle.id, departmentId: dept.id, year: 2026, month, category: cat } },
          create: { cycleId: cycle.id, departmentId: dept.id, year: 2026, month, category: cat, targetAmount: target * mul, actualAmount: actual * mul, costTarget, costActual, enteredById: lead.id },
          update: { targetAmount: target * mul, actualAmount: actual * mul, costTarget, costActual, enteredById: lead.id },
        });
      }
    }
  }

  const tierByName: Record<string, { tier: GroupTier; rate: number; rev: number; ord: number; profit: number }> = {
    '경영그룹': { tier: GroupTier.standard, rate: 96.8, rev: 3_100_000_000, ord: 2_500_000_000, profit: 410_000_000 },
    '엔지니어링그룹': { tier: GroupTier.excellent, rate: 108.4, rev: 12_400_000_000, ord: 9_800_000_000, profit: 1_350_000_000 },
    '친환경기술그룹': { tier: GroupTier.excellent, rate: 112.1, rev: 15_200_000_000, ord: 11_600_000_000, profit: 1_780_000_000 },
    '건축설계그룹': { tier: GroupTier.standard, rate: 97.5, rev: 6_800_000_000, ord: 5_200_000_000, profit: 620_000_000 },
    '이노베이션그룹': { tier: GroupTier.poor, rate: 84.2, rev: 1_900_000_000, ord: 1_400_000_000, profit: -120_000_000 },
  };
  const poolByTier: Record<GroupTier, [number, number, number, number, number]> = {
    excellent: [10, 20, 50, 15, 5], standard: [5, 10, 60, 20, 5], poor: [3, 7, 60, 25, 5],
  };
  for (const g of groups) {
    const conf = tierByName[g.name];
    if (!conf) continue;
    await prisma.groupPerformance.upsert({
      where: { groupId_cycleId: { groupId: g.id, cycleId: cycle.id } },
      create: { groupId: g.id, cycleId: cycle.id, revenue: conf.rev, orders: conf.ord, profit: conf.profit, achievementRate: conf.rate, tier: conf.tier },
      update: { revenue: conf.rev, orders: conf.ord, profit: conf.profit, achievementRate: conf.rate, tier: conf.tier },
    });
    const [s, a, b, c, d] = poolByTier[conf.tier];
    await prisma.gradePool.upsert({
      where: { cycleId_groupId: { cycleId: cycle.id, groupId: g.id } },
      create: { cycleId: cycle.id, groupId: g.id, tier: conf.tier, sRatio: s, aRatio: a, bRatio: b, cRatio: c, dRatio: d },
      update: { tier: conf.tier, sRatio: s, aRatio: a, bRatio: b, cRatio: c, dRatio: d },
    });
  }
  console.log('📊 월별실적(2부서×6개월×2카테고리) + 그룹실적·등급풀(5그룹) 생성');

  // ── 8. 역량 문항 + 응답 (참고용 백데이터) ──
  const COMP_QS = [
    ['리더십', '조직의 방향성을 제시하고 구성원의 몰입을 이끌어냅니까?'],
    ['리더십', '어려운 의사결정 상황에서 합리적 판단을 내립니까?'],
    ['협업', '타 부서와의 협업에서 적극적으로 기여합니까?'],
    ['협업', '동료의 업무를 지원하고 지식을 공유합니까?'],
    ['전문성', '담당 직무에 필요한 전문 지식을 충분히 보유하고 있습니까?'],
    ['전문성', '업무 품질과 정확도가 일관되게 높습니까?'],
    ['전문성', '복잡한 문제를 구조화하여 해결합니까?'],
    ['혁신', '기존 방식을 개선하려는 시도를 지속합니까?'],
    ['혁신', 'AI 등 새로운 도구를 업무에 적극 활용합니까?'],
    ['혁신', '변화에 유연하게 적응하고 학습합니까?'],
  ] as const;
  const OPTIONS = ['전혀 그렇지 않다', '그렇지 않은 편이다', '보통이다', '그런 편이다', '매우 그렇다'];
  // 카테고리 레지스트리(글로벌) upsert 후 name→id 매핑.
  const compCatNames = ['리더십', '협업', '전문성', '혁신'] as const;
  const compCatId: Record<string, string> = {};
  for (let i = 0; i < compCatNames.length; i++) {
    const c = await prisma.competencyCategory.upsert({
      where: { name: compCatNames[i] },
      create: { name: compCatNames[i], order: i },
      update: { order: i },
    });
    compCatId[compCatNames[i]] = c.id;
  }
  const qs: CompetencyQuestion[] = [];
  for (let i = 0; i < COMP_QS.length; i++) {
    qs.push(await prisma.competencyQuestion.create({ data: {
      cycleId: cycle.id, order: i + 1, categoryId: compCatId[COMP_QS[i][0]], text: COMP_QS[i][1],
      hint: '최근 6개월의 행동 사례를 기준으로 선택하세요.', options: OPTIONS, weight: 10,
      targetGroup: 'all', isActive: true, createdById: lead.id,
    }}));
  }
  const compGrades: Grade[] = [Grade.A, Grade.B, Grade.S, Grade.A, Grade.A, Grade.B, Grade.A, Grade.S, Grade.A, Grade.B];
  for (const [u, offset] of [[lead, 0], [m1, 1]] as const) {
    for (let i = 0; i < qs.length; i++) {
      await prisma.competencyResponse.create({ data: {
        questionId: qs[i].id, userId: u.id, cycleId: cycle.id,
        grade: compGrades[(i + offset) % compGrades.length],
        comment: i === 0 ? '분기별 팀 목표 리뷰를 주도했습니다.' : null,
        submittedAt: new Date('2026-06-05T10:00:00Z'),
      }});
    }
  }
  console.log('🧭 역량 문항 10개 + 응답 20건 생성');

  // ── 9. 일정(단계별) ──
  const SCHEDULES: [string, string, string, boolean][] = [
    ['kpi_selection', '2026-03-01', '2026-04-15', true],
    ['execution_h1', '2026-04-16', '2026-06-15', false],
    ['mid_review', '2026-06-01', '2026-06-30', false],
    ['execution_h2', '2026-07-01', '2026-11-30', false],
    ['final_review', '2026-12-01', '2026-12-31', false],
  ];
  for (const [phase, start, due, locked] of SCHEDULES) {
    await prisma.cycleSchedule.upsert({
      where: { cycleId_phase: { cycleId: cycle.id, phase } },
      create: { cycleId: cycle.id, phase, startDate: new Date(`${start}T00:00:00Z`), dueDate: new Date(`${due}T23:59:59Z`), notifyOffsets: [7, 3, 1], notifyEnabled: true, isLocked: locked },
      update: { startDate: new Date(`${start}T00:00:00Z`), dueDate: new Date(`${due}T23:59:59Z`), isLocked: locked },
    });
  }

  // ── 10. 알림 + 감사 로그 ──
  const NOTIFS: [string, Record<string, unknown> | null, boolean][] = [
    ['deadline_d7', { phase: 'mid_review', cycleId: cycle.id, cycleName: cycle.name }, true],
    ['deadline_d3', { phase: 'mid_review', cycleId: cycle.id, cycleName: cycle.name }, false],
    ['result_finalized', { cycleId: cycle.id, cycleName: cycle.name }, false],
    ['appeal_answered', { appealUserName: T.m2.name }, false],
    ['kpi_rejected', { kpiTitle: KPI_DEFS[2].title, reason: '목표 수준 재협의 필요' }, true],
  ];
  for (const [type, payload, read] of NOTIFS) {
    await prisma.notification.create({ data: { userId: lead.id, type, payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined, readAt: read ? new Date('2026-06-11T09:00:00Z') : null } });
  }
  await prisma.notification.create({ data: { userId: m1.id, type: 'deadline_d3', payload: { phase: 'mid_review', cycleId: cycle.id } } });

  const AUDITS: [string, string, string][] = [
    ['kpi', kM2[0].id, 'submit'],
    ['evaluation', selfLead.ev.id, 'submit'],
    ['midterm_review', lead.id, 'self_submit'],
    ['cycle', cycle.id, 'transition'],
    ['rebaseline_request', m1.id, 'create'],
  ];
  for (const [entity, entityId, action] of AUDITS) {
    await prisma.auditLog.create({ data: { entity, entityId, action, userId: lead.id, before: undefined, after: { note: '테스트 데이터 시드' }, ip: '127.0.0.1' } });
  }
  console.log('🔔 알림 6건 + 일정 5단계 + 감사로그 5건 생성');

  console.log('\n✅ 테스트 데이터 시드 완료');
  console.log('───────────────────────────────────────');
  console.log('로그인: test@energyx.co.kr / 1234  (김테스트 · 전체관리자 · 테스트팀장)');
  console.log('팀원: test1(박테스트·결과B·이의제기), test2(이테스트·S·평가진행중), test3(최테스트·미시작)');
  console.log(`사이클: ${cycle.name} → mid_review(중간점검) 단계`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
