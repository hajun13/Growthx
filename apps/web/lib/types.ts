// 계약 응답 타입 — _workspace/02_contract/contract.md (v2 도메인 대정정) 와 1:1 (camelCase).
// 추측 캐스팅 금지: 계약에 명시된 필드만 정의한다.
// v2 정정: 역량(Dimension/EvaluationItem)·다면(peer/upward) 제거. KPI 분류(category/group/measureType) 추가.

export type Role = 'hr_admin' | 'division_head' | 'team_lead' | 'employee';
// M3 Items1-3: Position 10값 확장(+vice_president·executive·director·principal).
export type Position =
  | 'ceo'
  | 'vice_president'
  | 'executive'
  | 'director'
  | 'principal'
  | 'division_head'
  | 'team_lead'
  | 'chief'
  | 'senior'
  | 'pro';

// M3 Items1-3: RBAC 가시 범위(visibilityScope).
export type VisibilityScope = 'self' | 'team' | 'division' | 'group' | 'company';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

// KPI 분류 (contract §7) — 역량 차원(Dimension) 폐기.
export type KpiGroup = 'performance_core' | 'collaboration_growth';
export type KpiCategory =
  | 'revenue'
  | 'construction'
  | 'orders'
  | 'collaboration'
  | 'development';
export type MeasureType = 'amount' | 'rate' | 'count' | 'qualitative';

// 평가 유형 — peer/upward 없음. downward 는 round(1=팀장·2=본부장).
export type EvalType = 'self' | 'downward';
export type EvalStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'finalized';
export type KpiStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'confirmed'
  | 'rejected'
  | 'revision_requested';

export type CycleStatus =
  | 'draft'
  | 'active'
  | 'mid_review'
  | 'calibration'
  | 'closed';

// 조직 4단계 — group(최상위) → division → team
export type DepartmentType = 'group' | 'division' | 'team';

export type GroupTier = 'excellent' | 'standard' | 'poor';
// PoolTier 는 design 의 별칭 — 동일 enum.
export type PoolTier = GroupTier;

export type AppealStatus =
  | 'submitted'
  | 'under_review'
  | 'answered'
  | 'closed';

export type NotificationKind = 'd7' | 'd1' | 'd3';

// jobLevel (KPI 양식 선택용) — contract §7
export type JobLevel =
  | 'division_head'
  | 'team_lead'
  | 'senior_plus'
  | 'senior_minus';

// ── 응답 봉투 ───────────────────────────────────────────────
export interface Meta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiEnvelope<T> {
  data: T;
}
export interface ApiListEnvelope<T> {
  data: T[];
  meta: Meta;
}
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

// ── 엔티티 (contract 객체 명세) ──────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  position: Position;
  departmentId: string;
  managerId: string | null;
  jobLevel: JobLevel;
  // M3 Items1-3: 공유 User DTO 추가 필드(login/me/change-password 응답 공통).
  mustChangePassword: boolean;
  visibilityScope: VisibilityScope;
  isActive: boolean;
  // 타 스트림(Item 8) — hr_admin 미입력 시 null.
  currentSalary?: number | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
  parentId: string | null;
  children?: Department[];
}

export interface EvaluationCycle {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  ruleSetId: string | null;
  createdAt: string;
}

// ── RuleSet (측정방식별 등급) ────────────────────────────────
export interface GradeScaleEntry {
  grade: Grade;
  min: number;
  max: number;
}
// 달성률(%) → 등급 (amount/rate). maxRate=null 은 상한 없음.
export interface GradingScaleEntry {
  grade: Grade;
  minRate: number;
  maxRate: number | null;
}
export interface PoolRatio {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
}
export interface RuleSet {
  id: string;
  cycleId: string;
  gradeScale: GradeScaleEntry[];
  // 측정방식별 달성률→등급. count 는 KPI 별 grading, qualitative 는 직접 부여.
  gradingScales: {
    amount: GradingScaleEntry[];
    rate: GradingScaleEntry[];
  };
  poolRatios: {
    excellent: PoolRatio;
    standard: PoolRatio;
    poor: PoolRatio;
  };
  raiseRates: { S: number; A: number; B: number; C: number; D: number };
  weightPolicy: { totalMustEqual: number; qualitativeMaxPercent: number };
}

// count 측정방식 등급 임계값 (Kpi.grading)
export interface CountGradingEntry {
  grade: Grade;
  minCount: number;
  maxCount: number | null;
}

export interface KpiTemplateItem {
  id: string;
  templateId: string;
  category: KpiCategory;
  group: KpiGroup;
  sampleStrategy: string | null;
  defaultMeasureType: MeasureType;
  defaultWeight: number;
  isQualitative: boolean;
}
export interface KpiTemplate {
  id: string;
  cycleId: string;
  jobLevel: JobLevel;
  items: KpiTemplateItem[];
}

export interface Kpi {
  id: string;
  userId: string;
  cycleId: string;
  category: KpiCategory;
  group: KpiGroup;
  // 백엔드 schema/DTO에서 nullable(미작성 가능) — non-null 가정 금지(QA B-2).
  coreStrategy: string | null;
  csf: string | null;
  title: string;
  measureMethod: string | null;
  measureType: MeasureType;
  targetValue: number | null;
  weight: number;
  isQualitative: boolean;
  // count 임계값 (nullable — amount/rate 는 불필요).
  grading: CountGradingEntry[] | null;
  parentKpiId: string | null;
  status: KpiStatus;
  rejectReason: string | null;
  createdAt: string;
}

export interface Achievement {
  id: string;
  kpiId: string;
  quarter: number;
  actualValue: number;
  achievementRate: number;
  evidenceUrl: string | null;
  createdAt: string;
}

// 과제별 성과 점수 — 등급·점수는 백엔드 산정.
export interface KpiScore {
  id: string;
  evaluationId: string;
  kpiId: string;
  achievementRate: number;
  grade: Grade;
  score: number;
  weight: number;
}

export interface Comment {
  id: string;
  evaluationId: string;
  authorId: string;
  quarter: number;
  content: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  cycleId: string;
  evaluatorId: string;
  evaluateeId: string;
  type: EvalType;
  round: number | null;
  status: EvalStatus;
  totalScore: number | null;
  finalGrade: Grade | null;
  // B-3a: 평가자 수동 종합등급 오버라이드(+사유). 미설정 시 null.
  overallGrade: Grade | null;
  overallReason: string | null;
  // B-3c: 피평가자 비정규화(없으면 null).
  userName: string | null;
  departmentName: string | null;
  createdAt: string;
}

// 상세: kpiScores[] + comments[] 포함 (역량 items 없음).
export interface EvaluationDetail extends Evaluation {
  kpiScores: KpiScore[];
  comments: Comment[];
}

// 유형별 비교 뷰 — self / downward1(팀장) / downward2(본부장).
export interface ByTypeEntry {
  score: number | null;
  grade: Grade | null;
  comment: string | null;
}
export interface EvaluationByType {
  self: ByTypeEntry;
  downward1: ByTypeEntry;
  downward2: ByTypeEntry;
}

// B-3d: 그룹(성과중심/협업·성장)별 점수·등급.
export interface ByGroupEntry {
  score: number | null;
  grade: Grade | null;
}
export interface EvaluationByGroup {
  performance_core: ByGroupEntry;
  collaboration_growth: ByGroupEntry;
}

export interface EvaluationResult {
  id: string;
  userId: string;
  cycleId: string;
  // 미집계(finalized 평가 없음) 사용자는 백엔드가 null upsert — nullable 정합(QA B-1).
  finalGrade: Grade | null;
  finalScore: number | null;
  percentile: number | null;
  companyAvg: number | null;
  byType: EvaluationByType | null;
  // B-3d: group별 점수·등급(미집계 시 null).
  byGroup: EvaluationByGroup | null;
  // B-3c: 비정규화(없으면 null).
  userName: string | null;
  departmentName: string | null;
}

// results/:userId 상세 — 계약은 EvaluationResultDetail로 명시(유형별 비교/percentile).
// 계약이 EvaluationResult 와 동일 shape를 detail로 반환하므로 별칭으로 둔다.
export type EvaluationResultDetail = EvaluationResult;

// ── M2 엔티티 ────────────────────────────────────────────────
export interface GroupPerformance {
  id: string;
  groupId: string;
  cycleId: string;
  revenue: number | null;
  orders: number | null;
  profit: number | null;
  achievementRate: number;
  tier: GroupTier;
  createdAt: string;
}

// B-3b: 응답에 groupName·headcount(그룹 정원)·caps(등급별 절대 상한) 동봉.
export interface GradePool {
  id: string;
  cycleId: string;
  groupId: string;
  groupName: string | null;
  tier: GroupTier;
  sRatio: number;
  aRatio: number;
  bRatio: number;
  cRatio: number;
  dRatio: number;
  headcount: number;
  caps: Record<Grade, number>;
}

export interface Appeal {
  id: string;
  resultId: string;
  userId: string;
  reason: string;
  status: AppealStatus;
  response: string | null;
  respondedById: string | null;
  decision: string | null;
  decidedById: string | null;
  // B-3c: 비정규화(없으면 null).
  userName: string | null;
  departmentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Compensation {
  id: string;
  userId: string;
  cycleId: string;
  finalGrade: Grade | null;
  raiseRate: number;
  simulated: boolean;
  // B-3c: 비정규화(없으면 null).
  userName: string | null;
  departmentName: string | null;
  createdAt: string;
}

export interface CompensationMeta extends Meta {
  companyAvgRaise: number;
  exceedsTarget: boolean;
}

// 계약 M2-C2: Notification.type 값(string). generic 은 그 외 트리거.
export type NotificationType =
  | 'deadline_d7'
  | 'deadline_d3'
  | 'deadline_d1'
  | 'kpi_rejected'
  | 'result_finalized'
  | 'appeal_answered'
  | 'appeal_decided';

// payload 는 { message?, cycleId?, ... } JSON 또는 null.
export interface NotificationPayload {
  message?: string;
  cycleId?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  userId: string;
  type: string; // NotificationType 또는 기타 트리거 문자열
  payload: NotificationPayload | null;
  readAt: string | null;
  createdAt: string;
}

// ── 요청 페이로드 ────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateKpiRequest {
  cycleId: string;
  category: KpiCategory;
  group: KpiGroup;
  title: string;
  coreStrategy?: string;
  csf?: string;
  measureMethod?: string;
  measureType: MeasureType;
  targetValue?: number;
  weight: number;
  isQualitative: boolean;
  grading?: CountGradingEntry[];
  parentKpiId?: string | null;
}

export type UpdateKpiRequest = Partial<CreateKpiRequest>;

// 부서장 평가 PATCH — 측정방식별 raw(달성률/건수) 또는 정성 직접 등급.
export interface KpiScoreInput {
  kpiId: string;
  achievementRate?: number;
  directGrade?: Grade;
  weight: number;
}
export interface PatchEvaluationRequest {
  kpiScores?: KpiScoreInput[];
  // B-3a: 종합등급 오버라이드. overallGrade 설정 시 overallReason 필수(미입력 422).
  overallGrade?: Grade;
  overallReason?: string;
}

// ── M2 델타 타입 (계약 끝 "M2 델타" 절과 1:1) ────────────────────

// M2-B1: KPI 양식 항목 입력(PATCH 시 items 전체 교체).
export interface KpiTemplateItemInput {
  category: KpiCategory;
  group: KpiGroup;
  sampleStrategy?: string;
  defaultMeasureType: MeasureType;
  defaultWeight: number;
  isQualitative: boolean;
}

// M2-B2: 주기 단계별 일정·대상자·알림 설정.
export interface CycleSchedule {
  id: string;
  cycleId: string;
  phase: string; // prep|self|downward1|downward2|result 등
  dueDate: string; // ISO 8601
  notifyOffsets: number[]; // [7,3,1] = D-7/D-3/D-1
  notifyEnabled: boolean;
  targetUserIds: string[];
  targetDeptIds: string[];
  // M3 Item 5: 평가 기간 잠금. 백엔드 미배포 시 undefined 가능 → ?? false 폴백.
  isLocked?: boolean;
  // M3 Item 5: 단계 시작일(있으면). 잠금/열기 기간 표시용.
  startDate?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ScheduleItemInput {
  phase: string;
  dueDate: string;
  startDate?: string | null;
  notifyOffsets?: number[];
  notifyEnabled?: boolean;
  isLocked?: boolean;
  targetUserIds?: string[];
  targetDeptIds?: string[];
}

// M2-C1: 엑셀 임포트 응답(익스포트는 봉투 없는 바이너리 스트림 — blob 처리).
export interface ImportRowError {
  row: number;
  message: string;
}
export interface ImportResult {
  validCount: number;
  errorCount: number;
  imported: number;
  ok: boolean;
  errors: ImportRowError[];
}

// M2-C3: HR 대시보드 위젯 집계.
export interface DashboardPhase {
  total: number;
  submitted: number;
  finalized: number;
  rate: number; // 제출률(%)
}
export interface DashboardGroupGrades {
  groupId: string;
  groupName: string;
  grades: Record<Grade, number>;
}
// 기본(M2) 위젯. M3 확장은 DashboardM3Extension 으로 합류(아래 DashboardSummary).
export interface DashboardSummaryBase {
  cycleId: string | null;
  cycleName?: string;
  cycleStatus?: CycleStatus;
  progress: {
    self: DashboardPhase;
    downward1: DashboardPhase;
    downward2: DashboardPhase;
  };
  gradeDistribution: {
    company: Record<Grade, number>;
    byGroup: DashboardGroupGrades[];
  };
  unsubmittedCount: number;
  appeals: {
    submitted: number;
    under_review: number;
    answered: number;
    closed: number;
    total: number;
  };
  avgRaiseRate: number | null;
}

// M2-C4: 감사 로그. action/entity 는 계약의 raw 문자열(rule_set.update 등).
export interface AuditLog {
  id: string;
  entity: string; // RuleSet | EvaluationCycle | Kpi | Evaluation | GradePool | Appeal
  entityId: string;
  action: string; // rule_set.update | cycle.schedule.update | kpi.approve | ...
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  ip: string | null;
  at: string; // ISO 8601
}

// ── M3 엔티티 (requirements-m3.md Items 4-10) ──────────────────
// 백엔드 M3 API 구현 중 — 타입/훅은 requirements-m3.md 명세를 선반영한다.
// 계약 M3 델타가 확정되면 필드명/봉투를 재대조한다(추측 캐스팅 금지).

// Item 4: 월별 실적 입력 — GroupPerformance(연 집계)와 구분되는 월별 세부.
export interface MonthlyPerformance {
  id: string;
  cycleId: string;
  departmentId: string; // group | division
  year: number;
  month: number; // 1-12
  targetAmount: number;
  actualAmount: number;
  category: KpiCategory;
  enteredById: string | null;
  createdAt: string;
  updatedAt: string;
}
// 누적 달성률 + 현재 등급 요약(달성률→등급은 백엔드 산정).
// 백엔드 확정 shape(contract M3 백엔드 절): year 없음, totalTarget/totalActual → targetAmount/actualAmount.
export interface MonthlyPerformanceSummaryCategory {
  category: KpiCategory;
  targetAmount: number;
  actualAmount: number;
  achievementRate: number;
  currentGrade: Grade | null;
}
export interface MonthlyPerformanceSummary {
  cycleId: string;
  departmentId: string;
  departmentName: string | null;
  targetAmount: number; // 누적 합.
  actualAmount: number; // 누적 합.
  achievementRate: number;
  currentGrade: Grade | null; // 실적 미입력 시 null.
  byCategory: MonthlyPerformanceSummaryCategory[];
  monthlyTrend: MonthlyTrendPoint[];
}
export interface MonthlyPerformanceInput {
  cycleId: string;
  departmentId: string;
  year: number;
  month: number;
  targetAmount: number;
  actualAmount: number;
  category: KpiCategory;
}

// Item 5: 평가 기간 잠금/열기 — CycleSchedule 에 isLocked 추가.
// (M2 CycleSchedule 타입에 isLocked 를 합류시킨다 — 아래 별도 확장 인터페이스.)
// 백엔드 확정 shape: daysRemaining 없음(프론트가 dueDate-now로 산출), phase nullable, cycleId/schedules 추가.
export interface CurrentPhaseScheduleItem {
  phase: string;
  dueDate: string | null;
  isLocked: boolean;
}
export interface CurrentPhase {
  cycleId: string;
  phase: string | null; // 활성 단계 없으면 null(배너 미표시).
  dueDate: string | null;
  isLocked: boolean;
  schedules: CurrentPhaseScheduleItem[];
}

// Item 6: 역량 평가 문항 관리 — 연봉 미반영(참고 데이터).
export interface CompetencyQuestion {
  id: string;
  cycleId: string;
  order: number;
  text: string;
  hint: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CompetencyQuestionInput {
  cycleId: string;
  order: number;
  text: string;
  hint?: string;
  isActive?: boolean;
}
export type CompetencyQuestionPatch = Partial<
  Omit<CompetencyQuestionInput, 'cycleId'>
>;

export interface CompetencyResponse {
  id: string;
  questionId: string;
  userId: string;
  cycleId: string;
  grade: Grade;
  comment: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
// 일괄 제출 입력 1건.
export interface CompetencyResponseInput {
  questionId: string;
  grade: Grade;
  comment?: string;
}

// Item 7: 대시보드 고도화 — 그룹 등급 카드·팀 목표·월별 트렌드.
export interface GroupGrade {
  groupId: string;
  groupName: string;
  currentGrade: Grade | null;
  achievementRate: number;
  targetAmount: number;
  actualAmount: number;
}
export interface TeamGoal {
  targetAmount: number;
  actualAmount: number;
  achievementRate: number;
  currentGrade: Grade | null;
}
export interface MonthlyTrendPoint {
  month: number; // 1-12
  achievementRate: number;
  grade: Grade | null;
}
// 대시보드 응답에 합류되는 M3 확장 필드(모두 optional — 백엔드 단계적 추가).
export interface DashboardM3Extension {
  groupGrades?: GroupGrade[];
  teamGoal?: TeamGoal | null;
  monthlyTrend?: MonthlyTrendPoint[];
}
// M2 기본 위젯 + M3 확장(옵셔널). 기존 useDashboard 소비처는 base 필드만 사용.
export type DashboardSummary = DashboardSummaryBase & DashboardM3Extension;

// 등급별 비교 1행(S면 얼마 / A면 얼마).
export interface CompensationGradeRow {
  grade: Grade;
  raiseRate: number;
  projectedSalary: number | null;
}
// Item 8: 연봉 시뮬레이션 — 현재 연봉→등급→인상률→예상 연봉.
// 백엔드 확정 shape: cycleId·byGrade[] 추가, raiseRate nullable.
export interface CompensationSimulation {
  userId: string;
  userName: string | null;
  departmentName: string | null;
  cycleId: string;
  currentSalary: number | null; // hr_admin 미입력 시 null.
  currentGrade: Grade | null;
  raiseRate: number | null;
  projectedSalary: number | null; // currentSalary 없으면 null.
  byGrade: CompensationGradeRow[]; // 등급별 비교 슬라이더(백엔드 산정).
}

// Item 10: 매출액 KPI 구조 — 본인 소속 그룹의 목표/실적(읽기 전용).
export interface MyGroupPerformance {
  groupId: string;
  groupName: string | null;
  cycleId: string;
  targetAmount: number;
  actualAmount: number;
  achievementRate: number;
  currentGrade: Grade | null;
}

// ── M3 Items1-3 + 조직도 (계약 "M3 델타 (Items 1-3 + 조직도)" 절과 1:1) ──

export type OrgNodeType = 'group' | 'division' | 'team';

// GET /org-chart 응답 data = 가상 회사 루트 노드(id:'company') + children.
// directCount=직속 활성 인원, totalCount=하위 포함.
export interface OrgChartNode {
  id: string;
  name: string;
  type: OrgNodeType;
  parentId: string | null;
  directCount: number;
  totalCount: number;
  children: OrgChartNode[];
}

// GET /users 항목(조직도 인물 그리드). 계약 Item2 + 디자인 스펙 OrgPerson.
// 주의: /users 는 표준 User[] 를 반환하므로(계약 §3·Item2), 조직도 인물 카드는
// User + departments 트리로 deptPath·override 여부를 프론트에서 합성한다.
export interface OrgPerson {
  id: string;
  name: string;
  position: Position;
  email: string;
  phone: string | null;
  deptId: string;
  deptPath: string[]; // ["이노베이션그룹","DX본부","DX1팀"] — 본부/팀 없으면 짧음
  role: Role;
  visibilityScope: VisibilityScope;
  roleIsOverride: boolean; // 자동기본과 다른지(true면 "수동" 배지)
  scopeIsOverride: boolean;
  active: boolean;
  avatarUrl: string | null;
}

// Item3: 직급×카테고리 허용 매트릭스 1행.
export interface KpiCategoryPolicyEntry {
  position: Position;
  label: string; // 한글 라벨(백엔드 동봉)
  allowed: KpiCategory[];
}

// GET /kpi-category-policy/allowed 응답.
export interface KpiCategoryAllowed {
  position: Position;
  label: string;
  allowed: KpiCategory[];
}

// PATCH /kpi-category-policy 요청 1행.
export interface KpiCategoryPolicyInput {
  position: Position;
  allowed: KpiCategory[];
}

// 사용자 생성/수정 요청(hr_admin) — 계약 Item2.
export interface CreateUserRequest {
  email: string;
  name: string;
  position: Position;
  password?: string;
  role?: Role;
  departmentId?: string;
  managerId?: string | null;
  jobLevel?: JobLevel;
  visibilityScope?: VisibilityScope;
}
export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  position?: Position;
  departmentId?: string;
  managerId?: string | null;
  jobLevel?: JobLevel;
  visibilityScope?: VisibilityScope;
  isActive?: boolean;
}

// 비밀번호 변경 요청/응답(Item1) — 응답은 새 토큰 + 갱신된 User.
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse extends AuthTokens {
  user: User;
}
