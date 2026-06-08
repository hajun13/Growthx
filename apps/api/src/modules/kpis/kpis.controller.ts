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
import { Role } from '@prisma/client';
import { KpisService } from './kpis.service';
import {
  ApproveKpiDto,
  CreateKpiDto,
  LinkKpiDto,
  ListKpisQuery,
  ListReviewsQuery,
  RejectKpiDto,
  UpdateKpiDto,
} from './dto/kpi.dto';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListKpisQuery) {
    return this.kpisService.list(user, query);
  }

  // ':id' 보다 먼저 선언해야 'reviews' 가 id 로 매칭되지 않는다.
  @Get('reviews')
  listReviews(@CurrentUser() user: AuthUser, @Query() query: ListReviewsQuery) {
    return this.kpisService.listReviews(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateKpiDto) {
    return this.kpisService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto,
  ) {
    return this.kpisService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.remove(user, id);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.submit(user, id);
  }

  @Post(':id/approve')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @RequireFeature('KPI 승인/반려')
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
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectKpiDto,
  ) {
    return this.kpisService.reject(user, id, dto);
  }

  @Post(':id/confirm')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.kpisService.confirm(user, id);
  }

  @Post(':id/link')
  link(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LinkKpiDto,
  ) {
    return this.kpisService.link(user, id, dto);
  }
}
