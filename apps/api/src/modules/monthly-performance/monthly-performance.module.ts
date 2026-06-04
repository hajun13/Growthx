import { Module } from '@nestjs/common';
import { MonthlyPerformanceService } from './monthly-performance.service';
import { MonthlyPerformanceController } from './monthly-performance.controller';

@Module({
  controllers: [MonthlyPerformanceController],
  providers: [MonthlyPerformanceService],
  exports: [MonthlyPerformanceService],
})
export class MonthlyPerformanceModule {}
