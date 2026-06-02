import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
