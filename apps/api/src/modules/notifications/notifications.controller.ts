import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  GenerateNotificationsDto,
  ListNotificationsQuery,
} from './dto/notification.dto';
import {
  MarkAllReadResultDto,
  NotificationDto,
  UnreadCountDto,
} from './dto/notification-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOkEnvelopeArray(NotificationDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQuery) {
    return this.notificationsService.list(user, query);
  }

  @Get('unread-count')
  @ApiOkEnvelope(UnreadCountDto)
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
  @ApiOkEnvelope(NotificationDto)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Patch('read-all')
  @ApiOkEnvelope(MarkAllReadResultDto)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user);
  }
}
