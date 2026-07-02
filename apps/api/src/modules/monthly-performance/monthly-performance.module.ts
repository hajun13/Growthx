import { Module } from '@nestjs/common';
import { RulesModule } from '../../common/rules/rules.module';
import { GroupPerformanceModule } from '../group-performance/group-performance.module';
import { MonthlyPerformanceService } from './monthly-performance.service';
import { FinancialPerformanceService } from './financial-performance.service';
import { MonthlyPerformanceController } from './monthly-performance.controller';

@Module({
  // GroupPerformanceModule: finalize 후 그룹 실적 캐시를 final 행 기준으로 재동기화.
  imports: [RulesModule, GroupPerformanceModule],
  controllers: [MonthlyPerformanceController],
  providers: [MonthlyPerformanceService, FinancialPerformanceService],
  exports: [MonthlyPerformanceService, FinancialPerformanceService],
})
export class MonthlyPerformanceModule {}
