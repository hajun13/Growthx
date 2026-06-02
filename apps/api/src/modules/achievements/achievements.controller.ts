import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import {
  CreateAchievementDto,
  ListAchievementsQuery,
} from './dto/achievement.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListAchievementsQuery) {
    return this.achievementsService.list(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(user, dto);
  }
}
