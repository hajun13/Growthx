import { ApiProperty } from '@nestjs/swagger';

/**
 * 권한 설정 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다. 값 형태는 PermissionsService.resolve()
 * (= getConfig·update 반환 ResolvedConfig)와 일치.
 *
 * matrix·navVisibility 는 둘 다 동적 키 2단 중첩 맵이라 구체 프로퍼티 대신
 * additionalProperties 로 표현한다.
 *   matrix:        Record<PermLevel, Record<FeatureKey, boolean>>
 *   navVisibility: Record<PermLevel, Record<navKey, boolean>>
 */
export class PermissionConfigDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
    description:
      '권한 레벨(hr·group·division·team·member)별 허용 기능 매트릭스. Record<PermLevel, Record<FeatureKey, boolean>>',
  })
  matrix!: Record<string, Record<string, boolean>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
    description:
      '권한 레벨별 사이드바 nav 가시성. Record<PermLevel, Record<navKey, boolean>>',
  })
  navVisibility!: Record<string, Record<string, boolean>>;
}
