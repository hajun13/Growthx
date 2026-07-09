import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ExcelModule } from '../excel/excel.module';
import { CompetencyModule } from '../competency/competency.module';

@Module({
  imports: [ExcelModule, CompetencyModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
