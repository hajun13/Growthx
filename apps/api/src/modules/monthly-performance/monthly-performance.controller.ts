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
import { FinancialPerformanceService } from './financial-performance.service';
import {
  CreateMonthlyPerformanceDto,
  ListMonthlyPerformanceQuery,
  MonthlyPerformanceSummaryQuery,
  UpdateMonthlyPerformanceDto,
} from './dto/monthly-performance.dto';
import {
  FinancialGridQuery,
  FinancialPerformanceBulkDto,
} from './dto/financial-performance.dto';
import {
  MonthlyPerformanceDto,
  MonthlyPerformanceSummaryDto,
} from './dto/monthly-performance-response.dto';
import {
  FinancialGridDto,
  FinancialPerformanceBulkResultDto,
} from './dto/financial-grid-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('monthly-performance')
@Controller('monthly-performance')
export class MonthlyPerformanceController {
  constructor(
    private readonly service: MonthlyPerformanceService,
    private readonly financial: FinancialPerformanceService,
  ) {}

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

  /** 경영실적 그리드 조회 — 4행×(2024+1~12월+년계) 표용(파생값 포함). */
  @Get('financial-grid')
  @ApiOkEnvelope(FinancialGridDto)
  financialGrid(
    @CurrentUser() user: AuthUser,
    @Query() query: FinancialGridQuery,
  ) {
    return this.financial.financialGrid(user, query);
  }

  /** 경영실적 일괄 적재 — 부서·연도 단위 12개월 매출/원가 + 전년 참고 bulk upsert. */
  @Post('bulk')
  @Roles(Role.hr_admin, Role.division_head)
  @ApiOkEnvelope(FinancialPerformanceBulkResultDto)
  bulk(
    @CurrentUser() user: AuthUser,
    @Body() dto: FinancialPerformanceBulkDto,
  ) {
    return this.financial.bulkUpsert(user, dto);
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
