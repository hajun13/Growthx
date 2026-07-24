import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  /** 이 KPI를 무엇을·왜 조정했는지 조정 코멘트(선택). MidtermKpiCheckIn.memberNote 로 저장·이력 노출. */
  @ApiPropertyOptional({ description: '이 KPI를 무엇을·왜 조정했는지 조정 코멘트.' })
  @IsOptional()
  @IsString()
  comment?: string;
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

/**
 * 수정안 임시저장(제출 아님) 요청. 필드는 제출 DTO와 같은 모양이다 —
 * 저장한 값을 그대로 다시 화면에 채우고, 이어서 제출까지 하는 흐름이라
 * 두 벌의 형태를 따로 두면 복원할 때 서로 어긋난다.
 * 제출과 달리 "변경 0건" 검사·가중치 100% 검사는 하지 않는다(작성 도중의 값도 보관해야 한다).
 */
export class SaveMidtermRevisionDraftDto {
  @ApiPropertyOptional({ type: [MidtermRevisionItemDto] })
  @IsOptional()
  @IsArray()
  // 한 사람의 KPI는 많아야 수십 건이다. 상한을 두어 JSON 컬럼이 무한정 커지는 것만 막는다.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MidtermRevisionItemDto)
  items?: MidtermRevisionItemDto[];

  @ApiPropertyOptional({ description: '작성 중인 회신 사유(제출 전이라 비어 있어도 된다).' })
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
