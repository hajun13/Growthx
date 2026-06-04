import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // M3 Item 7: 모든 인증 사용자 접근(가시 범위는 service 가 강제).
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('cycleId') cycleId?: string) {
    return this.dashboardService.summary(cycleId, user);
  }
}
