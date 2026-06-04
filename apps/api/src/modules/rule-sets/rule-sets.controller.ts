import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { RuleSetsService } from './rule-sets.service';
import { CreateRuleSetDto, UpdateRuleSetDto } from './dto/rule-set.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('rule-sets')
export class RuleSetsController {
  constructor(private readonly ruleSetsService: RuleSetsService) {}

  @Get()
  list() {
    return this.ruleSetsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.ruleSetsService.get(id);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRuleSetDto) {
    return this.ruleSetsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRuleSetDto,
  ) {
    return this.ruleSetsService.update(id, dto, user);
  }
}
