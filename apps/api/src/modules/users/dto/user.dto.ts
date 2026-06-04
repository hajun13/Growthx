import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JobLevel, Position, Role, VisibilityScope } from '@prisma/client';

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

  @IsEnum(Position)
  position!: Position;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

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

  @IsOptional()
  @IsEnum(Position)
  position?: Position;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

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
