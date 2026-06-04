import { Module } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { SchedulesService } from './schedules.service';
import { CyclesController } from './cycles.controller';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService, SchedulesService],
})
export class CyclesModule {}
