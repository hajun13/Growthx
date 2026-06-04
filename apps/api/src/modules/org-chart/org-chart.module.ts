import { Module } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';
import { OrgChartController } from './org-chart.controller';

@Module({
  controllers: [OrgChartController],
  providers: [OrgChartService],
})
export class OrgChartModule {}
