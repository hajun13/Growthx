import { IsOptional, IsString } from 'class-validator';

/** 감사 로그 조회 필터 (hr_admin). actor/action/entity/기간 + 페이지네이션. */
export class ListAuditLogsQuery {
  @IsOptional() @IsString() actorId?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() entityId?: string;
  /** ISO 8601 (포함). */
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}
