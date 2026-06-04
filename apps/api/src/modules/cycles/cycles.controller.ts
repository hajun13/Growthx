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
import { SchedulesService } from './schedules.service';
import {
  CreateCycleDto,
  ListCyclesQuery,
  UpdateCycleStatusDto,
} from './dto/cycle.dto';
import { UpsertSchedulesDto } from './dto/schedule.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('cycles')
export class CyclesController {
  constructor(
    private readonly cyclesService: CyclesService,
    private readonly schedulesService: SchedulesService,
  ) {}

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

  // ── B-2: 주기 단계별 일정·대상자·알림 설정 ──
  @Get(':id/schedules')
  listSchedules(@Param('id') id: string) {
    return this.schedulesService.list(id);
  }

  @Patch(':id/schedules')
  @Roles(Role.hr_admin)
  upsertSchedules(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertSchedulesDto,
  ) {
    return this.schedulesService.upsert(id, dto, user);
  }
}
