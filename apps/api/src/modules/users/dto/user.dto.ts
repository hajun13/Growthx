import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { JobLevel, Role, VisibilityScope } from '@prisma/client';

/**
 * M3 조직도: 사람 추가. password 미지정 시 초기비번 1234 + mustChangePassword=true.
 * role/visibilityScope 미지정 시 직급 자동기본.
 */
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // 직급 코드(PositionDef.code). 존재성은 서비스에서 레지스트리 조회로 검증(없으면 400).
  @IsString()
  @IsNotEmpty()
  position!: string;

  // 무소속 허용: null 허용·빈 문자열 거부. (계약 A-1)
  @IsOptional()
  @ValidateIf((o) => o.departmentId !== null)
  @IsString()
  @IsNotEmpty()
  departmentId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.managerId !== null)
  @IsString()
  @IsNotEmpty()
  managerId?: string | null;

  @IsOptional()
  @IsEnum(JobLevel)
  jobLevel?: JobLevel;

  @IsOptional()
  @IsEnum(VisibilityScope)
  visibilityScope?: VisibilityScope;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // 직급 코드(PositionDef.code). 수정 시에도 서비스에서 레지스트리 검증.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  position?: string;

  // 무소속 해제: 명시적 null 로 소속/관리자 해제 가능(undefined=변경없음). (계약 A-1)
  @IsOptional()
  @ValidateIf((o) => o.departmentId !== null)
  @IsString()
  @IsNotEmpty()
  departmentId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.managerId !== null)
  @IsString()
  @IsNotEmpty()
  managerId?: string | null;

  @IsOptional()
  @IsEnum(JobLevel)
  jobLevel?: JobLevel;

  @IsOptional()
  @IsEnum(VisibilityScope)
  visibilityScope?: VisibilityScope;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** M3 Item 8: 현재 연봉 입력(hr_admin). */
export class UpdateSalaryDto {
  @IsNumber()
  @Min(0)
  currentSalary!: number;
}

export class ListUsersQuery {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /** 'true' 면 비활성 포함(기본 활성만). */
  @IsOptional()
  @IsString()
  includeInactive?: string;
}

/** 하드 삭제 쿼리 — force=true 면 이력 포함 완전 삭제(cascade). */
export class DeleteUserQuery {
  /** 'true' 면 평가 이력 포함 트랜잭션 cascade 삭제. 미지정/그 외=기본(이력 있으면 차단). */
  @IsOptional()
  @IsString()
  force?: string;
}
