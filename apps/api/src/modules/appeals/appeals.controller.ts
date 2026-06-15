import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AppealsService } from './appeals.service';
import {
  CreateAppealDto,
  DecideAppealDto,
  ListAppealsQuery,
  RespondAppealDto,
} from './dto/appeal.dto';
import { AppealDto, AppealRecordDto } from './dto/appeal-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('appeals')
@Controller('appeals')
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Get()
  @ApiOkEnvelopeArray(AppealDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListAppealsQuery) {
    return this.appealsService.list(user, query);
  }

  @Post()
  @ApiOkEnvelope(AppealRecordDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppealDto) {
    return this.appealsService.create(user, dto);
  }

  /** 팀장 1차 답변. */
  @Post(':id/respond')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(AppealRecordDto)
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
  @ApiOkEnvelope(AppealRecordDto)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecideAppealDto,
  ) {
    return this.appealsService.decide(user, id, dto);
  }
}
