import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { AppealDecisionType, AppealStatus, Grade } from '@prisma/client';

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

/**
 * HR 최종 결정 (answered → closed / reevaluate 는 answered 유지).
 * decisionType 별 자동수정: score_adjust=newScore 필수, grade_adjust=newGrade 필수.
 * reason(사유)은 모든 유형에서 필수(사후 변경 추적).
 */
export class DecideAppealDto {
  @IsEnum(AppealDecisionType)
  decisionType!: AppealDecisionType;

  /** 결정 사유(전 유형 필수). 하위 호환: 기존 `decision` 컬럼에 저장. */
  @IsString()
  reason!: string;

  /** score_adjust 시 새 총점(finalScore). 등급은 gradeScale 로 자동 산정. */
  @ValidateIf((o: DecideAppealDto) => o.decisionType === AppealDecisionType.score_adjust)
  @IsNumber()
  newScore?: number;

  /** grade_adjust 시 새 종합등급(override). 풀 상한 위반 시 감사 경고. */
  @ValidateIf((o: DecideAppealDto) => o.decisionType === AppealDecisionType.grade_adjust)
  @IsEnum(Grade)
  newGrade?: Grade;
}

export class ListAppealsQuery {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsEnum(AppealStatus) status?: AppealStatus;
}
