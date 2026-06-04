import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { KpiCategoryPolicyService } from './kpi-category-policy.service';
import {
  AllowedCategoriesQuery,
  UpdateKpiCategoryPolicyDto,
} from './dto/kpi-category-policy.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('kpi-category-policy')
export class KpiCategoryPolicyController {
  constructor(private readonly service: KpiCategoryPolicyService) {}

  /** 전체 직책×카테고리 매트릭스(설정 화면). hr_admin. */
  @Get()
  @Roles(Role.hr_admin)
  getMatrix() {
    return this.service.getMatrix();
  }

  /** KPI 작성용 — 특정 사용자/직책의 허용 카테고리. 인증된 전 역할. */
  @Get('allowed')
  allowed(@Query() query: AllowedCategoriesQuery) {
    return this.service.allowedForUserOrPosition({
      userId: query.userId,
      position: query.position,
    });
  }

  /** 매트릭스 갱신(부분). hr_admin. */
  @Patch()
  @Roles(Role.hr_admin)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateKpiCategoryPolicyDto) {
    return this.service.update(user, dto);
  }
}
