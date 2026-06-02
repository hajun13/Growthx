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
  create(@Body() dto: CreateRuleSetDto) {
    return this.ruleSetsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(@Param('id') id: string, @Body() dto: UpdateRuleSetDto) {
    return this.ruleSetsService.update(id, dto);
  }
}
