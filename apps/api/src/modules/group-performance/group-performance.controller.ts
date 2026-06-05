import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GroupPerformanceService } from './group-performance.service';
import {
  ListGroupPerformanceQuery,
  UpsertGroupPerformanceDto,
} from './dto/group-performance.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('group-performance')
export class GroupPerformanceController {
  constructor(private readonly service: GroupPerformanceService) {}

  @Get()
  @Roles(Role.hr_admin, Role.division_head)
  list(@CurrentUser() user: AuthUser, @Query() query: ListGroupPerformanceQuery) {
    return this.service.list(user, query);
  }

  // M3 Item 10: 본인 소속 그룹 목표/실적(개인용, 읽기 전용).
  @Get('my-group')
  myGroup(@CurrentUser() user: AuthUser, @Query('cycleId') cycleId: string) {
    return this.service.myGroup(user, cycleId);
  }

  @Post()
  @Roles(Role.hr_admin)
  upsert(@Body() dto: UpsertGroupPerformanceDto) {
    return this.service.upsert(dto);
  }
}
