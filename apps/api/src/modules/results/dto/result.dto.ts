import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListResultsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() userId?: string;
}

export class ResultDetailQuery {
  @IsString()
  cycleId!: string;
}

/** 평가자정리 표 — 사이클별 다단계 평가 요약(1차/2차/최종 × 실적/역량 + 합산 + 최종). */
export class SummaryTableQuery {
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
