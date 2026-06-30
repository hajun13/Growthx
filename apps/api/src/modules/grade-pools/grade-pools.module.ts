import { Module } from '@nestjs/common';
import { GradePoolsService } from './grade-pools.service';
import { GradePoolsController } from './grade-pools.controller';
import { GroupPerformanceModule } from '../group-performance/group-performance.module';

@Module({
  imports: [GroupPerformanceModule],
  controllers: [GradePoolsController],
  providers: [GradePoolsService],
})
export class GradePoolsModule {}
