import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

/** 보상 산정/시뮬레이션. cycle 의 확정 결과(EvaluationResult) 등급 → 인상률. */
export class ComputeCompensationDto {
  @IsString()
  cycleId!: string;

  /** true = 시뮬레이션(미확정), false = 실제 연동. 기본 false. */
  @IsOptional()
  @IsBoolean()
  simulated?: boolean;
}

export class ListCompensationsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() userId?: string;
}

/** M3 Item 8: 개인 연봉 시뮬레이션. userId 미지정 시 본인. */
export class SimulationQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

/** M3 Item 8: 팀(부서) 연봉 시뮬레이션(관리자). */
export class TeamSimulationQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

/**
 * 보상 수기 조정 upsert(PUT /compensations/adjustment, hr_admin 전용).
 * (userId, cycleId) 유니크에 조정분·승격·인센티브·비고를 멱등 upsert.
 * 모든 필드 nullable — null 전송 시 해당 컬럼을 비운다(undefined 와 구분해 명시적 클리어 지원).
 */
export class UpsertCompensationAdjustmentDto {
  @IsString()
  cycleId!: string;

  @IsString()
  userId!: string;

  /** 조정분(원). 음수 허용(감액). null=클리어. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  adjustmentAmount?: number | null;

  /** 승격 직급 PositionDef.code. null=클리어. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  promotionPositionCode?: string | null;

  /** 인센티브(원). 음수 불가. null=클리어. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  incentiveAmount?: number | null;

  /** 비고(자유 텍스트). null=클리어. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  note?: string | null;
}
