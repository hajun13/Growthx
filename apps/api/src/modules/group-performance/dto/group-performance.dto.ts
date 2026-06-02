import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertGroupPerformanceDto {
  @IsString()
  groupId!: string;

  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsNumber()
  revenue?: number;

  @IsOptional()
  @IsNumber()
  orders?: number;

  @IsOptional()
  @IsNumber()
  profit?: number;

  /** 그룹 실적 달성률(%). tier 는 백엔드가 분류. */
  @IsNumber()
  achievementRate!: number;
}

export class ListGroupPerformanceQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() groupId?: string;
}
