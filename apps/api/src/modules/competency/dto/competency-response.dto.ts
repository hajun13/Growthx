import { ApiProperty } from '@nestjs/swagger';
import { Grade } from '@prisma/client';

/**
 * 역량평가 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 CompetencyService.toQuestionDto / toResponseDto 반환과 일치.
 * 역량평가는 참고용(연봉·등급 미반영).
 */

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

  @ApiProperty({ description: '카테고리(리더십/협업/전문성/혁신)' })
  category!: string;

  @ApiProperty({
    type: [String],
    description: '문항별 5지선다 보기([]=레거시/폴백, 값 있으면 5개)',
  })
  options!: string[];

  @ApiProperty({ description: '% 가중치(참고용 — 연봉 미반영)' })
  weight!: number;

  @ApiProperty({ description: '적용 직급(전 직급/팀장 이상/본부장 이상)' })
  appliedLevel!: string;

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

/** 문항 삭제 결과. */
export class CompetencyQuestionDeleteResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deleted!: boolean;
}
