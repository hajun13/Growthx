import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CyclesService } from './cycles.service';
import { SchedulesService } from './schedules.service';
import { SnapshotsService } from './snapshots.service';
import {
  CreateCycleDto,
  ListCyclesQuery,
  UpdateCycleDto,
  UpdateCycleStatusDto,
} from './dto/cycle.dto';
import { SetScheduleLockDto, UpsertSchedulesDto } from './dto/schedule.dto';
import { CreateSnapshotDto } from './dto/snapshot.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('cycles')
export class CyclesController {
  constructor(
    private readonly cyclesService: CyclesService,
    private readonly schedulesService: SchedulesService,
    private readonly snapshotsService: SnapshotsService,
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

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(@Param('id') id: string, @Body() dto: UpdateCycleDto) {
    return this.cyclesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.hr_admin)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCycleStatusDto) {
    return this.cyclesService.updateStatus(id, dto);
  }

  // 주기 삭제 — 완료(closed) 주기는 서비스에서 거부. 연관 데이터 일괄 정리.
  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cyclesService.remove(id, user);
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

  // ── M3 Item 5: 평가 기간 잠금/열기 + 현재 단계 ──
  @Patch(':id/schedules/:phase')
  @Roles(Role.hr_admin)
  setScheduleLock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('phase') phase: string,
    @Body() dto: SetScheduleLockDto,
  ) {
    return this.schedulesService.setLock(id, phase, dto.isLocked, user, dto.reason);
  }

  @Get(':id/current-phase')
  currentPhase(@Param('id') id: string) {
    return this.schedulesService.currentPhase(id);
  }

  // ── Cycle Ops §4: 1차 확정 KPI 스냅샷 + diff ──
  @Post(':id/kpi-snapshots')
  @Roles(Role.hr_admin)
  createSnapshot(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.snapshotsService.create(id, dto, user);
  }

  @Get(':id/kpi-snapshots')
  listSnapshots(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.snapshotsService.list(id, userId, user);
  }

  @Get(':id/kpi-snapshots/:snapshotId/diff')
  snapshotDiff(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    return this.snapshotsService.diff(id, snapshotId, user);
  }
}
