// UI 매핑 헬퍼 — 도메인 문자열 → 한글 라벨/색 클래스.
// v2: Dimension·peer/upward 라벨 제거. KPI 분류(category/group/measureType)·tier 라벨 추가.
import type {
  Grade,
  EvalStatus,
  KpiStatus,
  AppealStatus,
  Role,
  Position,
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

export const positionLabel: Record<Position, string> = {
  ceo: '대표이사',
  division_head: '본부장',
  team_lead: '팀장',
  chief: '책임',
  senior: '선임',
  pro: '프로',
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
