// 계약 응답 타입 — _workspace/02_contract/contract.md (v2 도메인 대정정) 와 1:1 (camelCase).
// 추측 캐스팅 금지: 계약에 명시된 필드만 정의한다.
// v2 정정: 역량(Dimension/EvaluationItem)·다면(peer/upward) 제거. KPI 분류(category/group/measureType) 추가.

export type Role = 'hr_admin' | 'division_head' | 'team_lead' | 'employee';
// contract-positions-org C-1: 직급은 관리형 레지스트리(PositionDef)로 전환.
// Position 은 임의 코드 문자열(커스텀 직급 허용). 시스템 10코드는 SystemPosition 로 보존(색/정렬 폴백용).
export type SystemPosition =
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
export type Position = string;

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

// 평가 유형 — peer/upward 없음. downward 는 round(1·2차=가까운 상급 장 순·3=최종 그룹장).
export type EvalType = 'self' | 'downward';
export type EvalStatus =
  | 'not_started'
  | 'in_progress'
  | 'revision_requested'
  | 'rejected'
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
  // 무소속 사용자(임원·외부 인사)는 null. (contract Part A)
  departmentId: string | null;
  managerId: string | null;
  jobLevel: JobLevel;
  // M3 Items1-3: 공유 User DTO 추가 필드(login/me/change-password 응답 공통).
  mustChangePassword: boolean;
  visibilityScope: VisibilityScope;
  isActive: boolean;
  // 라이프사이클(contract-userlifecycle.md §0) — User 응답 shape 추가 필드.
  employmentStatus: EmploymentStatus; // active | on_leave | resigned
  legalEntity: LegalEntity; // 4대보험 소속 법인
  resignedAt: string | null; // ISO datetime | null
  // 평가 제외(재직 중이나 평가 대상 아님 — 하반기 입사·파견 등).
  evaluationExempt: boolean;
  evaluationExemptReason: string | null;
  hireDate: string | null; // 입사일(ISO datetime). eligibility 필터 기준.
  birthDate: string | null; // 생년월일(ISO datetime). 미입력 시 null.
  age: number | null; // 만 나이 — birthDate 로부터 백엔드 파생(저장 안 함). 미입력 시 null.
  // 타 스트림(Item 8) — hr_admin 미입력 시 null.
  currentSalary?: number | null;
  createdAt: string;
  // 프로필 사진 — 백엔드 미구현(업로드 API 없음, 항상 undefined). 여러 화면이 이니셜 폴백
  // 전제로 옵셔널 체이닝해 참조하므로 타입만 선언해 둠. 실제 사진 노출은 백엔드 필드/업로드 추가 후.
  avatarUrl?: string | null;
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

export type CycleType = 'MIDTERM' | 'FINAL';

export interface EvaluationCycle {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  cycleType: CycleType | null;
  ruleSetId: string | null;
  hireCutoffDate?: string | null; // 입사일 기준 평가 제외 컷오프 날짜(ISO). 이후 입사자 제외. null=제한 없음.
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
  weightPolicy: RuleSetWeightPolicy;
}

// weightPolicy(JSON) — 기존 2필드 + 갭 #1·#2·#3 신규 5필드(모두 optional, 미설정 시 백엔드 2026 폴백).
// camelCase·계약(contract-ruleset-gaps.md) 1:1.
export interface RuleSetWeightPolicy {
  totalMustEqual: number;
  qualitativeMaxPercent: number;
  // 그룹실적 보너스(기존 비공식 확장) — 우수/보통/미흡 인상률 가산.
  groupTierBonus?: { excellent: number; standard: number; poor: number };
  // 갭 #1 — 그룹 실적 달성률(%) tier 경계. excellent 이상→우수, standard 이상→보통, 미만→미흡.
  groupTierThresholds?: { excellent: number; standard: number };
  // 갭 #2 — 매출 절대금액(원) → 등급. minAmount 이상이면 해당 등급(내림차순 매칭). S~D 5행.
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
  // 갭 #3 — KPI 그룹 가중치(합 100). 성과중심/협업·성장.
  kpiGroupWeights?: { performance_core: number; collaboration_growth: number };
  // 갭 #3 — 제출 시 강제 플래그(기본 false: 서술형 전환으로 비활성).
  enforceQualitativeCap?: boolean;
  enforceGroupRatio?: boolean;
  // 다단계 평가 단계 가중치(1차 팀장·2차 본부장·최종 대표). evaluatorWeights 와 동일 키.
  stageWeights?: { teamLeader: number; divisionHead: number; ceo: number };
  evaluatorWeights?: { teamLeader: number; divisionHead: number; ceo: number };
  // 최종점수 = 합산실적×perf + 합산역량×comp (기본 0.7/0.3).
  perfCompWeights?: { perf: number; comp: number };
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
  // 자유 텍스트 목표(엑셀 양식 "2026 목표" — measureMethod 와 별개의 서술 입력).
  targetText: string | null;
  measureMethod: string | null;
  measureType: MeasureType;
  targetValue: number | null;
  weight: number;
  isQualitative: boolean;
  // 갭 #2 — measureType=amount 일 때만 의미. true면 목표 대비 달성률 대신 실제 매출 절대금액으로 등급 산정.
  useAbsoluteAmount: boolean;
  // 정성 등급 부여 기준(S~D 서술). 미작성 시 null.
  gradingCriteria: KpiGradingCriteria | null;
  // count 임계값 (nullable — amount/rate 는 불필요).
  grading: CountGradingEntry[] | null;
  parentKpiId: string | null;
  status: KpiStatus;
  rejectReason: string | null;
  // 순차 결재선(2026-07-07) — 완료된 결재 단계 수(submitted+0=1차 대기, approved+n=다음 단계 대기, confirmed=완료).
  approvalStage: number;
  // 결재 이력. 반려/재제출 시 리셋(백엔드).
  approvalTrail: KpiApprovalTrailEntry[] | null;
  createdAt: string;
}

/** KPI 결재 이력 1건. */
export interface KpiApprovalTrailEntry {
  stage: number;
  approverId: string;
  approverName: string;
  at: string;
}

/** KPI 순차 결재선 1개 단계 (GET /kpis/approval-chain/:userId). */
export interface KpiApprovalStage {
  stage: number; // 1부터(1차·2차·최종)
  userId: string;
  name: string;
  position: string | null;
}

// KPI 검토 의견 — 승인(strength)·반려/수정요청(improvement) 시 검토자가 남긴 코멘트.
export interface KpiReview {
  id: string;
  kpiId: string;
  kind: 'strength' | 'improvement';
  content: string;
  authorId: string;
  authorName: string;
  authorPosition: string | null;
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
  // 정성 KPI 에서 평가자가 등급을 아직 선택하지 않은 항목은 백엔드가 null(미평가)로 저장한다.
  grade: Grade | null;
  score: number;
  weight: number;
  // 갭 #2 — 절대금액 모드(useAbsoluteAmount) KPI의 실제 매출 금액(원). 그 외는 null.
  actualAmount: number | null;
  // 정성 KPI 서술 메모(self). amount/rate/count 는 null.
  selfNote: string | null;
  // 부서장(검토자) 문항별 평가 코멘트. 미작성 시 null.
  reviewerNote: string | null;
}

export interface Comment {
  id: string;
  evaluationId: string;
  authorId: string;
  quarter: number;
  content: string;
  createdAt: string;
}

// 문항별 증빙 첨부 메타데이터(바이트 제외). 본인평가 KPI 문항 단위.
export interface EvaluationEvidence {
  id: string;
  evaluationId: string;
  kpiId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string;
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
  // 예상등급(totalScore→등급 파생, 백엔드 산정 — 저장 안 함). 점수 미집계 시 null.
  estimatedGrade?: Grade | null;
}

// 평가 검토 이력(수정요청/반려/승인) — GET /evaluations/:id/history 응답 항목.
export type EvaluationReviewKind = 'revision_requested' | 'rejected' | 'approved';
export interface EvaluationReviewHistory {
  id: string;
  evaluationId: string;
  kind: EvaluationReviewKind;
  reason: string | null;
  actorId: string;
  actorName: string | null;
  createdAt: string; // ISO 8601, desc 정렬
}

// 유형별 비교 뷰 — self / downward1(팀장) / downward2(본부장).
export interface ByTypeEntry {
  score: number | null;
  grade: Grade | null;
  comment: string | null;
}

// 임포트 결과(2025 등 과거 사이클)의 라운드 원형 — 실적(perf)·역량(comp) 점수만.
// 라이브 평가자 키(self/downward1/downward2)는 존재하지 않는다.
export interface ImportRoundShape {
  perf: number | null;
  comp: number | null;
}

// byType 은 두 shape의 유니온이다(백엔드가 source 로 판별자 보장):
//  - live   : { source:'live',  self, downward1, downward2 [, downward3] }
//  - import : { source:'import', round1, round2, final }  (라이브 평가자 키 없음)
// 단정 캐스트 없이 안전하게 다루기 위해 모든 키를 optional 로 두고 source 로 분기한다.
// 다단계 실적 합산 적용 방식(예외 상황 감지 결과).
//  - normal     : 정상 3단계 가중(1차 50·2차 30·최종 20, 없는 단계는 재정규화)
//  - exception1  : 1차 평가자 = 최종평가자 → 1차 100%
//  - exception2  : 2차 평가자 = 최종평가자 → 1차 70% + 최종 30%
export type StageMode = 'normal' | 'exception1' | 'exception2';

export interface EvaluationByType {
  source?: 'live' | 'import' | string;
  // live 키 (import 결과에는 부재). downward1=1차 팀장·2=2차 본부장·3=최종 대표.
  self?: ByTypeEntry;
  downward1?: ByTypeEntry;
  downward2?: ByTypeEntry;
  downward3?: ByTypeEntry;
  // 역량 환산 점수(단일) — 등급 미반영·참고용 표시만.
  compScore?: number | null;
  // 예외 반영된 실적 합산(최종점수의 실적 기준값). 평가자정리 표 합산열과 일치.
  perfSum?: number | null;
  // 실적 합산 적용 방식(정상/예외①/예외②).
  stageMode?: StageMode;
  // import 키 (live 결과에는 부재). 각 라운드는 미집계 시 null.
  round1?: ImportRoundShape | null;
  round2?: ImportRoundShape | null;
  final?: ImportRoundShape | null;
}

// import shape 판별 — source==='import' 또는 라이브 평가자 키 부재.
export function isImportByType(bt: EvaluationByType | null | undefined): boolean {
  if (!bt) return false;
  if (bt.source === 'import') return true;
  if (bt.source === 'live') return false;
  // source 누락 시: 라이브 평가자 키가 하나도 없으면 import 로 간주.
  return bt.self === undefined && bt.downward1 === undefined && bt.downward2 === undefined;
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

// 결과 리스트 행의 평가 상태 — 백엔드 파생 (3B-1 Task4).
// not_started: 부서장 평가 없음, in_progress: 진행 중, finalized: 모두 확정.
export type EvaluationResultStatus = 'not_started' | 'in_progress' | 'finalized';

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
  // 3B-1 추가: 직급 코드(백엔드 user.position 조인). 표시는 getPositionLabel 사용.
  position?: string | null;
  // 3B-1 추가: 평가 상태 파생값. 백엔드가 downward 평가 현황으로 산정.
  status?: EvaluationResultStatus;
}

// ── 분포 필터 응답 타입 (GET /results/distribution) — 3B-1 추가 ──────────
// byGrade: S~D 5칸 고정(count 0 포함). pct = 해당 등급 인원 비율(%).
export interface DistributionByGradeEntry {
  grade: Grade;
  count: number;
  pct: number;
}
// byDept: 부서별 등급 현황(drilldown 용).
export interface DistributionByDeptEntry {
  deptId: string;
  deptName: string;
  total: number;
  byGrade: DistributionByGradeEntry[];
}
// GET /results/distribution → { data: Distribution } 봉투.
export interface Distribution {
  total: number;
  byGrade: DistributionByGradeEntry[];
  byDept: DistributionByDeptEntry[];
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
  nextYearSalary: number | null;
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
  // 자유 텍스트 목표(엑셀 양식 "2026 목표").
  targetText?: string;
  measureMethod?: string;
  measureType: MeasureType;
  targetValue?: number;
  weight: number;
  isQualitative: boolean;
  // 갭 #2 — measureType=amount 일 때만 의미(절대금액 등급). 미전송 시 백엔드 false 폴백.
  useAbsoluteAmount?: boolean;
  // 정성 등급 부여 기준(S~D 서술).
  gradingCriteria?: KpiGradingCriteria;
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
  // 갭 #2 — useAbsoluteAmount && measureType=amount 인 KPI는 달성률 대신 실제 매출 금액(원)을 전송.
  // 백엔드는 revenueGradeScale 로 등급을 산정한다(achievementRate 대신).
  actualAmount?: number | null;
  // 정성 KPI 서술 메모(self). amount/rate/count 는 미전송.
  selfNote?: string;
  // 부서장(검토자) 문항별 평가 코멘트.
  reviewerNote?: string;
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
// self(팀원) 전용: 본인 평가 상태 + 결과 요약.
export interface DashboardMeBlock {
  selfStatus: 'not_started' | 'in_progress' | 'submitted' | 'finalized';
  selfSubmitted: boolean;
  hasResult: boolean;
  finalGrade: Grade | null;
  finalScore: number | null;
  percentile: number | null;
}
// 내가 평가자로서 할 일(팀장 1차·본부장 2차·팀원 self) 미완료 카운트.
export interface DashboardMyTasks {
  total: number;
  pending: number;
}
// 기본(M2) 위젯. M3 확장은 DashboardM3Extension 으로 합류(아래 DashboardSummary).
// M4: 4역할 게이팅 폐기 → viewer scope 로 행수준 스코프. 모든 위젯 null 아님(scope 내 집계).
export interface DashboardSummaryBase {
  cycleId: string | null;
  cycleName?: string;
  cycleStatus?: CycleStatus;
  // viewer 의 가시 범위와 표시 라벨(전사 / ○○그룹 / ○○본부 / ○○팀 / 본인).
  scope: VisibilityScope;
  scopeLabel: string;
  progress: {
    self: DashboardPhase;
    downward1: DashboardPhase;
    downward2: DashboardPhase;
  };
  myTasks: DashboardMyTasks;
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
  // self scope 일 때만 채워짐(그 외 null).
  me: DashboardMeBlock | null;
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

// Item 4: 월별 실적 입력 — 그룹 선택 시 연 집계(GroupPerformance)도 저장 시 동기화된다.
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

// Cycle Ops: current-phase.schedules 항목(startDate 추가). 계약 §5 PhaseScheduleLite.
// 기존 CurrentPhaseScheduleItem 은 startDate 없는 과거 shape — 신규는 이쪽 사용.
export interface PhaseScheduleLite {
  phase: string;
  startDate: string | null;
  dueDate: string;
  isLocked: boolean;
}
export interface CurrentPhase {
  cycleId: string;
  phase: string | null; // 활성 단계 없으면 null(배너 미표시).
  dueDate: string | null;
  isLocked: boolean;
  // Cycle Ops: schedules 가 startDate 포함하도록 확장(기존 소비자 dueDate/isLocked 호환).
  schedules: PhaseScheduleLite[];
  // Cycle Ops §3: 잠금 중 다음 열림 단계(없으면 null). 미배포 시 undefined → 안전 폴백.
  nextOpen?: { phase: string; startDate: string | null } | null;
}

// ── Cycle Ops §4·§5: 1차 확정 KPI 스냅샷 + diff ──────────────────
export interface SnapshotKpi {
  id: string;
  title: string;
  category: string;
  group: string;
  measureType: string;
  targetValue: number | null;
  weight: number;
  isQualitative: boolean;
  status: string;
}
export interface KpiSnapshotMeta {
  id: string;
  label: string;
  createdAt: string;
  kpiCount: number;
}
export interface KpiDiffField {
  field: string;
  before: unknown;
  after: unknown;
}
export interface KpiDiffItem {
  id: string;
  title: string;
  fields?: KpiDiffField[];
}
export interface KpiSnapshotDiff {
  snapshotId: string;
  label: string;
  createdAt: string;
  userId: string;
  added: KpiDiffItem[];
  removed: KpiDiffItem[];
  changed: KpiDiffItem[];
  unchangedCount: number;
}

// Item 6: 역량 평가 문항 관리 — 연봉 미반영(참고 데이터).
export interface CompetencyQuestion {
  id: string;
  cycleId: string;
  order: number;
  text: string;
  hint: string | null;
  category: string; // 리더십/협업/전문성/혁신
  weight: number; // % 가중치
  appliedLevel: string; // 팀장 이상/차장 이상/전 직급
  options: string[]; // 5지선다 보기(인덱스 0→점수1 … 인덱스 4→점수5). 빈 배열이면 기본 라벨 폴백.
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
  category?: string;
  weight?: number;
  appliedLevel?: string;
  options?: string[]; // 5지선다 보기(인덱스 0→점수1 … 인덱스 4→점수5). 빈 배열/생략 시 기본 라벨.
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
  raiseRate: number | null; // 그룹실적 보너스가 포함된 등급 기준 인상률(백엔드 산정).
  projectedSalary: number | null; // 등급 기준 예상 연봉. currentSalary 없으면 null.
  adjustmentAmount?: number | null; // 보상 조정분(원).
  finalProjectedSalary?: number | null; // 조정분 포함 최종 제안연봉.
  finalRaiseRate?: number | null; // 조정분 포함 최종 인상률.
  // 소속 그룹의 실적 tier 와 그에 따른 인상률 가산(%p). raiseRate·byGrade 에 이미 반영됨.
  groupTier: GroupTier | null;
  groupTierBonus: number;
  baseByGrade: CompensationGradeRow[]; // RuleSet.raiseRates 기준 기본 인상률(그룹 실적 보너스 미포함).
  byGrade: CompensationGradeRow[]; // 등급별 비교 슬라이더(보너스 포함, 백엔드 산정).
  // 보상 현황 화면(레퍼런스 CompSimul) 표시용 — 백엔드 확장 필드.
  position: Position | null; // 직급 enum(대상자 미존재 시 null).
  previousSalary: number | null; // 전년도 연봉(원).
  divisionName: string | null; // 본부.
  teamName: string | null; // 팀.
}

// GET /dashboard/company-achievement 응답.
export interface CompanyAchievement {
  achievementRate: number;
  totalTarget: number;
  totalActual: number;
  cycleId?: string;
  groupCount?: number;
  // 비 hr_admin 은 본인 그룹만 집계됨 — true 면 '전사'가 아니라 '본인 그룹' 범위.
  scopedToGroup?: boolean;
}

// 평가자정리 표 — 다단계(1차 팀장·2차 본부장·최종 대표) × 실적/역량 + 합산 + 최종.
export interface SummaryStage {
  perf: number | null;
  comp: number | null;
}
export interface EvaluationSummaryRow {
  no: number;
  userId: string;
  name: string | null;
  group: string | null;
  division: string | null;
  team: string | null;
  position: Position | null;
  role: Role | null;
  stage1: SummaryStage; // 1차 팀장
  stage2: SummaryStage; // 2차 본부장
  stageFinal: SummaryStage; // 최종 대표
  sum: SummaryStage; // 평가합산
  finalScore: number | null;
  finalGrade: Grade | null;
  source: 'import' | 'live';
}

// 부서별 등급 현황 1행 — GET /evaluations/grade-distribution?cycleId=&groupId=.
// 각 등급 셀은 해당 부서의 인원 수(백엔드 집계).
export interface GradeDistributionRow {
  deptId: string;
  deptName: string;
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
  total: number;
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
  // 명시적으로 지정된 부서장. null=자동 추론(role 기반).
  headUserId: string | null;
  headName: string | null;
  // 부(副)그룹장(부대표) — group 전용. 지정 시 팀장(2차)·본부장(1차)의 중간 평가자. null=없음.
  deputyHeadUserId: string | null;
  deputyHeadName: string | null;
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
  hireDate?: string | null;
  birthDate?: string | null;
}
export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  position?: Position;
  // null = 소속 해제(무소속), 문자열 = 해당 부서, undefined = 변경 없음. (contract Part A)
  departmentId?: string | null;
  managerId?: string | null;
  jobLevel?: JobLevel;
  visibilityScope?: VisibilityScope;
  isActive?: boolean;
  evaluationExempt?: boolean;
  evaluationExemptReason?: string | null;
  hireDate?: string | null;
  birthDate?: string | null;
}

// ── 직급 레지스트리 (contract-positions-org C-1) ────────────────
// GET /positions → { data: PositionDef[], meta:{ total } } (sortOrder asc).
export interface PositionDef {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isManagement: boolean;
  defaultRole: Role;
  defaultScope: VisibilityScope;
  defaultJobLevel: JobLevel | null;
  isSystem: boolean;
  isActive: boolean;
}
export interface CreatePositionRequest {
  label: string;
  isManagement: boolean;
  defaultRole: Role;
  defaultScope: VisibilityScope;
  defaultJobLevel?: JobLevel | null;
  sortOrder?: number;
  code?: string;
}
export type UpdatePositionRequest = Partial<
  Omit<CreatePositionRequest, 'code'>
> & { isActive?: boolean };

// 비밀번호 변경 요청/응답(Item1) — 응답은 새 토큰 + 갱신된 User.
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse extends AuthTokens {
  user: User;
}

// 법인(4대보험 소속). 응답은 snake_case enum 그대로 — 한글 라벨은 lib/ui 매핑.
export type LegalEntity = 'energyx' | 'mirae_plan';
// 재직 상태. 응답 snake_case 그대로.
export type EmploymentStatus = 'active' | 'on_leave' | 'resigned';

// POST /excel/import/legacy-results 응답(임포트 리포트). 화면 미사용이나 계약 1:1 유지.
export interface LegacyImportReport {
  ok: boolean;
  cycleId: string;
  total: number;
  imported: number;
  matched: number;
  createdResigned: number;
  reviewQueue: number;
  review: { row: number; name: string; reason: string }[];
  errors: { row: number; message: string }[];
  legalEntityUpdated: number;
}

// ── 개인별 KPI 엑셀 일괄 임포트 (kpi-import-contract.md §4 와 1:1) ──────
// 정성 등급기준(L~P열) — S~D 텍스트. 미작성 칸은 null.
export interface KpiGradingCriteria {
  S: string | null;
  A: string | null;
  B: string | null;
  C: string | null;
  D: string | null;
}

// §4-1 preview 응답의 rows[] 1행. (적재 시에도 동일 매핑)
export interface KpiImportRow {
  category: KpiCategory;
  group: KpiGroup;
  csf: string | null;
  title: string;
  targetText: string | null;
  measureMethod: string | null;
  weight: number | null; // 정수 % — 미기입 행은 null(서술형 양식)
  isQualitative: boolean; // 백엔드 휴리스틱 제안값 — 관리자가 토글로 override
  gradingCriteria: KpiGradingCriteria | null;
  valid: boolean;
  message: string | null;
  source?: 'parser' | 'ai'; // 행 출처 — parser(결정론적)·ai(DeepSeek 추론)
}

// POST /excel/import/kpi/commit 요청 rows[] 1행 (관리자가 편집한 결과).
export interface KpiImportCommitRow {
  category: KpiCategory;
  group: KpiGroup;
  csf?: string | null;
  title: string;
  targetText?: string | null;
  measureMethod?: string | null;
  weight: number; // 0~100 정수
  isQualitative: boolean; // 관리자 토글
  gradingCriteria?: KpiGradingCriteria | null;
}

// POST /excel/import/kpi/commit 요청 body (JSON, hr_admin).
export interface KpiImportCommitRequest {
  userId: string;
  cycleId?: string;
  fileName?: string;
  rows: KpiImportCommitRow[];
}

// POST /excel/import/kpi/submit — 적재된 draft KPI 제출.
export interface KpiImportSubmitRequest {
  userId: string;
  cycleId?: string;
}
export interface KpiImportSubmitResult {
  ok: boolean;
  userId: string;
  cycleId: string;
  submitted: number;
  weightSum: number;
}

// POST /excel/import/kpi/preview 응답 data (파일 1개 파싱 결과 — 저장 안 함).
export interface KpiImportPreview {
  fileName: string | null;
  rows: KpiImportRow[];
  validCount: number;
  errorCount: number;
  weightSum: number; // 가중치 합(%)
  errors: ImportRowError[];
}

// POST /excel/import/kpi?userId&cycleId 응답 data (draft 적재 결과).
export interface KpiImportResult {
  ok: boolean;
  userId: string;
  cycleId: string;
  fileName: string;
  imported: number;
  deletedDrafts: number;
  weightSum: number;
  errors: ImportRowError[];
  warnings: string[];
}

// ── 6월 중간평가 · 피드백 보완 조치 (contract-midterm.md 와 1:1, camelCase) ──
// 계약이 데이터 SSOT. 디자인 스펙(component-spec)의 일부 명칭(userId, MidtermSignal 'caution')과
// 다른 부분은 계약을 따른다 — signal enum 은 on_track|at_risk|off_track, 대상 식별자는 evaluateeId.

// 진척 신호: 순항 / 주의 / 위험.
export type ProgressSignal = 'on_track' | 'at_risk' | 'off_track';
// 추세: 직전 분기 대비 상승/보합/하락.
export type ProgressTrend = 'up' | 'flat' | 'down';

// 중간점검 KPI 자가점검 입력(kpiCheckIns 1건).
export interface KpiCheckIn {
  id?: string;
  kpiId: string;
  selfActualText: string | null;
  selfActualValue: number | null;
  selfNote: string | null;
  selfGrade: Grade | null;
  reviewerNote: string | null;
  reviewerGrade: Grade | null;
  // KPI별 검토 판정: 수락(accepted) | 재조정 필요(rebaseline). 참고용.
  reviewerDecision: 'accepted' | 'rebaseline' | null;
  confirmedAt: string | null;
}

// 검토자 KPI별 판정 1건 — confirm/request-revision 바디의 kpiReviews 요소.
export interface MidtermKpiReviewItem {
  kpiId: string;
  decision?: 'accepted' | 'rebaseline';
  note?: string;
}

// GET /midterm/progress — KPI 1행. 달성률·추세·신호·등급 모두 백엔드 산정값(표시만).
export interface KpiProgress {
  kpiId: string;
  // CSF(전략목표) — 미작성 시 null.
  csf: string | null;
  title: string;
  category: KpiCategory;
  group: KpiGroup;
  measureType: MeasureType;
  // 측정방법 서술 — 미작성 시 null.
  measureMethod: string | null;
  // 정성 여부(true면 서술형, measureType='qualitative'와 함께 쓰임).
  isQualitative: boolean;
  weight: number;
  targetValue: number | null;
  targetText: string | null;
  // 정성 등급 부여 기준(S~D 서술) — 미작성 시 null.
  gradingCriteria: KpiGradingCriteria | null;
  cumulativeActual: number; // 분기 실적 누적(actualValue 합)
  cumulativeRate: number | null; // 누적 달성률(%) — 정성은 null 가능
  currentGrade: Grade | null; // 중간 시점 등급(정성은 null)
  trend: ProgressTrend;
  // 정성 KPI 등 달성률 산출 불가 항목은 신호가 null(중립) — '주의'로 오염시키지 않는다.
  signal: ProgressSignal | null;
  quarters: { quarter: number; actualValue: number; achievementRate: number }[];
  // 이전 자가점검 입력값(prefill 용) — 없으면 null.
  selfCheckIn: KpiCheckIn | null;
}

// 소속 그룹 월별 실적 누적(없으면 null).
export interface OrgProgress {
  departmentId: string;
  departmentName: string | null; // 그룹명
  targetAmount: number;
  actualAmount: number;
  achievementRate: number; // % (소수1)
  byCategory: {
    category: string;
    targetAmount: number;
    actualAmount: number;
    achievementRate: number;
  }[];
  monthlyTrend: { month: number; achievementRate: number }[]; // 누적
}

export interface MidtermProgress {
  cycleId: string;
  userId: string;
  overallSignal: ProgressSignal; // KPI 신호 worst-case 집계
  kpis: KpiProgress[];
  org: OrgProgress | null;
}

// MidtermReview = cycle × evaluatee 단위 유일. status: pending → self_done → confirmed/revision_requested/rejected.
export type MidtermReviewStatus = 'pending' | 'self_done' | 'confirmed' | 'revision_requested' | 'rejected';

export interface MidtermReview {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  status: MidtermReviewStatus;
  selfNote: string | null;
  selfSubmittedAt: string | null; // ISO
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerNote: string | null;
  confirmedAt: string | null; // ISO
  // 순차 확인 결재(KPI 결재선과 동일 체인) — 완료된 확인 단계 수 + 이력.
  reviewStage: number;
  reviewTrail: KpiApprovalTrailEntry[] | null;
  createdAt: string;
  updatedAt: string;
  // KPI별 자가점검 입력값(부분 upsert, 미제출 시 빈 배열 또는 생략 가능).
  kpiCheckIns: KpiCheckIn[];
}

// POST /midterm/reviews — 본인 자가점검 제출(upsert, 부분 kpiCheckIns 허용).
export interface SubmitMidtermSelfReviewRequest {
  cycleId: string;
  selfNote?: string; // 사이클 단위 자가점검 코멘트(최대 4000자)
  kpiCheckIns?: {
    kpiId: string;
    selfActualText?: string;
    selfActualValue?: number;
    selfNote?: string; // 최대 4000자
    selfGrade?: Grade;
  }[];
}
// PATCH /midterm/reviews/:id/confirm — 부서장 확인.
export interface ConfirmMidtermReviewRequest {
  reviewerNote?: string;
  kpiReviews?: MidtermKpiReviewItem[];
}
// POST /midterm/reviews/:id/request-revision — 수정요청. reviewerNote 필수(사유).
// POST /midterm/reviews/:id/reject — 반려. reviewerNote 필수(사유).
export interface SendBackMidtermReviewRequest {
  reviewerNote: string;
  kpiReviews?: MidtermKpiReviewItem[];
}

// ── 피드백 보완 조치 — ActionItem (③) ──
// 최종등급 미반영(참고용). dueDate·completedAt 은 nullable(백엔드 toDto 기준).
export type ActionItemStatus = 'planned' | 'in_progress' | 'done' | 'canceled';

export interface ActionItem {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  kpiId: string | null;
  kpiTitle: string | null;
  source: 'midterm_review';
  title: string;
  detail: string | null;
  assigneeId: string; // 담당(기본 = evaluatee)
  assigneeName: string | null;
  dueDate: string | null; // ISO
  status: ActionItemStatus;
  createdById: string;
  createdByName: string | null;
  completedAt: string | null; // ISO (done 시)
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// POST /action-items — 생성(부서장·HR).
export interface CreateActionItemRequest {
  cycleId: string;
  evaluateeId: string;
  kpiId?: string | null;
  title: string; // ≤200
  detail?: string; // ≤4000
  assigneeId?: string; // 미지정 → evaluateeId
  dueDate?: string; // ISO 8601
}
// PATCH /action-items/:id — 내용 수정.
export interface UpdateActionItemRequest {
  title?: string;
  detail?: string;
  assigneeId?: string;
  kpiId?: string | null;
  dueDate?: string;
}
// PATCH /action-items/:id/status — 상태 전이.
export interface TransitionActionItemRequest {
  status: ActionItemStatus;
  completionNote?: string;
}

// ── 중간 KPI 목표 재조정(re-baseline) + 변경 이력 (④) ──
// contract-midterm.md §7 과 1:1. mid_review 단계에서만 실행 가능(그 외 400).
// 디자이너 가정(PATCH 단건·제네릭 KpiSnapshot diff)과 달리 실제 계약은
// POST 일괄(/midterm/rebaseline) + 전용 이력 엔드포인트(/midterm/rebaseline/history)다.

// 재조정 대상 필드(편집 가능: 목표값/목표서술/가중치).
export type RebaselineField = 'targetValue' | 'targetText' | 'weight';

// 한 필드의 전/후(실제로 값이 바뀐 필드만 응답에 포함).
export interface RebaselineFieldChange {
  field: RebaselineField;
  before: number | string | null;
  after: number | string | null;
}

// 한 KPI 의 변경 묶음(바뀐 필드만).
export interface RebaselineKpiChange {
  kpiId: string;
  title: string;
  fields: RebaselineFieldChange[];
}

// 갱신 후 현재 KPI 스냅샷 shape(재조정 응답·전체 목록).
export interface RebaselineKpi {
  id: string;
  title: string;
  category: string;
  group: string;
  measureType: string;
  targetValue: number | null;
  targetText: string | null;
  weight: number;
  isQualitative: boolean;
  status: string;
}

// GET /midterm/rebaseline/history — 이력/diff 1건(사유·변경자·시각 포함).
export interface RebaselineHistoryEntry {
  snapshotId: string;
  label: string; // "중간 조정 전 (YYYY-MM-DD)"
  createdAt: string; // ISO — 재조정 직전(=조정 시점) 시각
  createdBy: string | null; // 재조정 실행자 userId
  createdByName: string | null; // 재조정 실행자 표시명(백엔드 해석 — MINOR-1)
  reason: string | null; // 해당 재조정 사유(AuditLog 매칭)
  changed: RebaselineKpiChange[]; // 이 스냅샷(before) → 다음 시점(after) diff
}

// ── 재조정 제안→검토→승인 워크플로우 (contract-midterm.md §7 재설계 2026-06-08) ──

// 상태 머신: submitted → approved | rejected → submitted (재제출).
export type RebaselineRequestStatus = 'submitted' | 'approved' | 'rejected';

// 제안 1건(저장·반환되는 items[] 요소).
export interface RebaselineItem {
  kpiId: string;
  targetValue?: number | null; // undefined=변경 안 함, null=목표값 제거
  targetText?: string | null; // undefined=변경 안 함, ≤2000
  weight?: number; // undefined=변경 안 함, 0~100 정수
}

// 현재 confirmed KPI 스냅샷 shape(diff 기준)은 RebaselineKpi 와 동일 — 별도 타입 없이 재사용.

// 한 KPI 의 제안 vs 현재 diff.
export interface RebaselineProposedChange {
  kpiId: string;
  title: string | null;
  proposed: { targetValue?: number | null; targetText?: string | null; weight?: number };
  current: { targetValue: number | null; targetText: string | null; weight: number } | null;
  fields: RebaselineFieldChange[];
}

// 목록·공통 view (GET /midterm/rebaseline-requests 응답 요소).
export interface RebaselineRequestView {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  reason: string;
  status: RebaselineRequestStatus;
  itemCount: number;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null; // ISO
  appliedSnapshotId: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// 상세 = view + 제안·현재값 비교 정보 (GET /midterm/rebaseline-requests/:id).
export interface RebaselineRequestDetail extends RebaselineRequestView {
  items: RebaselineItem[];
  currentKpis: RebaselineKpi[];
  proposedChanges: RebaselineProposedChange[];
  projectedWeightSum: number;
  weightValid: boolean;
}

// POST /midterm/rebaseline-requests body.
export interface CreateRebaselineRequestBody {
  cycleId: string;
  reason: string; // 1~1000자, 공백 불가
  items: RebaselineItem[]; // ≥1, kpiId 중복 불가
}

// PATCH /midterm/rebaseline-requests/:id body (본인 수정·재제출).
export interface UpdateRebaselineRequestBody {
  reason?: string;
  items?: RebaselineItem[];
}

// PATCH /midterm/rebaseline-requests/:id/review body (부서장 검토).
export interface ReviewRebaselineRequestBody {
  decision: 'approve' | 'reject';
  comment?: string; // ≤2000
}
