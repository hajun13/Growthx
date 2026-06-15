import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { ListAuditLogsQuery } from './dto/audit-log.dto';
import { AuditLogDto } from './dto/audit-log-response.dto';
import { ApiOkEnvelopeArray } from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(Role.hr_admin)
  @RequireFeature('감사로그')
  @ApiOkEnvelopeArray(AuditLogDto)
  list(@Query() query: ListAuditLogsQuery) {
    return this.auditLogsService.list(query);
  }
}
