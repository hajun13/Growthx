import { Module } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CyclesModule } from '../cycles/cycles.module';
import { KpiCategoryPolicyModule } from '../kpi-category-policy/kpi-category-policy.module';

@Module({
  imports: [NotificationsModule, CyclesModule, KpiCategoryPolicyModule],
  controllers: [KpisController],
  providers: [KpisService],
})
export class KpisModule {}
