import { Module } from '@nestjs/common';
import { CompensationsService } from './compensations.service';
import { CompensationAdjustmentService } from './compensation-adjustment.service';
import { CompensationsController } from './compensations.controller';

@Module({
  controllers: [CompensationsController],
  providers: [CompensationsService, CompensationAdjustmentService],
  exports: [CompensationsService],
})
export class CompensationsModule {}
