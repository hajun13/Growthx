import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

/**
 * 권한 설정 모듈. 전역(@Global) — FeatureGuard 가 전역 가드로 PermissionsService 를 주입받기 때문.
 */
@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
