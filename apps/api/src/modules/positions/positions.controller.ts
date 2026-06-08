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
import { PositionsService } from './positions.service';
import {
  CreatePositionDto,
  ListPositionsQuery,
  UpdatePositionDto,
} from './dto/position.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('positions')
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  /** 직급 목록(드롭다운·라벨·정렬). 인증 사용자 전체. */
  @Get()
  list(@Query() query: ListPositionsQuery) {
    return this.service.list(query);
  }

  /** 커스텀 직급 추가. hr_admin. */
  @Post()
  @Roles(Role.hr_admin)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePositionDto) {
    return this.service.create(user, dto);
  }

  /** 직급 수정(라벨/정렬/경영진/기본값/활성). hr_admin. */
  @Patch(':id')
  @Roles(Role.hr_admin)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.service.update(user, id, dto);
  }

  /** 커스텀·미사용 직급 삭제. hr_admin. */
  @Delete(':id')
  @Roles(Role.hr_admin)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
