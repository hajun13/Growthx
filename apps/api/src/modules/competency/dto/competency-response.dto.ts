import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';

/**
 * 역량평가 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 CompetencyService.toQuestionDto / toResponseDto 반환과 일치.
 * 역량평가는 참고용(연봉·등급 미반영).
 */

/** 역량평가 카테고리 — listCategories/createCategory/updateCategory 반환 단위(글로벌·사이클 독립). */
export class CompetencyCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: '표시 순서(오름차순)' })
  order!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 역량평가 문항(질문) — listQuestions/createQuestion/updateQuestion 반환 단위. */
export class CompetencyQuestionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({ description: '표시 순서(오름차순)' })
  order!: number;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: String, nullable: true, description: '문항 보조 설명' })
  hint!: string | null;

  @ApiProperty({ description: '카테고리 ID(CompetencyCategory.id)' })
  categoryId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '카테고리 이름(join 결과, 미join 시 null)',
  })
  categoryName!: string | null;

  @ApiProperty({
    type: [String],
    description: '문항별 5지선다 보기([]=레거시/폴백, 값 있으면 5개)',
  })
  options!: string[];

  @ApiProperty({ description: '% 가중치(참고용 — 연봉 미반영)' })
  weight!: number;

  @ApiProperty({
    enum: ['all', 'manager', 'non_manager'],
    description: '적용 대상(all=전 임직원/manager=직책자/non_manager=비직책자)',
  })
  targetGroup!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 역량평가 응답 — listResponses/bulkRespond 반환 단위. */
export class CompetencyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  cycleId!: string;

  @ApiProperty({
    enum: ['self', 'round1', 'round2', 'round3'],
    description: '평가 단계 열(본인/1차/2차/최종)',
  })
  stage!: string;

  @ApiProperty({ description: '이 행을 작성한 평가자 id(본인평가는 userId 와 동일)' })
  evaluatorId!: string;

  @ApiProperty({ enum: Grade, description: '등급(S/A/B/C/D)' })
  grade!: Grade;

  @ApiProperty({ type: String, nullable: true, description: '평가 근거' })
  comment!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date-time',
    description: '최종 제출 시각(임시저장이면 null)',
  })
  submittedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** 역량평가서 평가선 슬롯(1차/2차/최종) — 미지정 계층은 userId/name null. */
export class CompetencyChainSlotDto {
  @ApiProperty({ enum: ['round1', 'round2', 'round3'] })
  stage!: string;

  @ApiProperty({ type: String, nullable: true })
  userId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;
}

/** 역량평가서 피평가자 요약. */
export class CompetencySheetEvaluateeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: String, nullable: true })
  position!: string | null;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;
}

/** 종합의견(평가자 단계별 자유 서술). */
export class CompetencyOpinionDto {
  @ApiProperty({ enum: ['round1', 'round2', 'round3'] })
  stage!: string;

  @ApiProperty()
  evaluatorId!: string;

  @ApiProperty({ type: String, nullable: true })
  evaluatorName!: string | null;

  @ApiProperty()
  comment!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/**
 * 평가점수 환산 — 평가자별 100점 환산 + 결합 점수.
 * 결합 = 1차 50%·2차 30%·최종 20%(RuleSet 설정) + 평가자 동일인 예외①②.
 * 본인(self)은 참고 표기(결합 미반영).
 */
export class CompetencyConversionDto {
  @ApiProperty({ type: Number, nullable: true })
  self!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  round1!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  round2!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  round3!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: '평가점수 환산(결합)' })
  combined!: number | null;

  @ApiProperty({ enum: ['normal', 'exception1', 'exception2'] })
  mode!: string;
}

/** 역량평가서(시트) — 엑셀 역량평가서 재현에 필요한 데이터 일체. */
export class CompetencySheetDto {
  @ApiProperty()
  cycleId!: string;

  @ApiProperty()
  cycleStatus!: string;

  @ApiProperty({ type: CompetencySheetEvaluateeDto })
  evaluatee!: CompetencySheetEvaluateeDto;

  @ApiProperty({ type: [CompetencyChainSlotDto], description: '평가선(1차/2차/최종)' })
  chain!: CompetencyChainSlotDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    enum: ['self', 'round1', 'round2', 'round3'],
    description: '내가 쓸 수 있는 열(null=열람 전용)',
  })
  myStage!: string | null;

  @ApiProperty({ description: '작성 가능 여부(내 열 존재 + 최종평가 단계)' })
  canEdit!: boolean;

  @ApiProperty({ description: '평가자 열·종합의견·환산 공개 여부(본인 조기열람 게이트)' })
  scoresVisible!: boolean;

  @ApiProperty({ type: [CompetencyQuestionDto] })
  questions!: CompetencyQuestionDto[];

  @ApiProperty({ type: [CompetencyResponseDto] })
  responses!: CompetencyResponseDto[];

  @ApiProperty({ type: [CompetencyOpinionDto] })
  opinions!: CompetencyOpinionDto[];

  @ApiProperty({ type: CompetencyConversionDto, nullable: true })
  conversion!: CompetencyConversionDto | null;
}

/** 내가 평가자로 배정된 역량평가 대상(하향 평가 배정과 동일 평가선). */
export class CompetencyTargetDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  departmentName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  position!: string | null;

  @ApiProperty({ enum: ['round1', 'round2', 'round3'], description: '내 평가 단계' })
  myStage!: string;

  @ApiProperty({ description: '대상 문항 수(대상군 기준)' })
  questionCount!: number;

  @ApiProperty({ description: '내 열 응답 수' })
  answeredCount!: number;

  @ApiProperty({ description: '내 열 제출 완료 여부' })
  submitted!: boolean;
}

/** 문항 삭제 결과. */
export class CompetencyQuestionDeleteResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;
}

/** 카테고리 삭제 결과. */
export class CompetencyCategoryDeleteResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;
}
