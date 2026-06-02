import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompensationsService } from './compensations.service';
import {
  ComputeCompensationDto,
  ListCompensationsQuery,
} from './dto/compensation.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('compensations')
export class CompensationsController {
  constructor(private readonly compensationsService: CompensationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCompensationsQuery) {
    return this.compensationsService.list(user, query);
  }

  @Post('compute')
  @Roles(Role.hr_admin)
  compute(@Body() dto: ComputeCompensationDto) {
    return this.compensationsService.compute(dto);
  }
}
