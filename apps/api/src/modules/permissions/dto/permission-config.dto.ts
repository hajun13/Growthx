import { IsObject, IsOptional } from 'class-validator';

/**
 * PUT /permissions/config body.
 * matrix:        Record<PermLevel, Record<FeatureKey, boolean>>
 * navVisibility: Record<PermLevel, Record<navKey, boolean>>
 * 부분 허용 — 서비스에서 기본값과 머지(누락 레벨/키 보강).
 */
export class UpdatePermissionConfigDto {
  @IsOptional()
  @IsObject()
  matrix?: Record<string, Record<string, boolean>>;

  @IsOptional()
  @IsObject()
  navVisibility?: Record<string, Record<string, boolean>>;
}
