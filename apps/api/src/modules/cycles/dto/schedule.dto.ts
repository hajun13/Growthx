import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** 주기 단계별 일정 1건 (평가준비/본인평가/1차/2차/결과). */
export class ScheduleItemDto {
  @IsString()
  phase!: string;

  /** ISO 8601 마감일. */
  @IsString()
  dueDate!: string;

  /** 알림 리드타임(일). 예: [7,3,1] = D-7/D-3/D-1. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  notifyOffsets?: number[];

  @IsOptional()
  @IsBoolean()
  notifyEnabled?: boolean;

  /** 대상 사용자 id 목록. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];

  /** 대상 부서 id 목록. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDeptIds?: string[];
}

/** 주기 일정 일괄 저장(upsert by phase). */
export class UpsertSchedulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules!: ScheduleItemDto[];
}
