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
  DeleteUserQuery,
  ListUsersQuery,
  UpdateSalaryDto,
  UpdateUserDto,
} from './dto/user.dto';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
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
  @RequireFeature('권한 부여·수정')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  @RequireFeature('권한 부여·수정')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  // M3 Item 8: 현재 연봉 입력.
  @Patch(':id/salary')
  @Roles(Role.hr_admin)
  updateSalary(@Param('id') id: string, @Body() dto: UpdateSalaryDto) {
    return this.usersService.updateSalary(id, dto);
  }

  // 라이프사이클 S1: 퇴사 처리 (employmentStatus=resigned · isActive=false). 멱등.
  @Patch(':id/resign')
  @Roles(Role.hr_admin)
  resign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.resign(user, id);
  }

  // 라이프사이클 S1: 복직 (employmentStatus=active · isActive=true).
  @Patch(':id/reactivate')
  @Roles(Role.hr_admin)
  reactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.reactivate(user, id);
  }

  // 라이프사이클 S2: 하드 삭제 — 2모드. force=true 면 이력 포함 완전 삭제(cascade).
  // (DELETE 의미 변경: 기존 soft-deactivate → 하드삭제. 비활성은 PATCH :id/resign·:id update(isActive)로.)
  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: DeleteUserQuery,
  ) {
    return this.usersService.remove(user, id, query.force === 'true');
  }
}
