import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  GenerateNotificationsDto,
  ListNotificationsQuery,
} from './dto/notification.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQuery) {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Post()
  @Roles(Role.hr_admin)
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('generate')
  @Roles(Role.hr_admin)
  generate(@Body() dto: GenerateNotificationsDto) {
    return this.notificationsService.generate(dto);
  }

  /**
   * 일정 자동화 수동 트리거(HR) — 크론(매일 09:00)과 동일 로직.
   * 단계별 notifyEnabled·notifyOffsets·마감일 기준 D-N 리마인더를 멱등 발송.
   */
  @Post('run-reminders')
  @Roles(Role.hr_admin)
  runReminders() {
    return this.notificationsService.runDueReminders();
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user);
  }
}
