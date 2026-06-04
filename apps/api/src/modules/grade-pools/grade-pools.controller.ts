import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GradePoolsService } from './grade-pools.service';
import { ComputeGradePoolDto, ListGradePoolsQuery } from './dto/grade-pool.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('grade-pools')
export class GradePoolsController {
  constructor(private readonly service: GradePoolsService) {}

  @Get()
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  list(@Query() query: ListGradePoolsQuery) {
    return this.service.list(query);
  }

  @Post('compute')
  @Roles(Role.hr_admin)
  compute(@CurrentUser() user: AuthUser, @Body() dto: ComputeGradePoolDto) {
    return this.service.compute(dto, user);
  }
}
