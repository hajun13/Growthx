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
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  ListDepartmentsQuery,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  list(@Query() query: ListDepartmentsQuery) {
    return this.departmentsService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.departmentsService.get(id);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
