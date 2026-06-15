import { ApiProperty } from '@nestjs/swagger';

/**
 * 규칙 세트 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 RuleSetsService(get/list/create/update) 반환 = Prisma RuleSet 레코드와 일치.
 *
 * gradeScale·gradingScales·poolRatios·raiseRates·weightPolicy 는 DB의 Json 컬럼이라
 * 구조가 가변(설정 가능 RuleSet)이다 → OpenAPI 에서는 자유형(object/array, additionalProperties)로
 * 노출하고, 프론트는 @/lib/types 의 RuleSet 타입으로 정밀 형상을 보유한다.
 */
export class RuleSetDto {
  @ApiProperty()
  id!: string;

  /** 연결된 평가 주기 id(미연결이면 null). */
  @ApiProperty({ type: String, nullable: true })
  cycleId!: string | null;

  /** 등급 척도(S~D 점수 구간). 가변 JSON 배열. */
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: '등급 척도(S~D 점수 구간) — 설정 가능 JSON',
  })
  gradeScale!: unknown[];

  /** 측정방식별 달성률표(amount·rate). 가변 JSON 객체. */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '측정방식별 달성률 등급표(amount·rate) — 설정 가능 JSON',
  })
  gradingScales!: Record<string, unknown>;

  /** 그룹 등급 풀 비율(excellent·standard·poor tier). 가변 JSON 객체. */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '그룹 실적 tier별 등급 풀 비율 — 설정 가능 JSON',
  })
  poolRatios!: Record<string, unknown>;

  /** 등급별 인상률. 가변 JSON 객체. */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '등급별 인상률(S~D) — 설정 가능 JSON',
  })
  raiseRates!: Record<string, unknown>;

  /**
   * 가중치 정책 — 가중치 합·정성 상한·그룹실적 보너스/임계·매출 절대금액 등급표·
   * KPI 그룹 가중치·다단계 평가 가중치(stage/evaluator)·실적/역량 가중치 등을 포함하는
   * 통합 정책 객체. 가변 JSON.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '가중치·보너스·임계·다단계 가중치 통합 정책 — 설정 가능 JSON',
  })
  weightPolicy!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
