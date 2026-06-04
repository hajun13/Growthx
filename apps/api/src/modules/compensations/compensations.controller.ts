import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompensationsService } from './compensations.service';
import {
  ComputeCompensationDto,
  ListCompensationsQuery,
  SimulationQuery,
  TeamSimulationQuery,
} from './dto/compensation.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('compensations')
export class CompensationsController {
  constructor(private readonly compensationsService: CompensationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCompensationsQuery) {
    return this.compensationsService.list(user, query);
  }

  // ── M3 Item 8: 연봉 시뮬레이션 ──
  // 팀 시뮬레이션을 개인보다 먼저 선언(라우트 매칭 명확성).
  @Get('simulation/team')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  simulationTeam(
    @CurrentUser() user: AuthUser,
    @Query() query: TeamSimulationQuery,
  ) {
    return this.compensationsService.simulationTeam(user, query);
  }

  @Get('simulation')
  simulation(@CurrentUser() user: AuthUser, @Query() query: SimulationQuery) {
    return this.compensationsService.simulation(user, query);
  }

  @Post('compute')
  @Roles(Role.hr_admin)
  compute(@Body() dto: ComputeCompensationDto) {
    return this.compensationsService.compute(dto);
  }
}
