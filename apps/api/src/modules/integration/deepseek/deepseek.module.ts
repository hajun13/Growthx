import { Module } from '@nestjs/common';
import { DeepseekClient } from './deepseek.client';
import { KpiParseAgent } from './kpi-parse.agent';

@Module({
  providers: [DeepseekClient, KpiParseAgent],
  exports: [KpiParseAgent],
})
export class DeepseekModule {}
