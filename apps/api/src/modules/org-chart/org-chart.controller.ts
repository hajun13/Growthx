import { Controller, Get } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  /** 조직도 트리(회사→그룹→본부→팀) + 노드별 인원 카운트. 가시 범위 내. 인증된 전 역할. */
  @Get()
  getChart(@CurrentUser() user: AuthUser) {
    return this.orgChartService.getChart(user);
  }
}
