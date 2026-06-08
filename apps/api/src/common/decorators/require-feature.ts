import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../../modules/permissions/perm-config.constants';

/**
 * @RequireFeature(key) — 권한 매트릭스(PermissionConfig.matrix)로 추가 차단.
 * FeatureGuard 가 핸들러/클래스 메타데이터를 읽어 levelOf(role,scope) 기준
 * matrix[level][key]===false 면 403 FEATURE_DENIED.
 * (RolesGuard 가 상한 — 이 데코레이터는 role 범위 안에서 추가 차단만 한다.)
 */
export const REQUIRE_FEATURE_KEY = 'require_feature';
export const RequireFeature = (key: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, key);
