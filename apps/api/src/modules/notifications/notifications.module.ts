import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';
import { NotificationsController } from './notifications.controller';
import { ReminderScheduler } from './reminder.scheduler';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MailService, ReminderScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
