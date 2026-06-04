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
