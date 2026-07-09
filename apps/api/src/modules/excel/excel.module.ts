import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelController } from './excel.controller';
import { CompensationsModule } from '../compensations/compensations.module';
import { DeepseekModule } from '../integration/deepseek/deepseek.module';

@Module({
  imports: [CompensationsModule, DeepseekModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
