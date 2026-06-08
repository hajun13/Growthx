import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { EvaluationStatus, EvaluationType, Grade } from '@prisma/client';

export class CreateEvaluationDto {
  @IsString()
  cycleId!: string;

  @IsString()
  evaluateeId!: string;

  @IsEnum(EvaluationType)
  type!: EvaluationType;

  /** downward 일 때 필수: 1=1차 팀장, 2=2차 본부장. self 는 생략. */
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  round?: number;
}

/**
 * 과제별 성과 점수 입력.
 * - achievementRate: amount/rate 측정방식의 달성률(%) 또는 count 의 실적 건수.
 * - directGrade: qualitative 측정방식에서 평가자가 직접 부여한 등급.
 * grade/score 는 백엔드가 측정방식·RuleSet 으로 산출(프론트 위임 금지).
 */
export class KpiScoreInput {
  @IsString()
  kpiId!: string;

  @IsOptional()
  @IsNumber()
  achievementRate?: number;

  /** 갭#2: 절대금액 모드(useAbsoluteAmount=true) KPI 의 실제 매출 절대금액(원). */
  @IsOptional()
  @IsNumber()
  actualAmount?: number;

  @IsOptional()
  @IsEnum(Grade)
  directGrade?: Grade;

  @IsInt()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsOptional()
  @IsString()
  selfNote?: string;

  /** 부서장(검토자)이 문항별로 남기는 평가 코멘트. */
  @IsOptional()
  @IsString()
  reviewerNote?: string;
}

export class PatchEvaluationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiScoreInput)
  kpiScores?: KpiScoreInput[];

  /** B-3a: 평가자 수동 종합등급 오버라이드. 설정 시 overallReason(사유) 필수. */
  @IsOptional()
  @IsEnum(Grade)
  overallGrade?: Grade;

  @IsOptional()
  @IsString()
  overallReason?: string;
}

/** 부서장 평가 자동 배정 요청(이미 진행 중인 주기에도 재배정 가능). */
export class AutoAssignDownwardDto {
  @IsString()
  cycleId!: string;

  /**
   * 스마트 재배정: true 면 아직 시작 안 한(not_started) 부서장 평가를 모두 초기화한 뒤
   * 현재 권한 기준으로 다시 배정한다. 진행중·제출·확정 평가는 보존.
   * (기본 false = 멱등 추가 배정: 기존 배정은 그대로 두고 누락분만 채움.)
   */
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}

export class AddCommentDto {
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsString()
  content!: string;
}

export class ListEvaluationsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() evaluatorId?: string;
  @IsOptional() @IsString() evaluateeId?: string;
  @IsOptional() @IsEnum(EvaluationType) type?: EvaluationType;
  @IsOptional() @IsEnum(EvaluationStatus) status?: EvaluationStatus;
}

/** 부서별 등급 분포 집계 쿼리. */
export class GradeDistributionQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() groupId?: string;
}
