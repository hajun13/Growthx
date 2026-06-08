import { Module } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { SchedulesService } from './schedules.service';
import { SnapshotsService } from './snapshots.service';
import { CycleLockService } from './cycle-lock.service';
import { CyclesController } from './cycles.controller';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [EvaluationsModule],
  controllers: [CyclesController],
  providers: [CyclesService, SchedulesService, SnapshotsService, CycleLockService],
  exports: [CycleLockService],
})
export class CyclesModule {}
