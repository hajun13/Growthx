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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateSalaryDto,
  UpdateUserDto,
} from './dto/user.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 인증된 전 역할 — 행 수준 가시 범위(visibilityScope)로 서비스에서 결과 축소.
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListUsersQuery) {
    return this.usersService.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.get(user, id);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // M3 Item 8: 현재 연봉 입력.
  @Patch(':id/salary')
  @Roles(Role.hr_admin)
  updateSalary(@Param('id') id: string, @Body() dto: UpdateSalaryDto) {
    return this.usersService.updateSalary(id, dto);
  }

  // M3 조직도: 비활성(soft delete).
  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
