import { Module } from '@nestjs/common';
import { RulesModule } from '../../common/rules/rules.module';
import { MonthlyPerformanceService } from './monthly-performance.service';
import { FinancialPerformanceService } from './financial-performance.service';
import { MonthlyPerformanceController } from './monthly-performance.controller';

@Module({
  imports: [RulesModule],
  controllers: [MonthlyPerformanceController],
  providers: [MonthlyPerformanceService, FinancialPerformanceService],
  exports: [MonthlyPerformanceService, FinancialPerformanceService],
})
export class MonthlyPerformanceModule {}
