import { ApiProperty } from '@nestjs/swagger';
import {
  EmploymentStatus,
  JobLevel,
  LegalEntity,
  Role,
  VisibilityScope,
} from '@prisma/client';

/**
 * 사용자 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope/@ApiOkEnvelopeArray)로 감싸진다.
 * 값 형태는 users.serializer.ts 의 toUserDto() 반환과 1:1 일치(민감 필드 제외).
 */
export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  /** 직급 코드(PositionDef.code). enum 폐기 후 관리형 레지스트리 문자열. */
  @ApiProperty()
  position!: string;

  @ApiProperty({ enum: JobLevel, nullable: true })
  jobLevel!: JobLevel | null;

  @ApiProperty({ type: String, nullable: true })
  departmentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  managerId!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  currentSalary!: number | null;

  /** 초기 비밀번호(1234) 강제 변경 플래그. */
  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({ enum: VisibilityScope })
  visibilityScope!: VisibilityScope;

  @ApiProperty()
  isActive!: boolean;

  /** 4대보험 소속(법인). */
  @ApiProperty({ enum: LegalEntity })
  legalEntity!: LegalEntity;

  /** 재직 상태(active·on_leave·resigned). */
  @ApiProperty({ enum: EmploymentStatus })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  resignedAt!: string | null;

  /** 평가 제외(재직 중이나 이번 평가 대상 아님). */
  @ApiProperty()
  evaluationExempt!: boolean;

  @ApiProperty({ type: String, nullable: true })
  evaluationExemptReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

/** 하드 삭제(기본) 결과 — 이력 0인 안전 삭제. */
export class DeleteUserResultDto {
  @ApiProperty()
  id!: string;

  /** 완전 삭제(force=true)일 때만 true. 기본 삭제 응답에는 없음. */
  @ApiProperty({ required: false })
  purged?: boolean;
}
