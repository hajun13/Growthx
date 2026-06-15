import { ApiProperty } from '@nestjs/swagger';
import { EvaluationStatus, EvaluationType, Grade } from '@prisma/client';

/**
 * 평가 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope / @ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 EvaluationsService.toDto / list / getDetail 반환과 일치(camelCase).
 */
export class EvaluationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  evaluatorId!: string;

  @ApiProperty()
  evaluateeId!: string;

  @ApiProperty({ enum: EvaluationType, description: 'self | downward' })
  type!: EvaluationType;

  /** downward 다단계: 1=1차 팀장, 2=2차 본부장, 3=최종 그룹대표. self 는 null. */
  @ApiProperty({ type: Number, nullable: true })
  round!: number | null;

  @ApiProperty({ enum: EvaluationStatus })
  status!: EvaluationStatus;

  @ApiProperty({ type: Number, nullable: true })
  totalScore!: number | null;

  @ApiProperty({ enum: Grade, nullable: true })
  finalGrade!: Grade | null;

  /** B-3a: 평가자 수동 종합등급 오버라이드. 미설정 시 null. */
  @ApiProperty({ enum: Grade, nullable: true })
  overallGrade!: Grade | null;

  @ApiProperty({ type: String, nullable: true })
  overallReason!: string | null;

  /** B-3c: 피평가자 비정규화(없으면 null). */
  @ApiProperty({ type: String, nullable: true })
  userName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  evaluatorName!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 과제별 성과 점수 — 등급·점수는 백엔드 산정(EvaluationDetail.kpiScores[]). */
export class KpiScoreDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  evaluationId!: string;

  @ApiProperty()
  kpiId!: string;

  @ApiProperty({ type: Number, nullable: true })
  achievementRate!: number | null;

  /** 갭#2: 절대금액 모드(useAbsoluteAmount) KPI의 실제 매출 금액(원). 그 외는 null. */
  @ApiProperty({ type: Number, nullable: true })
  actualAmount!: number | null;

  @ApiProperty({ enum: Grade })
  grade!: Grade;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  weight!: number;

  /** 정성 KPI 서술 메모(self). amount/rate/count 는 null. */
  @ApiProperty({ type: String, nullable: true })
  selfNote!: string | null;

  /** 부서장(검토자) 문항별 평가 코멘트. 미작성 시 null. */
  @ApiProperty({ type: String, nullable: true })
  reviewerNote!: string | null;
}

/** 평가 코멘트. */
export class CommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  evaluationId!: string;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  quarter!: number;

  @ApiProperty()
  content!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** 평가 상세 — kpiScores[] + comments[] 포함(역량 items 없음). */
export class EvaluationDetailDto extends EvaluationDto {
  @ApiProperty({ type: [KpiScoreDto] })
  kpiScores!: KpiScoreDto[];

  @ApiProperty({ type: [CommentDto] })
  comments!: CommentDto[];
}

/** 문항별 증빙 첨부 메타데이터(바이트 제외). 본인평가 KPI 문항 단위. */
export class EvaluationEvidenceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  evaluationId!: string;

  @ApiProperty()
  kpiId!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  uploadedById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** 부서별 등급 분포 집계 행(그룹 등급 풀 화면 하단 테이블). */
export class GradeDistributionRowDto {
  @ApiProperty()
  deptId!: string;

  @ApiProperty()
  deptName!: string;

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

  @ApiProperty()
  total!: number;
}
