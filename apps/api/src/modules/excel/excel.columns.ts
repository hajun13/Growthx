/**
 * 엑셀 임포트/양식 컬럼 단일 출처(SSOT).
 * 임포트 파서(excel.service)가 읽는 헤더 별칭과 양식(빈 템플릿) 생성이
 * 동일한 정의를 공유하도록 한다. `header`는 양식에 출력되는 1차(권장) 헤더이며,
 * `aliases`는 임포트 시 추가로 허용되는 동의어다.
 */
export interface ColumnDef {
  /** 양식 헤더 행에 출력되는 권장 헤더(임포트가 기본으로 읽는 키). */
  header: string;
  /** 임포트 시 추가 허용되는 헤더 별칭. */
  aliases: string[];
  /** 필수 여부(안내용 주석/예시에 반영). */
  required: boolean;
  /** 예시 행에 채울 값. */
  example: string | number;
  /** 헤더 셀에 다는 안내(허용값 등). */
  note?: string;
}

/** templates 임포트: jobLevel·category·group·measureType·weight·sampleStrategy. */
export const TEMPLATE_COLUMNS: ColumnDef[] = [
  {
    header: 'jobLevel',
    aliases: ['직급', '양식'],
    required: true,
    example: 'senior',
    note: '허용값: executive | director | lead | principal | senior | pro',
  },
  {
    header: 'category',
    aliases: ['핵심전략', '카테고리'],
    required: true,
    example: 'sales',
    note: 'KpiCategory enum 값',
  },
  {
    header: 'group',
    aliases: ['지표그룹', '그룹'],
    required: true,
    example: 'performance',
    note: '허용값: performance | collaboration_growth',
  },
  {
    header: 'measureType',
    aliases: ['측정방식'],
    required: true,
    example: 'rate',
    note: '허용값: amount | rate | count | qualitative',
  },
  {
    header: 'weight',
    aliases: ['가중치'],
    required: true,
    example: 70,
    note: '숫자(%) — 그룹 합=100, 정성 합≤30',
  },
  {
    header: 'sampleStrategy',
    aliases: ['전략', '샘플전략'],
    required: false,
    example: '매출액 달성',
    note: '선택',
  },
];

/** org(조직/대상자) 임포트: email·name·department. */
export const ORG_COLUMNS: ColumnDef[] = [
  { header: 'email', aliases: ['이메일'], required: true, example: 'hong@energyx.co.kr' },
  { header: 'name', aliases: ['이름'], required: true, example: '홍길동' },
  {
    header: 'department',
    aliases: ['부서'],
    required: false,
    example: '영업1팀',
    note: '기존 부서명과 일치해야 매칭(신규 미생성)',
  },
];

/** achievements(KPI 실적) 임포트: kpiId·quarter·actualValue. */
export const ACHIEVEMENT_COLUMNS: ColumnDef[] = [
  { header: 'kpiId', aliases: ['KPI'], required: true, example: 'kpi-uuid', note: '대상 KPI id' },
  { header: 'quarter', aliases: ['분기'], required: true, example: 1, note: '1~4' },
  { header: 'actualValue', aliases: ['실적'], required: true, example: 1200, note: '실적값(숫자)' },
];

/** roster(임직원 명부) 임포트 — M3 Item1. Amaris 다운로드 6컬럼. */
export const ROSTER_COLUMNS: ColumnDef[] = [
  { header: '그룹', aliases: ['group'], required: true, example: '이노베이션그룹', note: '최상위 조직(그룹). 필수.' },
  { header: '본부', aliases: ['division'], required: false, example: '플랜트본부', note: '비울 수 있음(팀이 그룹 직속).' },
  { header: '팀', aliases: ['team'], required: false, example: 'IT개발팀', note: '비울 수 있음(본부/그룹 직속).' },
  { header: '직급', aliases: ['position', '직책'], required: true, example: '선임', note: '대표이사·부대표·상무·이사·수석·본부장·팀장·책임·선임·프로' },
  { header: '이름', aliases: ['name'], required: true, example: '홍길동' },
  { header: '이메일', aliases: ['email'], required: true, example: 'hong@energyx.co.kr', note: '고유(중복 불가). 사용자 매칭 키.' },
];

export type TemplateKind = 'templates' | 'org' | 'achievements' | 'roster';

export const TEMPLATE_COLUMN_MAP: Record<TemplateKind, ColumnDef[]> = {
  templates: TEMPLATE_COLUMNS,
  org: ORG_COLUMNS,
  achievements: ACHIEVEMENT_COLUMNS,
  roster: ROSTER_COLUMNS,
};
