import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** 감사 로그 기록 서비스를 전역 제공. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
