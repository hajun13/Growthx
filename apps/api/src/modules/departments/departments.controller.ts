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
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDepartmentsQuery) {
    return this.departmentsService.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.departmentsService.get(user, id);
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
