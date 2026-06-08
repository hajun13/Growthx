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

  /** M3 Item 5: 단계 시작일(ISO 8601). CycleSchedule.startDate 로 영속(활성 윈도우 판정에 사용). */
  @IsOptional()
  @IsString()
  startDate?: string | null;

  /** M3 Item 5: 잠금 여부. 잠금 시 해당 phase KPI 작성/수정 차단(423). */
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

/** 주기 일정 일괄 저장(upsert by phase). */
export class UpsertSchedulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules!: ScheduleItemDto[];
}

/** M3 Item 5: phase 잠금/열기 토글. */
export class SetScheduleLockDto {
  @IsBoolean()
  isLocked!: boolean;

  /** 재오픈(isLocked=false) 시 필수 사유. 감사로그 after.reason 에 기록. */
  @IsOptional()
  @IsString()
  reason?: string;
}
