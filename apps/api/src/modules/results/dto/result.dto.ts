import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListResultsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() userId?: string;
}

export class ResultDetailQuery {
  @IsString()
  cycleId!: string;
}

export class AggregateResultDto {
  @IsString()
  cycleId!: string;

  @IsString()
  userId!: string;
}

/** M3 Item 9: 개인 평가 결과 내보내기. */
export class ExportResultQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsIn(['pdf', 'excel'])
  format?: 'pdf' | 'excel';
}

/** YoY: 개인 연도별 결과 타임라인. cycleIds 콤마구분(생략 시 전 사이클). */
export class CompareResultsQuery {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() cycleIds?: string;
}

/** YoY: 사이클별 등급분포. scope=group|division|team, legalEntity 필터. */
export class DistributionQuery {
  @IsOptional() @IsIn(['group', 'division', 'team']) scope?: 'group' | 'division' | 'team';
  @IsOptional() @IsString() deptId?: string;
  @IsOptional() @IsString() cycleIds?: string;
  @IsOptional() @IsIn(['energyx', 'mirae_plan']) legalEntity?: 'energyx' | 'mirae_plan';
}
