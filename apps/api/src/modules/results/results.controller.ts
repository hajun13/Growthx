import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ResultsService } from './results.service';
import {
  AggregateResultDto,
  ListResultsQuery,
  ResultDetailQuery,
} from './dto/result.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListResultsQuery) {
    return this.resultsService.list(user, query);
  }

  @Post('aggregate')
  @Roles(Role.hr_admin)
  aggregate(@Body() dto: AggregateResultDto) {
    return this.resultsService.aggregate(dto);
  }

  @Get(':userId')
  getDetail(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query() query: ResultDetailQuery,
  ) {
    return this.resultsService.getDetail(user, userId, query);
  }
}
