// UI 매핑 헬퍼 — 도메인 문자열 → 한글 라벨/색 클래스.
// v2: Dimension·peer/upward 라벨 제거. KPI 분류(category/group/measureType)·tier 라벨 추가.
import type {
  Grade,
  EvalStatus,
  KpiStatus,
  AppealStatus,
  Role,
  Position,
  VisibilityScope,
  EvalType,
  KpiGroup,
  KpiCategory,
  MeasureType,
  GroupTier,
} from './types';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
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

// M3 Items1-3: Position 10값 한글 라벨(UI 단일 출처).
export const positionLabel: Record<Position, string> = {
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

// ── 감사 로그 액션/엔티티 → 한글 라벨 (AuditLog) ───────────────
// 계약 기록 대상 action 문자열.
export const auditActionLabel: Record<string, string> = {
  'rule_set.create': 'RuleSet 생성',
  'rule_set.update': 'RuleSet 변경',
  'cycle.schedule.update': '일정 변경',
  'kpi.approve': 'KPI 승인',
  'kpi.reject': 'KPI 반려',
  'evaluation.submit': '평가 제출',
  'evaluation.finalize': '평가 확정',
  'evaluation.overall_grade.override': '종합등급 오버라이드',
  'grade_pool.compute': '등급 풀 산정',
  'appeal.decide': '이의제기 결정',
};
export function auditActionText(action: string): string {
  return auditActionLabel[action] ?? action;
}

export const auditEntityLabel: Record<string, string> = {
  RuleSet: '규칙',
  EvaluationCycle: '평가 주기',
  Kpi: 'KPI',
  Evaluation: '평가',
  GradePool: '등급 풀',
  Appeal: '이의제기',
};
export function auditEntityText(entity: string): string {
  return auditEntityLabel[entity] ?? entity;
}

// 일정 단계(phase) → 한글 라벨 (ScheduleEditor).
export const schedulePhaseLabel: Record<string, string> = {
  prep: '평가준비',
  self: '본인평가',
  downward1: '1차 팀장',
  downward2: '2차 본부장',
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
