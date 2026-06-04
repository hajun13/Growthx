import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.hr_admin)
  summary(@Query('cycleId') cycleId?: string) {
    return this.dashboardService.summary(cycleId);
  }
}
