import { ApiProperty } from '@nestjs/swagger';
import {
  EvaluationStatus,
  Grade,
  VisibilityScope,
} from '@prisma/client';

/**
 * 대시보드 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다. 값 형태는 DashboardService 반환과 일치.
 */

/** 유형·round 별 진행률(제출/확정 현황). */
export class DashboardPhaseDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  submitted!: number;

  @ApiProperty()
  finalized!: number;

  @ApiProperty({ description: '제출률(%)' })
  rate!: number;
}

/** self·downward1·downward2 진행률 묶음. */
export class DashboardProgressDto {
  @ApiProperty({ type: DashboardPhaseDto })
  self!: DashboardPhaseDto;

  @ApiProperty({ type: DashboardPhaseDto })
  downward1!: DashboardPhaseDto;

  @ApiProperty({ type: DashboardPhaseDto })
  downward2!: DashboardPhaseDto;
}

/** 내가 평가자인 작업 현황. */
export class DashboardMyTasksDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  pending!: number;
}

/** 등급별 카운트(S/A/B/C/D). */
export class GradeCountsDto {
  @ApiProperty()
  S!: number;

  @ApiProperty()
  A!: number;

  @ApiProperty()
  B!: number;

  @ApiProperty()
  C!: number;

  @ApiProperty()
  D!: number;
}

/** 그룹별 등급 분포. */
export class GroupGradeDistributionDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty({ type: GradeCountsDto })
  grades!: GradeCountsDto;
}

/** 전사·그룹별 등급 분포 묶음. */
export class GradeDistributionDto {
  @ApiProperty({ type: GradeCountsDto })
  company!: GradeCountsDto;

  @ApiProperty({ type: [GroupGradeDistributionDto] })
  byGroup!: GroupGradeDistributionDto[];
}

/** 이의제기 상태별 현황. */
export class DashboardAppealsDto {
  @ApiProperty()
  submitted!: number;

  @ApiProperty()
  under_review!: number;

  @ApiProperty()
  answered!: number;

  @ApiProperty()
  closed!: number;

  @ApiProperty()
  total!: number;
}

/** self(팀원) 본인 평가 상태 + 결과 요약. */
export class DashboardMeDto {
  @ApiProperty({ enum: EvaluationStatus })
  selfStatus!: EvaluationStatus;

  @ApiProperty()
  selfSubmitted!: boolean;

  @ApiProperty()
  hasResult!: boolean;

  @ApiProperty({ enum: Grade, nullable: true })
  finalGrade!: Grade | null;

  @ApiProperty({ type: Number, nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  percentile!: number | null;
}

/** 그룹 등급 카드(누적 달성률 → 현재 등급). */
export class GroupGradeCardDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  groupName!: string;

  @ApiProperty({ enum: Grade, nullable: true })
  currentGrade!: Grade | null;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;
}

/** 팀 목표 카드(본인 부서 목표·실적·달성률·등급). */
export class TeamGoalDto {
  @ApiProperty()
  departmentId!: string;

  @ApiProperty()
  targetAmount!: number;

  @ApiProperty()
  actualAmount!: number;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ enum: Grade, nullable: true })
  currentGrade!: Grade | null;
}

/** 월별 누적 달성률 추이. */
export class TrendPointDto {
  @ApiProperty()
  month!: number;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ enum: Grade, nullable: true })
  grade!: Grade | null;
}

/** GET /dashboard/summary 응답 본문. */
export class DashboardSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  cycleId!: string | null;

  @ApiProperty({ required: false })
  cycleName?: string;

  @ApiProperty({ required: false })
  cycleStatus?: string;

  @ApiProperty({ enum: VisibilityScope })
  scope!: VisibilityScope;

  @ApiProperty()
  scopeLabel!: string;

  @ApiProperty({ type: DashboardProgressDto })
  progress!: DashboardProgressDto;

  @ApiProperty({ type: DashboardMyTasksDto })
  myTasks!: DashboardMyTasksDto;

  @ApiProperty({ type: GradeDistributionDto })
  gradeDistribution!: GradeDistributionDto;

  @ApiProperty()
  unsubmittedCount!: number;

  @ApiProperty({ type: DashboardAppealsDto })
  appeals!: DashboardAppealsDto;

  @ApiProperty({ type: Number, nullable: true })
  avgRaiseRate!: number | null;

  @ApiProperty({ type: DashboardMeDto, nullable: true })
  me!: DashboardMeDto | null;

  @ApiProperty({ type: [GroupGradeCardDto] })
  groupGrades!: GroupGradeCardDto[];

  @ApiProperty({ type: TeamGoalDto, nullable: true })
  teamGoal!: TeamGoalDto | null;

  @ApiProperty({ type: [TrendPointDto] })
  monthlyTrend!: TrendPointDto[];
}

/** GET /dashboard/company-achievement 응답 본문. */
export class CompanyAchievementDto {
  @ApiProperty({ type: String, nullable: true })
  cycleId!: string | null;

  @ApiProperty()
  groupCount!: number;

  @ApiProperty()
  totalTarget!: number;

  @ApiProperty()
  totalActual!: number;

  @ApiProperty()
  achievementRate!: number;

  @ApiProperty({ description: '비 hr_admin 은 본인 그룹 범위만 집계됨' })
  scopedToGroup!: boolean;
}
