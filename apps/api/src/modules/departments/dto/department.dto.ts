import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DepartmentType } from '@prisma/client';

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsEnum(DepartmentType)
  type!: DepartmentType;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** 부서 이동: 새 상위 부서 id. 계층 정합(본부→그룹, 팀→본부)·순환은 서비스가 검증. */
  @IsOptional()
  @IsString()
  parentId?: string;

  /** 부서장 지정: 사용자 id. 빈 문자열이면 지정 해제(자동 추론으로 복귀). */
  @IsOptional()
  @IsString()
  headUserId?: string;

  /**
   * 부(副)그룹장 지정(group 전용): 사용자 id. 빈 문자열이면 해제.
   * 지정 시 다단계 하향평가에서 팀장(2차)·본부장(1차)의 중간 평가자가 된다.
   */
  @IsOptional()
  @IsString()
  deputyHeadUserId?: string;
}

export class ListDepartmentsQuery {
  @IsOptional()
  @IsEnum(DepartmentType)
  type?: DepartmentType;

  @IsOptional()
  @IsString()
  tree?: string;
}
