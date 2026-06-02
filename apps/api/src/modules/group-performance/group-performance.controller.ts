import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GroupPerformanceService } from './group-performance.service';
import {
  ListGroupPerformanceQuery,
  UpsertGroupPerformanceDto,
} from './dto/group-performance.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('group-performance')
export class GroupPerformanceController {
  constructor(private readonly service: GroupPerformanceService) {}

  @Get()
  @Roles(Role.hr_admin, Role.division_head)
  list(@Query() query: ListGroupPerformanceQuery) {
    return this.service.list(query);
  }

  @Post()
  @Roles(Role.hr_admin)
  upsert(@Body() dto: UpsertGroupPerformanceDto) {
    return this.service.upsert(dto);
  }
}
