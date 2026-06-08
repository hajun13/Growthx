import { IsArray, IsOptional, IsString } from 'class-validator';

/** Cycle Ops §4: KPI 스냅샷 생성 요청. */
export class CreateSnapshotDto {
  /** 예: "1차 확정". */
  @IsString()
  label!: string;

  /** 생략 시: 해당 cycle에서 KPI를 가진 모든 사용자 대상. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}
