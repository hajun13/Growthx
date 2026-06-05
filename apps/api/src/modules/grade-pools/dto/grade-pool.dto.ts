import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ComputeGradePoolDto {
  @IsString()
  cycleId!: string;

  @IsString()
  groupId!: string;
}

export class ListGradePoolsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() groupId?: string;
}

/** HR 수동 풀 비율 조정. 지정된 등급 비율만 갱신(0~100). */
export class UpdateGradePoolDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) sRatio?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) aRatio?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) bRatio?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) cRatio?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) dRatio?: number;
}
