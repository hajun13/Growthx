import { IsOptional, IsString } from 'class-validator';

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
