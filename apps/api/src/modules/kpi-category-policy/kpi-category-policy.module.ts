import { Module } from '@nestjs/common';
import { KpiCategoryPolicyService } from './kpi-category-policy.service';
import { KpiCategoryPolicyController } from './kpi-category-policy.controller';

@Module({
  controllers: [KpiCategoryPolicyController],
  providers: [KpiCategoryPolicyService],
  exports: [KpiCategoryPolicyService],
})
export class KpiCategoryPolicyModule {}
