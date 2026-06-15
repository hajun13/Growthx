import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { MonthlyPerformanceService } from './monthly-performance.service';
import {
  CreateMonthlyPerformanceDto,
  ListMonthlyPerformanceQuery,
  MonthlyPerformanceSummaryQuery,
  UpdateMonthlyPerformanceDto,
} from './dto/monthly-performance.dto';
import {
  MonthlyPerformanceDto,
  MonthlyPerformanceSummaryDto,
} from './dto/monthly-performance-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('monthly-performance')
@Controller('monthly-performance')
export class MonthlyPerformanceController {
  constructor(private readonly service: MonthlyPerformanceService) {}

  @Get()
  @ApiOkEnvelopeArray(MonthlyPerformanceDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListMonthlyPerformanceQuery) {
    return this.service.list(user, query);
  }

  @Get('summary')
  @ApiOkEnvelope(MonthlyPerformanceSummaryDto)
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: MonthlyPerformanceSummaryQuery,
  ) {
    return this.service.summary(user, query);
  }

  @Post()
  @Roles(Role.hr_admin, Role.division_head)
  @ApiOkEnvelope(MonthlyPerformanceDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMonthlyPerformanceDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin, Role.division_head)
  @ApiOkEnvelope(MonthlyPerformanceDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMonthlyPerformanceDto,
  ) {
    return this.service.update(user, id, dto);
  }
}
