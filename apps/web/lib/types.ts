// 계약 응답 타입 — _workspace/02_contract/contract.md (v2 도메인 대정정) 와 1:1 (camelCase).
// 추측 캐스팅 금지: 계약에 명시된 필드만 정의한다.
// v2 정정: 역량(Dimension/EvaluationItem)·다면(peer/upward) 제거. KPI 분류(category/group/measureType) 추가.

export type Role = 'hr_admin' | 'division_head' | 'team_lead' | 'employee';
export type Position =
  | 'ceo'
  | 'division_head'
  | 'team_lead'
  | 'chief'
  | 'senior'
  | 'pro';

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

export interface GradePool {
  id: string;
  cycleId: string;
  groupId: string;
  tier: GroupTier;
  sRatio: number;
  aRatio: number;
  bRatio: number;
  cRatio: number;
  dRatio: number;
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
  createdAt: string;
}

export interface CompensationMeta extends Meta {
  companyAvgRaise: number;
  exceedsTarget: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  payload: unknown;
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
}
