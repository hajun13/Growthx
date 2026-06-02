import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { KpiTemplatesService } from './kpi-templates.service';
import {
  CreateKpiTemplateDto,
  ListKpiTemplatesQuery,
} from './dto/kpi-template.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('kpi-templates')
export class KpiTemplatesController {
  constructor(private readonly kpiTemplatesService: KpiTemplatesService) {}

  @Get()
  list(@Query() query: ListKpiTemplatesQuery) {
    return this.kpiTemplatesService.list(query);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateKpiTemplateDto) {
    return this.kpiTemplatesService.create(dto);
  }
}
