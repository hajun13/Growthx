import { Module } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { SchedulesService } from './schedules.service';
import { CycleLockService } from './cycle-lock.service';
import { CyclesController } from './cycles.controller';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService, SchedulesService, CycleLockService],
  exports: [CycleLockService],
})
export class CyclesModule {}
