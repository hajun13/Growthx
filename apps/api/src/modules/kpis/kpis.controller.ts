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
  RejectKpiDto,
  UpdateKpiDto,
} from './dto/kpi.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListKpisQuery) {
    return this.kpisService.list(user, query);
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
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveKpiDto,
  ) {
    return this.kpisService.approve(user, id, dto);
  }

  @Post(':id/reject')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
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
