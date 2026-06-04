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
import { KpiTemplatesService } from './kpi-templates.service';
import {
  CreateKpiTemplateDto,
  ListKpiTemplatesQuery,
  UpdateKpiTemplateDto,
} from './dto/kpi-template.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('kpi-templates')
export class KpiTemplatesController {
  constructor(private readonly kpiTemplatesService: KpiTemplatesService) {}

  @Get()
  list(@Query() query: ListKpiTemplatesQuery) {
    return this.kpiTemplatesService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.kpiTemplatesService.get(id);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateKpiTemplateDto) {
    return this.kpiTemplatesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(@Param('id') id: string, @Body() dto: UpdateKpiTemplateDto) {
    return this.kpiTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(@Param('id') id: string) {
    return this.kpiTemplatesService.remove(id);
  }
}
