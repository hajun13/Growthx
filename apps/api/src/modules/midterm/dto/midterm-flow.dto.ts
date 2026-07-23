import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * 중간점검 2단계 흐름(2026-07-23) 요청 DTO.
 * 레거시 자가점검 DTO(midterm.dto.ts)와 분리해 둔다 — 두 흐름이 한동안 공존하므로
 * 한 파일에 섞으면 어느 쪽 필드인지 읽는 사람이 구분하기 어렵다.
 */

/** 1차 평가자의 KPI별 코멘트. */
export class MidtermKpiCommentDto {
  @ApiProperty() @IsString() kpiId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional({ enum: ['accepted', 'rebaseline'] })
  @IsOptional()
  @IsIn(['accepted', 'rebaseline'])
  decision?: 'accepted' | 'rebaseline';
}

export class CommentMidtermDto {
  @ApiPropertyOptional() @IsOptional() @IsString() overallComment?: string;
  @ApiPropertyOptional({ type: [MidtermKpiCommentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MidtermKpiCommentDto)
  kpiComments?: MidtermKpiCommentDto[];
}

/** 임직원 수정안 1건. 값이 없는 필드는 '변경 없음'. */
export class MidtermRevisionItemDto {
  @ApiProperty() @IsString() kpiId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() targetValue?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() targetText?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) weight?: number;
}

export class SubmitMidtermRevisionDto {
  @ApiPropertyOptional({ type: [MidtermRevisionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MidtermRevisionItemDto)
  items?: MidtermRevisionItemDto[];

  @ApiPropertyOptional({ description: '회신 사유. 변경 0건이면 필수.' })
  @IsOptional()
  @IsString()
  memberNote?: string;
}

export class DecideMidtermDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
}

export class OpenMidtermDto {
  @ApiProperty() @IsString() cycleId!: string;
  @ApiPropertyOptional({ description: 'true 면 미리보기만(생성하지 않음).' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
