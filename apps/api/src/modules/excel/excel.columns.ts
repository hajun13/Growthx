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

export type TemplateKind = 'templates' | 'org' | 'achievements';

export const TEMPLATE_COLUMN_MAP: Record<TemplateKind, ColumnDef[]> = {
  templates: TEMPLATE_COLUMNS,
  org: ORG_COLUMNS,
  achievements: ACHIEVEMENT_COLUMNS,
};
