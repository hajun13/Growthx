import { Module } from '@nestjs/common';
import { AppealsService } from './appeals.service';
import { AppealAttachmentsService } from './appeal-attachments.service';
import { AppealsController } from './appeals.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompensationsModule } from '../compensations/compensations.module';

@Module({
  imports: [NotificationsModule, CompensationsModule],
  controllers: [AppealsController],
  providers: [AppealsService, AppealAttachmentsService],
})
export class AppealsModule {}
