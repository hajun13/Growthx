import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope.decorator';
import {
  CompanyAchievementDto,
  DashboardSummaryDto,
} from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // M3 Item 7: 모든 인증 사용자 접근(가시 범위는 service 가 강제).
  @Get('summary')
  @ApiOkEnvelope(DashboardSummaryDto)
  summary(@CurrentUser() user: AuthUser, @Query('cycleId') cycleId?: string) {
    return this.dashboardService.summary(cycleId, user);
  }

  // 전사 목표 대비 달성률 집계 (GroupPerformance 기반).
  // 인증 필수. 비 hr_admin 은 본인 그룹 범위만(service 가 강제).
  @Get('company-achievement')
  @ApiOkEnvelope(CompanyAchievementDto)
  companyAchievement(
    @CurrentUser() user: AuthUser,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.dashboardService.getCompanyAchievement(cycleId, user);
  }
}
