import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppealStatus } from '@prisma/client';

export class CreateAppealDto {
  @IsString()
  resultId!: string;

  @IsString()
  reason!: string;
}

/** 팀장 1차 답변 (submitted/under_review → answered). */
export class RespondAppealDto {
  @IsString()
  response!: string;
}

/** HR 최종 결정 (answered → closed). 조정 시 사유 필수. */
export class DecideAppealDto {
  @IsString()
  decision!: string;
}

export class ListAppealsQuery {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsEnum(AppealStatus) status?: AppealStatus;
}
