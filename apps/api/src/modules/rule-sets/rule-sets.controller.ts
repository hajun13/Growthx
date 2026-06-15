import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RuleSetsService } from './rule-sets.service';
import { CreateRuleSetDto, UpdateRuleSetDto } from './dto/rule-set.dto';
import { RuleSetDto } from './dto/rule-set-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('rule-sets')
@Controller('rule-sets')
export class RuleSetsController {
  constructor(private readonly ruleSetsService: RuleSetsService) {}

  @Get()
  @ApiOkEnvelopeArray(RuleSetDto)
  list() {
    return this.ruleSetsService.list();
  }

  @Get(':id')
  @ApiOkEnvelope(RuleSetDto)
  get(@Param('id') id: string) {
    return this.ruleSetsService.get(id);
  }

  @Post()
  @Roles(Role.hr_admin)
  @RequireFeature('시스템 설정')
  @ApiOkEnvelope(RuleSetDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRuleSetDto) {
    return this.ruleSetsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  @RequireFeature('시스템 설정')
  @ApiOkEnvelope(RuleSetDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRuleSetDto,
  ) {
    return this.ruleSetsService.update(id, dto, user);
  }
}
