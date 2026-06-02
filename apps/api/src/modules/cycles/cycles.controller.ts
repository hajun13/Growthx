import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CyclesService } from './cycles.service';
import {
  CreateCycleDto,
  ListCyclesQuery,
  UpdateCycleStatusDto,
} from './dto/cycle.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  list(@Query() query: ListCyclesQuery) {
    return this.cyclesService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cyclesService.get(id);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateCycleDto) {
    return this.cyclesService.create(dto);
  }

  @Patch(':id/status')
  @Roles(Role.hr_admin)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCycleStatusDto) {
    return this.cyclesService.updateStatus(id, dto);
  }
}
