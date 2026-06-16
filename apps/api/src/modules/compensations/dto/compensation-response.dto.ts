import { ApiProperty } from '@nestjs/swagger';
import { Grade, GroupTier } from '@prisma/client';

/**
 * 보상 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 CompensationsService 반환과 일치.
 */

/** 전년도 연봉 파생 출처(직전 사이클 baseSalary·이월·수기·없음). */
export type PreviousSalarySource = 'derived' | 'carryover' | 'manual' | 'none';

/** 등급별 비교 슬라이더 1행(보너스 포함, 백엔드 산정). */
export class CompensationGradeRowDto {
  @ApiProperty({ enum: Grade })
  grade!: Grade;

  @ApiProperty()
  raiseRate!: number;

  @ApiProperty({ type: Number, nullable: true })
  projectedSalary!: number | null;
}

/**
 * 연봉 시뮬레이션 행 — GET /compensations/simulation(단건)·simulation/team(목록) 공통.
 * buildSimulation 반환과 일치.
 */
export class CompensationSimulationDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty()
  cycleId!: string;

  /** hr_admin 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  currentSalary!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  currentGrade!: Grade | null;

  /** 조회(금년도) 사이클 연도 — currentGrade 의 연도 라벨. 사이클 없으면 null. */
  @ApiProperty({ type: Number, nullable: true })
  currentCycleYear!: number | null;

  /**
   * 직전 사이클 평가등급. 평가등급제 도입연도(2025) 이전 사이클이면 null(그 해엔 등급 없음).
   * 직전 사이클 자체가 없어도 null. 도입전(previousCycleYear<2025) vs 미산정(등급 없음)은 previousCycleYear 로 구분.
   */
  @ApiProperty({ enum: Grade, nullable: true })
  previousGrade!: Grade | null;

  /** 직전 사이클 연도 — previousGrade 의 연도 라벨·도입전 판정(<2025). 직전 사이클 없으면 null. */
  @ApiProperty({ type: Number, nullable: true })
  previousCycleYear!: number | null;

  /** 그룹실적 보너스가 포함된 최종 인상률(%). 등급 없으면 null. */
  @ApiProperty({ type: Number, nullable: true })
  raiseRate!: number | null;

  /** currentSalary 없으면 null(보너스 포함). */
  @ApiProperty({ type: Number, nullable: true })
  projectedSalary!: number | null;

  @ApiProperty()
  position!: string | null;

  /** 전년도 연봉(원). 직전 사이클에서 파생(수기 fallback). */
  @ApiProperty({ type: Number, nullable: true })
  previousSalary!: number | null;

  /** 전년도 연봉 출처. */
  @ApiProperty({ enum: ['derived', 'carryover', 'manual', 'none'] })
  previousSalarySource!: PreviousSalarySource;

  /** 본부. */
  @ApiProperty({ type: String, nullable: true })
  divisionName!: string | null;

  /** 팀. */
  @ApiProperty({ type: String, nullable: true })
  teamName!: string | null;

  /** 소속 그룹 실적 tier(없으면 null). */
  @ApiProperty({ enum: GroupTier, nullable: true })
  groupTier!: GroupTier | null;

  /** 그룹 실적 tier 가산(%p). raiseRate·byGrade 에 이미 반영됨. */
  @ApiProperty()
  groupTierBonus!: number;

  /** 등급별 비교 슬라이더(보너스 포함). */
  @ApiProperty({ type: [CompensationGradeRowDto] })
  byGrade!: CompensationGradeRowDto[];

  // ── 보상 수기 조정(2026 연봉갱신 엑셀 T~AC) — CompensationAdjustment 병합 ──

  /** 조정분(원, 음수 허용). 엑셀 X열. 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  adjustmentAmount!: number | null;

  /** 승격 직급 PositionDef.code. 엑셀 AA열. 미입력 시 null. */
  @ApiProperty({ type: String, nullable: true })
  promotionPositionCode!: string | null;

  /** 인센티브(원). 엑셀 AB열. 미입력 시 null. */
  @ApiProperty({ type: Number, nullable: true })
  incentiveAmount!: number | null;

  /** 비고. 엑셀 AC열. 미입력 시 null. */
  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  /** 최종 제안연봉 = projectedSalary + (adjustmentAmount ?? 0). projectedSalary 가 null이면 null. */
  @ApiProperty({ type: Number, nullable: true })
  finalProjectedSalary!: number | null;

  /** 최종 인상률(%) = round((finalProjectedSalary/currentSalary - 1)*100, 1). currentSalary 없으면 null. */
  @ApiProperty({ type: Number, nullable: true })
  finalRaiseRate!: number | null;

  // ── 보상 표(2026 연봉갱신 Index 시트 K~AC) 경력/연봉 컬럼 — 표시 전용, 저장 안 함 ──

  /** 입사일(ISO date). User.hireDate. 엑셀 K열. 미입력 시 null. */
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  hireDate!: string | null;

  /** 근속력(월) — 파생: round((사이클 연도말 − hireDate)/30일). hireDate 없으면 null. 엑셀 L열. */
  @ApiProperty({ type: Number, nullable: true })
  tenureMonths!: number | null;

  /** 25.02 기준 경력(월). User.careerBaseMonths. 엑셀 M열. */
  @ApiProperty({ type: Number, nullable: true })
  careerBaseMonths!: number | null;

  /** 전경력(월). User.priorCareerMonths. 엑셀 N열. */
  @ApiProperty({ type: Number, nullable: true })
  priorCareerMonths!: number | null;

  /** 총경력(월) — 파생: tenureMonths + (priorCareerMonths ?? 0). 둘 다 없으면 null. 엑셀 O열. */
  @ApiProperty({ type: Number, nullable: true })
  totalCareerMonths!: number | null;

  /** 총경력(연월) "N년 M개월" — 파생(totalCareerMonths 기반). 엑셀 P열. */
  @ApiProperty({ type: String, nullable: true })
  totalCareerLabel!: string | null;

  /** 경력직급. User.careerPosition. 엑셀 Q열. */
  @ApiProperty({ type: String, nullable: true })
  careerPosition!: string | null;

  /** 연차. User.serviceYears. 엑셀 R열. */
  @ApiProperty({ type: Number, nullable: true })
  serviceYears!: number | null;

  /** 고려대상 열외 라벨(비대상/육아휴직/임원/감리원/대표 등). User.considerationExclusion. 엑셀 S열. */
  @ApiProperty({ type: String, nullable: true })
  considerationExclusion!: string | null;

  /** 25년도 연봉(이전제외A). User.currentSalaryExclTransfer. 엑셀 U열. null이면 프론트가 currentSalary 폴백. */
  @ApiProperty({ type: Number, nullable: true })
  currentSalaryExclTransfer!: number | null;

  /** 증감(B−A) — 파생: currentSalary − (currentSalaryExclTransfer ?? currentSalary). 둘 다 없으면 null. 엑셀 W열. */
  @ApiProperty({ type: Number, nullable: true })
  salaryDiffBA!: number | null;
}

/**
 * 보상 수기 조정 행 — PUT /compensations/adjustment 응답.
 * CompensationsService.upsertAdjustment 반환과 일치.
 */
export class CompensationAdjustmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ type: Number, nullable: true })
  adjustmentAmount!: number | null;

  @ApiProperty({ type: String, nullable: true })
  promotionPositionCode!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  incentiveAmount!: number | null;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/**
 * 확정 보상 행 — GET /compensations(목록)·POST /compensations/compute(산정) 공통.
 * CompensationsService.toDto 반환과 일치.
 */
export class CompensationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ enum: Grade })
  finalGrade!: Grade;

  @ApiProperty()
  raiseRate!: number;

  @ApiProperty({ type: Number, nullable: true })
  baseSalary!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  nextYearSalary!: number | null;

  /** 전년도 연봉(원, 누적 직전 사이클 파생). */
  @ApiProperty({ type: Number, nullable: true })
  previousSalary!: number | null;

  @ApiProperty({ enum: ['derived', 'carryover', 'manual', 'none'] })
  previousSalarySource!: PreviousSalarySource;

  @ApiProperty()
  simulated!: boolean;

  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
