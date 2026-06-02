import { Module } from '@nestjs/common';
import { GradePoolsService } from './grade-pools.service';
import { GradePoolsController } from './grade-pools.controller';

@Module({
  controllers: [GradePoolsController],
  providers: [GradePoolsService],
})
export class GradePoolsModule {}
