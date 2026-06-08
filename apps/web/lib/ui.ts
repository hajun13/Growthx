// UI 매핑 헬퍼 — 도메인 문자열 → 한글 라벨/색 클래스.
// v2: Dimension·peer/upward 라벨 제거. KPI 분류(category/group/measureType)·tier 라벨 추가.
import type {
  Grade,
  EvalStatus,
  KpiStatus,
  AppealStatus,
  Role,
  VisibilityScope,
  EvalType,
  KpiGroup,
  KpiCategory,
  MeasureType,
  GroupTier,
  CycleType,
  CycleStatus,
  LegalEntity,
  EmploymentStatus,
} from './types';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// 평가 주기 유형(MIDTERM/FINAL) → 한글 라벨.
export const cycleTypeLabel: Record<CycleType, string> = {
  MIDTERM: '중간평가 (6월)',
  FINAL: '최종평가 (12월)',
};

// 평가 주기 유형 배지 스타일(배경+전경 class).
export const cycleTypeStyle: Record<
  CycleType,
  { label: string; className: string }
> = {
  MIDTERM: {
    label: '중간평가 (6월)',
    className: 'bg-blue-50 text-blue-700',
  },
  FINAL: {
    label: '최종평가 (12월)',
    className: 'bg-emerald-50 text-emerald-700',
  },
};

// 평가 주기 진행 상태(CycleStatus) → 쉬운 한글 라벨.
export const cycleStatusLabel: Record<CycleStatus, string> = {
  draft: '준비 중',
  active: '진행 중',
  mid_review: '중간평가',
  calibration: '등급 조정',
  closed: '완료',
};
export function cycleStatusText(s: string): string {
  return cycleStatusLabel[s as CycleStatus] ?? s;
}
// 진행 성격이면 true(초록 배지) — 종료/준비 단계는 false(회색).
export function isCycleOngoing(s: string): boolean {
  return s === 'active' || s === 'mid_review' || s === 'calibration';
}

// 점수 표시(소수 2자리, tabular). 백엔드 값만 표시.
export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return n.toFixed(2);
}
export function fmtPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return `${Math.round(n)}%`;
}

export const gradeBgClass: Record<Grade, string> = {
  S: 'bg-gradeBg-s text-gradeFg-s',
  A: 'bg-gradeBg-a text-gradeFg-a',
  B: 'bg-gradeBg-b text-gradeFg-b',
  C: 'bg-gradeBg-c text-gradeFg-c',
  D: 'bg-gradeBg-d text-gradeFg-d',
};

export const gradeSolidClass: Record<Grade, string> = {
  S: 'bg-grade-s text-white',
  A: 'bg-grade-a text-white',
  B: 'bg-grade-b text-white',
  C: 'bg-grade-c text-white',
  D: 'bg-grade-d text-white',
};

// ComparisonBar 막대 채움(유형별) — self/downward1/downward2 3색.
export const evalTypeBarClass: Record<EvalType, string> = {
  self: 'bg-chart-self',
  downward: 'bg-chart-downward-1',
};

export const evalTypeLabel: Record<EvalType, string> = {
  self: '본인평가',
  downward: '부서장 평가',
};

// KPI 분류 한글 라벨
export const kpiGroupLabel: Record<KpiGroup, string> = {
  performance_core: '성과중심 지표',
  collaboration_growth: '협업·성장 지표',
};

export const kpiCategoryLabel: Record<KpiCategory, string> = {
  revenue: '매출액',
  construction: '공정액',
  orders: '수주&업무수행',
  collaboration: '협업성과',
  development: '자기개발',
};

export const measureTypeLabel: Record<MeasureType, string> = {
  amount: '달성금액',
  rate: '증감률',
  count: '건수',
  qualitative: '정성',
};

// 측정방식별 입력 단위(보조 표시)
export const measureTypeUnit: Record<MeasureType, string> = {
  amount: '',
  rate: '%',
  count: '건',
  qualitative: '',
};

export const tierLabel: Record<GroupTier, string> = {
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
};

// 금액 표시(억/만원 단위, 백엔드 값 그대로 — 재계산 아님).
export function fmtAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  if (Math.abs(n) >= 1_0000_0000) {
    return `${(n / 1_0000_0000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억`;
  }
  if (Math.abs(n) >= 1_0000) {
    return `${(n / 1_0000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`;
  }
  return n.toLocaleString('ko-KR');
}

// 원 단위 연봉 표시(만원 단위 반올림).
export function fmtSalary(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return `${Math.round(n / 1_0000).toLocaleString('ko-KR')}만원`;
}

export const monthLabel = (m: number): string => `${m}월`;

// tier 배지 색(StatusBadge 재사용 — design-tokens: excellent→success·standard→neutral·poor→warning)
export const tierStyle: Record<GroupTier, { label: string; className: string }> =
  {
    excellent: {
      label: '우수',
      className: 'bg-status-finalized-bg text-status-finalized-fg',
    },
    standard: {
      label: '보통',
      className: 'bg-status-not-started-bg text-status-not-started-fg',
    },
    poor: {
      label: '미흡',
      className: 'bg-warning-50 text-warning-700',
    },
  };

export const roleLabel: Record<Role, string> = {
  hr_admin: 'HR 관리자',
  division_head: '본부장',
  team_lead: '팀장',
  employee: '임직원',
};

// 시스템 직급 10코드 한글 라벨(폴백 — 레지스트리 없을 때).
// contract C-3: Record<string,string> 로 완화(커스텀 코드 인덱싱 허용). 미정의 코드는 undefined.
export const positionLabel: Record<string, string> = {
  ceo: '대표이사',
  vice_president: '부대표',
  executive: '상무',
  director: '이사',
  principal: '수석',
  division_head: '본부장',
  team_lead: '팀장',
  chief: '책임',
  senior: '선임',
  pro: '프로',
};
// 컴포넌트 스펙 표기(POSITION_LABEL) 별칭 — 동일 출처.
export const POSITION_LABEL = positionLabel;

// 직급 코드 → 한글 라벨. 레지스트리(있으면) 우선 → 정적 폴백맵 → code 그대로.
// registry 는 usePositions() 의 PositionDef[] 또는 code→label 맵 둘 다 허용.
export function getPositionLabel(
  code: string,
  registry?: { code: string; label: string }[] | Record<string, string>,
): string {
  if (Array.isArray(registry)) {
    const hit = registry.find((p) => p.code === code);
    if (hit) return hit.label;
  } else if (registry && registry[code]) {
    return registry[code];
  }
  return positionLabel[code] ?? code;
}

// M3 Items1-3: 가시 범위 한글 라벨(단일 출처).
export const SCOPE_LABEL: Record<VisibilityScope, string> = {
  self: '본인만',
  team: '우리 팀',
  division: '우리 본부',
  group: '우리 그룹',
  company: '전사',
};
// 가시 범위 의미 설명(ScopeSelect hint·PersonEditModal 안내용).
export const SCOPE_DESC: Record<VisibilityScope, string> = {
  self: '자기 데이터만',
  team: '본인 팀',
  division: '본인 본부만(형제 본부 제외)',
  group: '본인 그룹 전체',
  company: '전 조직',
};

interface StatusStyle {
  label: string;
  className: string;
}

export const evalStatusStyle: Record<EvalStatus, StatusStyle> = {
  not_started: {
    label: '미평가',
    className: 'bg-status-not-started-bg text-status-not-started-fg',
  },
  in_progress: {
    label: '진행중',
    className: 'bg-status-in-progress-bg text-status-in-progress-fg',
  },
  submitted: {
    label: '제출',
    className: 'bg-status-submitted-bg text-status-submitted-fg',
  },
  finalized: {
    label: '확정',
    className: 'bg-status-finalized-bg text-status-finalized-fg',
  },
};

export const kpiStatusStyle: Record<KpiStatus, StatusStyle> = {
  draft: {
    label: '작성중',
    className: 'bg-status-not-started-bg text-status-not-started-fg',
  },
  submitted: {
    label: '제출',
    className: 'bg-status-submitted-bg text-status-submitted-fg',
  },
  approved: {
    label: '승인',
    className: 'bg-status-in-progress-bg text-status-in-progress-fg',
  },
  confirmed: {
    label: '확정',
    className: 'bg-status-finalized-bg text-status-finalized-fg',
  },
  rejected: {
    label: '반려',
    className: 'bg-status-danger-bg text-status-danger-fg',
  },
  revision_requested: {
    label: '수정요청',
    className: 'bg-status-danger-bg text-status-danger-fg',
  },
};

// ── 알림 타입 → 라벨/아이콘 톤 (NotificationItem) ──────────────
// 톤은 InfoBanner 팔레트 재사용(연배경 className). 알 수 없는 type 은 generic.
export type NotificationTone = 'info' | 'warning' | 'success' | 'tip' | 'neutral';

export interface NotificationStyle {
  label: string;
  tone: NotificationTone;
}

// 계약 Notification.type → 화면 표기.
export const notificationStyle: Record<string, NotificationStyle> = {
  deadline_d7: { label: '마감 D-7이에요', tone: 'info' },
  deadline_d3: { label: '마감 D-3이에요', tone: 'info' },
  deadline_d1: { label: '마감 D-1이에요', tone: 'info' },
  kpi_rejected: { label: 'KPI가 반려됐어요', tone: 'warning' },
  result_finalized: { label: '평가 결과가 확정됐어요', tone: 'success' },
  appeal_answered: { label: '이의제기 답변이 등록됐어요', tone: 'tip' },
  appeal_decided: { label: '이의제기가 처리됐어요', tone: 'tip' },
};

export function notificationStyleFor(type: string): NotificationStyle {
  return notificationStyle[type] ?? { label: '새 알림이 있어요', tone: 'neutral' };
}

// 알림 카테고리(센터 탭 필터) — type 그룹핑.
export type NotificationCategory = 'deadline' | 'kpi' | 'result' | 'appeal';
export function notificationCategory(type: string): NotificationCategory | null {
  if (type.startsWith('deadline')) return 'deadline';
  if (type.startsWith('kpi')) return 'kpi';
  if (type.startsWith('result')) return 'result';
  if (type.startsWith('appeal')) return 'appeal';
  return null;
}

// 클릭 시 이동 경로(있으면). 단순 매핑 — 상세 화면으로.
export function notificationHref(type: string): string | undefined {
  const cat = notificationCategory(type);
  if (cat === 'deadline') return '/eval';
  if (cat === 'kpi') return '/kpi';
  if (cat === 'result') return '/eval/result';
  if (cat === 'appeal') return '/appeals';
  return undefined;
}

// 알림 타입 → 사이드바 nav key 매핑(뱃지 표시 위치).
export function notificationNavKey(type: string): string | null {
  if (type.startsWith('deadline') || type === 'eval_reminder') return 'eval';
  if (type.startsWith('kpi')) return 'kpi';
  if (type.startsWith('result')) return 'result';
  if (type.startsWith('appeal')) return 'appeals';
  if (type.startsWith('compensation')) return 'compensation';
  return null;
}

// ── 감사 로그 액션/엔티티 → 한글 라벨 (AuditLog) ───────────────
// 백엔드(audit.record)가 기록하는 모든 action 문자열의 한글 표기.
export const auditActionLabel: Record<string, string> = {
  // 규칙 세트
  'rule_set.create': '규칙 세트 생성',
  'rule_set.update': '규칙 세트 변경',
  // 평가 주기·일정
  'cycle.schedule.update': '평가 일정 변경',
  'cycle.schedule.lock': '평가 단계 잠금',
  'cycle.schedule.unlock': '평가 단계 재오픈',
  'cycle.kpi_snapshot.create': 'KPI 스냅샷 생성',
  'cycle.delete': '평가 주기 삭제',
  'cycle.legacy_results.import': '과거 평가결과 가져오기',
  // KPI
  'kpi.approve': 'KPI 승인',
  'kpi.reject': 'KPI 반려',
  'kpi.import': 'KPI 일괄 등록',
  'kpi_category_policy.update': 'KPI 분류 정책 변경',
  // 평가
  'evaluation.submit': '평가 제출',
  'evaluation.finalize': '평가 확정',
  'evaluation.overall_grade.override': '종합등급 직접 조정',
  // 등급 풀
  'grade_pool.compute': '등급 풀 산정',
  'grade_pool.update': '등급 풀 수정',
  // 이의제기
  'appeal.decide': '이의제기 처리',
  // 역량(참고용)
  'competency_question.create': '역량 문항 추가',
  'competency_question.update': '역량 문항 수정',
  'competency_question.delete': '역량 문항 삭제',
  'competency_response.submit': '역량 응답 제출',
  'competency_response.save': '역량 응답 임시저장',
  // 월 실적
  'monthly_performance.upsert': '월 실적 입력',
  'monthly_performance.update': '월 실적 수정',
  // 직급
  'position.create': '직급 추가',
  'position.update': '직급 수정',
  'position.delete': '직급 삭제',
};
export function auditActionText(action: string): string {
  return auditActionLabel[action] ?? action;
}

// 백엔드가 기록하는 모든 entity 이름의 한글 표기.
export const auditEntityLabel: Record<string, string> = {
  RuleSet: '규칙 세트',
  EvaluationCycle: '평가 주기',
  CycleSchedule: '평가 일정',
  Kpi: 'KPI',
  KpiCategoryPolicy: 'KPI 분류 정책',
  Evaluation: '평가',
  GradePool: '등급 풀',
  Appeal: '이의제기',
  MonthlyPerformance: '월 실적',
  PositionDef: '직급',
  CompetencyQuestion: '역량 문항',
  CompetencyResponse: '역량 응답',
};
export function auditEntityText(entity: string): string {
  return auditEntityLabel[entity] ?? entity;
}

// 변경 내역(before/after) 필드 키 → 한글 라벨. DiffViewer에 전달.
export const auditFieldLabel: Record<string, string> = {
  id: 'ID',
  status: '상태',
  decision: '결정 내용',
  text: '문항 내용',
  cycleId: '평가 주기',
  count: '건수',
  name: '이름',
  label: '이름',
  year: '연도',
  isLocked: '잠금 여부',
  reason: '사유',
  rejectReason: '반려 사유',
  overallGrade: '종합등급',
  overallReason: '종합등급 사유',
  totalScore: '총점',
  finalGrade: '최종등급',
  total: '전체 건수',
  imported: '가져온 건수',
  matched: '매칭된 건수',
  createdResigned: '신규 등록 퇴사자',
  reviewQueue: '검토 대기',
  tier: '그룹 실적 등급',
  ratios: '등급 비율',
  allowed: '허용 여부',
  targetAmount: '목표 금액',
  actualAmount: '실적 금액',
  code: '코드',
  sortOrder: '정렬 순서',
  isManagement: '관리직 여부',
  defaultRole: '기본 권한',
  defaultScope: '기본 조회 범위',
  defaultJobLevel: '기본 직급군',
  isSystem: '시스템 기본 항목',
  isActive: '사용 여부',
};

// 변경 내역에 나타나는 영문 enum 값 → 한글 표기. DiffViewer에 전달.
export const auditValueLabel: Record<string, string> = {
  // 평가 상태(EvaluationStatus)
  draft: '작성 중',
  self_submitted: '본인평가 제출',
  submitted: '제출 완료',
  reviewed: '검토 완료',
  finalized: '확정',
  // KPI 상태(KpiStatus)
  approved: '승인',
  rejected: '반려',
  // 이의제기 상태(AppealStatus)
  open: '접수',
  closed: '종료',
  // 그룹 실적 등급(GroupTier)
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
  // 이의제기 결정(decision)
  accepted: '인용',
  // 권한(Role)
  hr_admin: 'HR 관리자',
  division_head: '본부장',
  team_lead: '팀장',
  member: '구성원',
  // 직급군(jobLevel)
  senior_plus: '책임·선임(5년차↑)',
  senior_minus: '선임·프로(5년차↓)',
};

// 일정 단계(phase) → 한글 라벨 (ScheduleEditor).
export const schedulePhaseLabel: Record<string, string> = {
  // Cycle Ops §1: KPI 라이프사이클 정규 키 5개.
  kpi_selection: 'KPI 선정·작성',
  execution_h1: '상반기 실행관리',
  mid_review: '중간평가(재오픈)',
  execution_h2: '하반기 성과관리',
  final_review: '최종평가',
  // 하위호환(과거 데이터 렌더) — 기존 키 유지.
  prep: '평가준비',
  preparation: '평가준비',
  self: '본인평가',
  downward1: '부서장 평가',
  downward2: '부서장 평가',
  result: '결과·확정',
};
export function schedulePhaseText(phase: string): string {
  return schedulePhaseLabel[phase] ?? phase;
}

// jobLevel → 한글 라벨 (TemplateEditor).
export const jobLevelLabel: Record<string, string> = {
  division_head: '본부장',
  team_lead: '팀장',
  senior_plus: '책임·선임(5년차↑)',
  senior_minus: '선임·프로(5년차↓)',
};

// ── 연도 비교(YoY): 법인·재직상태 라벨/스타일 ──────────────────
// 법인 한글 라벨(응답 enum → 표기). 계약 §1: energyx→에너지엑스㈜, mirae_plan→미래환경플랜.
export const legalEntityLabel: Record<LegalEntity, string> = {
  energyx: '에너지엑스㈜',
  mirae_plan: '미래환경플랜',
};
// 법인 뱃지 스타일(기존 토큰만 — energyx 중립, mirae_plan 블루 톤 구분).
export const legalEntityStyle: Record<LegalEntity, string> = {
  energyx: 'bg-toss-grey100 text-toss-grey700',
  mirae_plan: 'bg-toss-blue50 text-toss-blue700',
};
// 재직 상태 한글 라벨(active/on_leave/resigned → 재직/휴직/퇴사).
export const employmentStatusLabel: Record<EmploymentStatus, string> = {
  active: '재직',
  on_leave: '휴직',
  resigned: '퇴사',
};

export const appealStatusStyle: Record<AppealStatus, StatusStyle> = {
  submitted: {
    label: '신청',
    className: 'bg-status-submitted-bg text-status-submitted-fg',
  },
  under_review: {
    label: '검토중',
    className: 'bg-status-in-progress-bg text-status-in-progress-fg',
  },
  answered: {
    label: '답변완료',
    className: 'bg-status-in-progress-bg text-status-in-progress-fg',
  },
  closed: {
    label: '종료',
    className: 'bg-status-finalized-bg text-status-finalized-fg',
  },
};
