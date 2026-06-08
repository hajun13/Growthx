import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { JobLevel, Role, VisibilityScope } from '@prisma/client';

/** 직급(PositionDef) 추가. code 생략 시 서버가 label 슬러그화로 생성. (계약 B-8) */
export class CreatePositionDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsBoolean()
  isManagement?: boolean;

  @IsEnum(Role)
  defaultRole!: Role;

  @IsEnum(VisibilityScope)
  defaultScope!: VisibilityScope;

  // null=미지정 허용. 생략(undefined)도 미지정.
  @IsOptional()
  @IsEnum(JobLevel)
  defaultJobLevel?: JobLevel | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // 제공 시 ^[a-z][a-z0-9_]*$. 시스템/기존 코드 충돌 시 409(서비스).
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'code 는 소문자로 시작하고 영문 소문자·숫자·_ 만 사용할 수 있어요.',
  })
  code?: string;
}

/** 직급 수정(부분). code·isSystem 변경 불가(무시). (계약 B-8) */
export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isManagement?: boolean;

  @IsOptional()
  @IsEnum(Role)
  defaultRole?: Role;

  @IsOptional()
  @IsEnum(VisibilityScope)
  defaultScope?: VisibilityScope;

  @IsOptional()
  @IsEnum(JobLevel)
  defaultJobLevel?: JobLevel | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListPositionsQuery {
  /** 'true' 면 비활성 포함(기본 활성만). */
  @IsOptional()
  @IsString()
  includeInactive?: string;
}
