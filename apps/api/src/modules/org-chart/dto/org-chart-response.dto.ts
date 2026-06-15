import { ApiProperty } from '@nestjs/swagger';

/**
 * 조직도 노드 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 값 형태는 OrgChartService.getChart 반환(OrgChartNode 트리)과 일치.
 * 실제 응답은 단건 봉투(@ApiOkEnvelope)로 감싸진 회사 가상 루트 1개.
 * children 은 자기 자신을 참조하는 재귀 트리(그룹→본부→팀).
 */
export class OrgChartNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  /** 부서 유형(group·division·team). */
  @ApiProperty({ enum: ['group', 'division', 'team'] })
  type!: 'group' | 'division' | 'team';

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  /** 명시적으로 지정된 부서장(그룹장·본부장·팀장) id. null=자동 추론. */
  @ApiProperty({ type: String, nullable: true })
  headUserId!: string | null;

  /** 지정된 부서장 이름(표시용). */
  @ApiProperty({ type: String, nullable: true })
  headName!: string | null;

  /** 이 노드에 직접 소속된(직속) 활성 인원 수. */
  @ApiProperty()
  directCount!: number;

  /** 이 노드 + 하위 전체 활성 인원 수. */
  @ApiProperty()
  totalCount!: number;

  /** 하위 노드(재귀 트리). */
  @ApiProperty({ type: () => [OrgChartNodeDto] })
  children!: OrgChartNodeDto[];
}
