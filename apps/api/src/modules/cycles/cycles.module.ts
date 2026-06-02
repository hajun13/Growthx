import { Module } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { CyclesController } from './cycles.controller';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService],
})
export class CyclesModule {}
