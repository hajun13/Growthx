import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { KpisService } from './kpis.service';
import { KpiUnlockService } from './kpi-unlock.service';
import {
  ApproveKpiDto,
  CreateKpiDto,
  KpiUnlockCandidatesQuery,
  LinkKpiDto,
  ListKpisQuery,
  ListReviewsQuery,
  RejectKpiDto,
  UnlockKpisDto,
  UpdateKpiDto,
} from './dto/kpi.dto';
import {
  KpiApprovalChainDto,
  KpiDeleteResultDto,
  KpiDto,
  KpiReviewDto,
  KpiUnlockOverviewDto,
  KpiUnlockResultDto,
} from './dto/kpi-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('kpis')
@Controller('kpis')
export class KpisController {
  constructor(
    private readonly kpisService: KpisService,
    private readonly unlockService: KpiUnlockService,
  ) {}

  @Get()
  @ApiOkEnvelopeArray(KpiDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListKpisQuery) {
    return this.kpisService.list(user, query);
  }

  // ':id' 보다 먼저 선언해야 'reviews' 가 id 로 매칭되지 않는다.
  @Get('reviews')
  @ApiOkEnvelopeArray(KpiReviewDto)
  listReviews(@CurrentUser() user: AuthUser, @Query() query: ListReviewsQuery) {
    return this.kpisService.listReviews(user, query);
  }

  /** 순차 결재선 조회 — 피평가자의 결재 단계(1차 팀장→2차 본부장→최종 그룹대표, 압축). */
  @Get('approval-chain/:userId')
  @ApiOkEnvelope(KpiApprovalChainDto)
  approvalChain(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.kpisService.getApprovalChain(user, userId);
  }

  /** 확정 해제 후보 — 주기의 확정(confirmed) KPI 를 구성원별로(hr_admin). */
  @Get('unlock-candidates')
  @Roles(Role.hr_admin)
  @RequireFeature('KPI 승인/반려')
  @ApiOkEnvelope(KpiUnlockOverviewDto)
  unlockCandidates(@Query() query: KpiUnlockCandidatesQuery) {
    return this.unlockService.listCandidates(query.cycleId);
  }

  /** 확정 KPI 일괄 확정 해제 → draft(hr_admin). 구성원 수정·재제출 후 결재선 1차부터 다시 결재. */
  @Post('unlock')
  @Roles(Role.hr_admin)
  @RequireFeature('KPI 승인/반려')
  @ApiOkEnvelope(KpiUnlockResultDto)
  unlock(@CurrentUser() user: AuthUser, @Body() dto: UnlockKpisDto) {
    return this.unlockService.unlock(user, dto);
  }

  @Get(':id')
  @ApiOkEnvelope(KpiDto)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.get(user, id);
  }

  @Post()
  @ApiOkEnvelope(KpiDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateKpiDto) {
    return this.kpisService.create(user, dto);
  }

  @Patch(':id')
  @ApiOkEnvelope(KpiDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto,
  ) {
    return this.kpisService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOkEnvelope(KpiDeleteResultDto)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.remove(user, id);
  }

  @Post(':id/submit')
  @ApiOkEnvelope(KpiDto)
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.submit(user, id);
  }

  @Post(':id/approve')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @RequireFeature('KPI 승인/반려')
  @ApiOkEnvelope(KpiDto)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveKpiDto,
  ) {
    return this.kpisService.approve(user, id, dto);
  }

  @Post(':id/reject')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @RequireFeature('KPI 승인/반려')
  @ApiOkEnvelope(KpiDto)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectKpiDto,
  ) {
    return this.kpisService.reject(user, id, dto);
  }

  @Post(':id/confirm')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(KpiDto)
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.confirm(user, id);
  }

  @Post(':id/link')
  @ApiOkEnvelope(KpiDto)
  link(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LinkKpiDto,
  ) {
    return this.kpisService.link(user, id, dto);
  }
}
