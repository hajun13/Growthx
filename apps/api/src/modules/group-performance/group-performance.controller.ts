import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GroupPerformanceService } from './group-performance.service';
import {
  ListGroupPerformanceQuery,
  UpsertGroupPerformanceDto,
} from './dto/group-performance.dto';
import { GroupPerformanceDto } from './dto/group-performance-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('group-performance')
@Controller('group-performance')
export class GroupPerformanceController {
  constructor(private readonly service: GroupPerformanceService) {}

  @Get()
  @Roles(Role.hr_admin, Role.division_head)
  @ApiOkEnvelopeArray(GroupPerformanceDto)
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
  @ApiOkEnvelope(GroupPerformanceDto)
  upsert(@Body() dto: UpsertGroupPerformanceDto) {
    return this.service.upsert(dto);
  }
}
