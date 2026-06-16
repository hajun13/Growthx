import { ApiProperty } from '@nestjs/swagger';

/**
 * 경영실적 그리드 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다.
 * 프론트가 4행(매출·원가·매출총이익·매출총이익율) × (2024 + 1~12월[목표/실적] + 년계) 표를 그릴 수 있는 shape.
 * 파생값(매출총이익=매출-원가, 매출총이익율=이익/매출, 년계=Σ월)은 백엔드가 계산해 포함.
 */

/** 목표/실적 한 쌍(+파생 매출총이익율은 cell 단위로 프론트 계산하거나 행 단위 사용). */
export class FinancialCellDto {
  /** 목표값. 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  target!: number | null;

  /** 실적값. 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  actual!: number | null;
}

/** 한 컬럼(2024 / 1~12월 / 년계)의 매출·원가·파생값. */
export class FinancialColumnDto {
  /** 'prevYear'(2024) | '1'..'12'(월) | 'yearTotal'(년계). */
  @ApiProperty()
  key!: string;

  /** 표시 라벨(예: '2024년', '1월', '년계'). */
  @ApiProperty()
  label!: string;

  /** 전년 참고 컬럼이면 true(읽기전용·목표 없을 수 있음). */
  @ApiProperty()
  isPrevYear!: boolean;

  /** 년계(합계) 컬럼이면 true(자동계산). */
  @ApiProperty()
  isYearTotal!: boolean;

  @ApiProperty()
  revenue!: FinancialCellDto;

  @ApiProperty()
  cost!: FinancialCellDto;

  /** 매출총이익 = 매출 − 원가 (목표/실적 각각). 자동계산. */
  @ApiProperty()
  grossProfit!: FinancialCellDto;

  /** 매출총이익율(%) = 매출총이익 / 매출 × 100. 매출 0/누락이면 null('-' 표시). 목표/실적 각각. */
  @ApiProperty({ type: Number, nullable: true })
  grossProfitMarginTarget!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  grossProfitMarginActual!: number | null;
}

/** 경영실적 그리드 전체 — 컬럼 배열(prevYear, 1~12월, yearTotal). */
export class FinancialGridDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  departmentId!: string;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  /** 기준연도(예: 2025). */
  @ApiProperty()
  year!: number;

  /** 전년도 연도(year-1, 예: 2024). */
  @ApiProperty()
  prevYear!: number;

  /** 컬럼: [prevYear, 1..12월, yearTotal] 순. */
  @ApiProperty({ type: [FinancialColumnDto] })
  columns!: FinancialColumnDto[];
}

/** 일괄 적재 결과. */
export class FinancialPerformanceBulkResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  departmentId!: string;

  @ApiProperty()
  year!: number;

  /** upsert 된 월 행 수(1~12 중 입력된 것). */
  @ApiProperty()
  upsertedMonths!: number;

  /** 전년(2024) sentinel 행 저장 여부. */
  @ApiProperty()
  prevYearSaved!: boolean;
}
