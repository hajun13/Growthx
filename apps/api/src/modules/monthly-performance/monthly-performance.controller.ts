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
import { MonthlyPerformanceService } from './monthly-performance.service';
import {
  CreateMonthlyPerformanceDto,
  ListMonthlyPerformanceQuery,
  MonthlyPerformanceSummaryQuery,
  UpdateMonthlyPerformanceDto,
} from './dto/monthly-performance.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('monthly-performance')
export class MonthlyPerformanceController {
  constructor(private readonly service: MonthlyPerformanceService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListMonthlyPerformanceQuery) {
    return this.service.list(user, query);
  }

  @Get('summary')
  summary(@Query() query: MonthlyPerformanceSummaryQuery) {
    return this.service.summary(query);
  }

  @Post()
  @Roles(Role.hr_admin, Role.division_head)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMonthlyPerformanceDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin, Role.division_head)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyPerformanceDto,
  ) {
    return this.service.update(user, id, dto);
  }
}
