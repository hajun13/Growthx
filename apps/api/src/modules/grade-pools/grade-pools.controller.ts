import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { GradePoolsService } from './grade-pools.service';
import {
  ComputeGradePoolDto,
  ListGradePoolsQuery,
  UpdateGradePoolDto,
} from './dto/grade-pool.dto';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('grade-pools')
export class GradePoolsController {
  constructor(private readonly service: GradePoolsService) {}

  @Get()
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  list(@CurrentUser() user: AuthUser, @Query() query: ListGradePoolsQuery) {
    return this.service.list(user, query);
  }

  @Post('compute')
  @Roles(Role.hr_admin)
  @RequireFeature('등급풀 수정')
  compute(@CurrentUser() user: AuthUser, @Body() dto: ComputeGradePoolDto) {
    return this.service.compute(dto, user);
  }

  @Patch(':id')
  @Roles(Role.hr_admin)
  @RequireFeature('등급풀 수정')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGradePoolDto,
  ) {
    return this.service.update(user, id, dto);
  }
}
