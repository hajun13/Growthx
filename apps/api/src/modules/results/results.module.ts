import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ComparisonService } from './comparison.service';
import { ResultsController } from './results.controller';
import { ExcelModule } from '../excel/excel.module';

@Module({
  imports: [ExcelModule],
  controllers: [ResultsController],
  providers: [ResultsService, ComparisonService],
})
export class ResultsModule {}
