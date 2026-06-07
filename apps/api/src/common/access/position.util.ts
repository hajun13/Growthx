import { JobLevel, KpiCategory, Role, VisibilityScope } from '@prisma/client';

/**
 * enum Position 폐기 대체 (계약 B-4).
 * - 값 상수: 시스템 직급 10코드. `Position.team_lead` 등 기존 값 참조가 그대로 동작.
 * - 타입: 커스텀 직급 코드(string) 허용 위해 string 으로 선언(값+타입 선언 병합).
 * 레지스트리(PositionDef) 가 코드↔라벨↔기본값의 단일 출처이고, 아래 정적 맵·함수는
 * 시스템 직급용 폴백(시드 출처 겸용)으로 보존한다.
 */
export const Position = {
  ceo: 'ceo',
  president: 'president',
  vice_president: 'vice_president',
  executive: 'executive',
  director: 'director',
  principal: 'principal',
  division_head: 'division_head',
  team_lead: 'team_lead',
  chief: 'chief',
  senior: 'senior',
  pro: 'pro',
} as const;
export type Position = string; // 커스텀 코드 허용(값+타입 선언 병합)

/** 초기 비밀번호(임포트/신규 생성 공통). M3 Item1. */
export const INITIAL_PASSWORD = '1234';

/**
 * M3 Items1-3 공통 매핑.
 * - 한글 직급 → Position enum
 * - Position → 기본 role / visibilityScope / jobLevel(KPI 양식)
 * - 직책자 여부 / KPI 카테고리 기본 허용
 * domain-model §2·requirements-m3-items1-3 §1·4·5.
 */

/** 한글 직급 라벨 → Position 코드. 미일치 시 null. (시스템 직급 폴백) */
export const KOREAN_POSITION_MAP: Record<string, Position> = {
  대표이사: Position.ceo,
  사장: Position.president,
  부대표: Position.vice_president,
  상무: Position.executive,
  이사: Position.director,
  수석: Position.principal,
  본부장: Position.division_head,
  팀장: Position.team_lead,
  책임: Position.chief,
  선임: Position.senior,
  프로: Position.pro,
};

/** Position 코드 → 한글 라벨(UI). 시스템 직급 폴백(레지스트리 label 우선). */
export const POSITION_LABEL: Record<string, string> = {
  ceo: '대표이사',
  president: '사장',
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

export function parseKoreanPosition(label: string): Position | null {
  return KOREAN_POSITION_MAP[label.trim()] ?? null;
}

/** 직책자(경영진·본부장·팀장) 여부. 비직책자 = principal·chief·senior·pro. */
export function isTitleHolder(position: Position): boolean {
  return (
    position === Position.ceo ||
    position === Position.president ||
    position === Position.vice_president ||
    position === Position.executive ||
    position === Position.director ||
    position === Position.division_head ||
    position === Position.team_lead
  );
}

/**
 * 임포트/신규 생성 시 직급 자동기본 role·visibilityScope.
 * - 인사총무팀(HR) 소속 → hr_admin·company (호출부에서 isHrDept 전달)
 * - ceo/vice_president/executive/director → division_head·group
 * - division_head → division_head·division
 * - team_lead → team_lead·team
 * - principal/chief/senior/pro → employee·self
 */
export function defaultRoleScope(
  position: Position,
  isHrDept: boolean,
): { role: Role; scope: VisibilityScope } {
  if (isHrDept) return { role: Role.hr_admin, scope: VisibilityScope.company };
  switch (position) {
    case Position.ceo:
    case Position.president:
    case Position.vice_president:
    case Position.executive:
    case Position.director:
      return { role: Role.division_head, scope: VisibilityScope.group };
    case Position.division_head:
      return { role: Role.division_head, scope: VisibilityScope.division };
    case Position.team_lead:
      return { role: Role.team_lead, scope: VisibilityScope.team };
    default:
      return { role: Role.employee, scope: VisibilityScope.self };
  }
}

/** Position → KPI 양식 jobLevel 파생. (책임·선임·프로는 senior_plus/minus 근사) */
export function deriveJobLevel(position: Position): JobLevel {
  switch (position) {
    case Position.ceo:
    case Position.president:
    case Position.vice_president:
    case Position.executive:
    case Position.director:
    case Position.division_head:
      return JobLevel.division_head;
    case Position.team_lead:
      return JobLevel.team_lead;
    case Position.principal:
    case Position.chief:
      return JobLevel.senior_plus;
    case Position.senior:
    case Position.pro:
    default:
      return JobLevel.senior_minus;
  }
}

/** HR(인사/총무) 부서 명칭 판별. */
export function isHrDeptName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.replace(/\s/g, '');
  return n.includes('인사') || n.includes('총무') || /hr/i.test(n);
}

/** Position 기본 허용 KPI 카테고리. 직책자=전 카테고리, 비직책자=revenue·orders 차단. */
export function defaultAllowedCategories(position: Position): KpiCategory[] {
  if (isTitleHolder(position)) {
    return [
      KpiCategory.revenue,
      KpiCategory.construction,
      KpiCategory.orders,
      KpiCategory.collaboration,
      KpiCategory.development,
    ];
  }
  return [KpiCategory.construction, KpiCategory.collaboration, KpiCategory.development];
}
