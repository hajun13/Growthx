import { Module } from '@nestjs/common';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';
import { KpiRevisionService } from './kpi-revision.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CyclesModule } from '../cycles/cycles.module';

@Module({
  imports: [NotificationsModule, CyclesModule],
  controllers: [KpisController],
  providers: [KpisService, KpiRevisionService],
  exports: [KpiRevisionService],
})
export class KpisModule {}
