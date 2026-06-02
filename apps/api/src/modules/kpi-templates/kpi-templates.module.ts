import { Module } from '@nestjs/common';
import { KpiTemplatesService } from './kpi-templates.service';
import { KpiTemplatesController } from './kpi-templates.controller';

@Module({
  controllers: [KpiTemplatesController],
  providers: [KpiTemplatesService],
})
export class KpiTemplatesModule {}
