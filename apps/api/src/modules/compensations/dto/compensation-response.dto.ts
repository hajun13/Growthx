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
