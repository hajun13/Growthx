import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQuery } from './dto/audit-log.dto';
import { Roles } from '../../common/decorators/roles';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(Role.hr_admin)
  list(@Query() query: ListAuditLogsQuery) {
    return this.auditLogsService.list(query);
  }
}
