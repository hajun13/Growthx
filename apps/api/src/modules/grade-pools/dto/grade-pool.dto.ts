import { IsOptional, IsString } from 'class-validator';

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
