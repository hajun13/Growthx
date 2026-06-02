import { Module } from '@nestjs/common';
import { GroupPerformanceService } from './group-performance.service';
import { GroupPerformanceController } from './group-performance.controller';

@Module({
  controllers: [GroupPerformanceController],
  providers: [GroupPerformanceService],
})
export class GroupPerformanceModule {}
