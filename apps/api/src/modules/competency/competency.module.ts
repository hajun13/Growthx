import { Module } from '@nestjs/common';
import { CompetencyService } from './competency.service';
import { CompetencySheetService } from './competency-sheet.service';
import { CompetencyController } from './competency.controller';

@Module({
  controllers: [CompetencyController],
  providers: [CompetencyService, CompetencySheetService],
  // CompetencySheetService: 결과 집계(results)가 역량 결합 환산 점수를 재사용.
  exports: [CompetencyService, CompetencySheetService],
})
export class CompetencyModule {}
