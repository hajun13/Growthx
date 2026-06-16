import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CompensationsService } from './compensations.service';
import {
  ComputeCompensationDto,
  ListCompensationsQuery,
  SimulationQuery,
  TeamSimulationQuery,
  UpsertCompensationAdjustmentDto,
} from './dto/compensation.dto';
import {
  CompensationAdjustmentDto,
  CompensationDto,
  CompensationSimulationDto,
} from './dto/compensation-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('compensations')
@Controller('compensations')
export class CompensationsController {
  constructor(private readonly compensationsService: CompensationsService) {}

  @Get()
  @ApiOkEnvelopeArray(CompensationDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListCompensationsQuery) {
    return this.compensationsService.list(user, query);
  }

  // ── M3 Item 8: 연봉 시뮬레이션 ──
  // 팀 시뮬레이션을 개인보다 먼저 선언(라우트 매칭 명확성).
  @Get('simulation/team')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelopeArray(CompensationSimulationDto)
  simulationTeam(
    @CurrentUser() user: AuthUser,
    @Query() query: TeamSimulationQuery,
  ) {
    return this.compensationsService.simulationTeam(user, query);
  }

  @Get('simulation')
  @ApiOkEnvelope(CompensationSimulationDto)
  simulation(@CurrentUser() user: AuthUser, @Query() query: SimulationQuery) {
    return this.compensationsService.simulation(user, query);
  }

  @Post('compute')
  @Roles(Role.hr_admin)
  @ApiOkEnvelopeArray(CompensationDto)
  compute(@Body() dto: ComputeCompensationDto) {
    return this.compensationsService.compute(dto);
  }

  // ── 보상 수기 조정(2026 연봉갱신 엑셀 T~AC) upsert ──
  // (userId, cycleId) 멱등 upsert. 단계 게이팅 없음(최종 단계 전에도 입력 가능). hr_admin 전용.
  @Put('adjustment')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompensationAdjustmentDto)
  upsertAdjustment(@Body() dto: UpsertCompensationAdjustmentDto) {
    return this.compensationsService.upsertAdjustment(dto);
  }
}
