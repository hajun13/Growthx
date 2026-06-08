import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { UpdatePermissionConfigDto } from './dto/permission-config.dto';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  /**
   * GET /permissions/config — 인증된 모든 사용자(프론트 사이드바·기능 게이팅에 필요).
   * 응답 { data: { matrix, navVisibility } }. row 없으면 기본값 반환.
   */
  @Get('config')
  getConfig() {
    return this.permissions.getConfig();
  }

  /**
   * PUT /permissions/config — hr_admin 전용 + 매트릭스 '권한 부여·수정' 기능.
   * 싱글톤 upsert, updatedById 기록, audit 기록.
   */
  @Put('config')
  @Roles(Role.hr_admin)
  @RequireFeature('권한 부여·수정')
  updateConfig(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePermissionConfigDto,
  ) {
    return this.permissions.update(dto, user.id);
  }
}
