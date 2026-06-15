import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgChartService } from './org-chart.service';
import { OrgChartNodeDto } from './dto/org-chart-response.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('org-chart')
@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  /** 조직도 트리(회사→그룹→본부→팀) + 노드별 인원 카운트. 가시 범위 내. 인증된 전 역할. */
  @Get()
  @ApiOkEnvelope(OrgChartNodeDto)
  getChart(@CurrentUser() user: AuthUser) {
    return this.orgChartService.getChart(user);
  }
}
