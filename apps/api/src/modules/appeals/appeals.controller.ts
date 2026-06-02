import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppealsService } from './appeals.service';
import {
  CreateAppealDto,
  DecideAppealDto,
  ListAppealsQuery,
  RespondAppealDto,
} from './dto/appeal.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('appeals')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAppealsQuery) {
    return this.appealsService.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppealDto) {
    return this.appealsService.create(user, dto);
  }

  /** 팀장 1차 답변. */
  @Post(':id/respond')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondAppealDto,
  ) {
    return this.appealsService.respond(user, id, dto);
  }

  /** HR 최종 결정. */
  @Post(':id/decide')
  @Roles(Role.hr_admin)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecideAppealDto,
  ) {
    return this.appealsService.decide(user, id, dto);
  }
}
