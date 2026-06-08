import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { EvaluationsService } from './evaluations.service';
import {
  AddCommentDto,
  AutoAssignDownwardDto,
  CreateEvaluationDto,
  GradeDistributionQuery,
  ListEvaluationsQuery,
  PatchEvaluationDto,
} from './dto/evaluation.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListEvaluationsQuery) {
    return this.evaluationsService.list(user, query);
  }

  // 주의: ':id' 보다 위에 선언해야 라우팅이 올바르게 동작.
  @Get('grade-distribution')
  @Roles(Role.hr_admin, Role.division_head)
  gradeDistribution(
    @CurrentUser() user: AuthUser,
    @Query() query: GradeDistributionQuery,
  ) {
    return this.evaluationsService.gradeDistribution(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.getDetail(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.create(user, dto);
  }

  // 부서장 평가 자동 배정(수동 재배정용). 시드/진행 중 주기에도 멱등 배정.
  @Post('auto-assign')
  @Roles(Role.hr_admin)
  autoAssign(@Body() dto: AutoAssignDownwardDto) {
    return this.evaluationsService.autoAssignDownward(dto.cycleId);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchEvaluationDto,
  ) {
    return this.evaluationsService.patch(user, id, dto);
  }

  @Post(':id/comment')
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.evaluationsService.addComment(user, id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.submit(user, id);
  }

  @Post(':id/finalize')
  @Roles(Role.hr_admin)
  finalize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.finalize(id, user);
  }
}
