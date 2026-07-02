import { IsIn, IsOptional, IsString } from 'class-validator';
import { Grade } from '@prisma/client';

export class ListResultsQuery {
  @IsOptional() @IsString() cycleId?: string;
  @IsOptional() @IsString() userId?: string;

  // 선택 필터(없으면 기존 동작 유지 — 전체). 스냅샷/조인 기준 where.
  /** 본부 스냅샷(divisionIdSnapshot) 필터. */
  @IsOptional() @IsString() divisionId?: string;
  /** 팀 스냅샷(teamIdSnapshot) 필터. */
  @IsOptional() @IsString() teamId?: string;
  /** 직급(user.position = PositionDef.code) 필터. */
  @IsOptional() @IsString() position?: string;
  /** 최종 등급(S~D) 필터. */
  @IsOptional() @IsIn(['S', 'A', 'B', 'C', 'D']) grade?: Grade;
}

export class ResultDetailQuery {
  @IsString()
  cycleId!: string;
}

/** 평가자정리 표 — 사이클별 다단계 평가 요약(1차/2차/최종 × 실적/역량 + 합산 + 최종). */
export class SummaryTableQuery {
  @IsString()
  cycleId!: string;
}

/**
 * 등급 분포 필터 쿼리 (GET /results/distribution).
 * cycleId 필수 + 선택 필터(그룹/본부/팀/직급/등급). 스냅샷 필드·user.position·finalGrade 기준.
 */
export class DistributionQuery {
  @IsString()
  cycleId!: string;

  /** 그룹 스냅샷(groupIdSnapshot) 필터. */
  @IsOptional() @IsString() groupId?: string;
  /** 본부 스냅샷(divisionIdSnapshot) 필터. */
  @IsOptional() @IsString() divisionId?: string;
  /** 팀 스냅샷(teamIdSnapshot) 필터. */
  @IsOptional() @IsString() teamId?: string;
  /** 직급(user.position = PositionDef.code) 필터. */
  @IsOptional() @IsString() position?: string;
  /** 최종 등급(S~D) 필터 — 지정 시 해당 등급만 카운트(총계는 전체 유지). */
  @IsOptional() @IsIn(['S', 'A', 'B', 'C', 'D']) grade?: Grade;
}

export class AggregateResultDto {
  @IsString()
  cycleId!: string;

  @IsString()
  userId!: string;
}

/** M3 Item 9: 개인 평가 결과 내보내기. */
export class ExportResultQuery {
  @IsString()
  cycleId!: string;

  @IsOptional()
  @IsIn(['pdf', 'excel'])
  format?: 'pdf' | 'excel';
}
