import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

/** D-7/D-1/D-3 등 마감/독촉 알림 생성(HR/시스템). */
export class CreateNotificationDto {
  @IsString()
  userId!: string;

  /** 알림 유형 (예: deadline_d7, deadline_d1, comment_d3). */
  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

/** 마감 기준 일괄 생성: 대상 cycle 의 대상자에게 D-7/D-1/D-3 알림 생성. */
export class GenerateNotificationsDto {
  @IsString()
  cycleId!: string;

  @IsIn(['d7', 'd1', 'd3'])
  kind!: 'd7' | 'd1' | 'd3';

  @IsString()
  message!: string;
}

export class ListNotificationsQuery {
  /** 'true' 면 미읽음만. 쿼리스트링은 문자열로 전달됨. */
  @IsOptional() @IsString() unreadOnly?: string;
}
