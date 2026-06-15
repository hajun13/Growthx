import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { ActionItemsService } from './action-items.service';
import {
  CreateActionItemDto,
  ListActionItemsQuery,
  TransitionActionItemDto,
  UpdateActionItemDto,
} from './dto/midterm.dto';
import { ActionItemDto } from './dto/midterm-response.dto';

/**
 * 6월 중간평가 — ③ 피드백 보완 조치(ActionItem) CRUD + 상태전이.
 * 별도 리소스 경로 /action-items — 12월 최종평가 화면이 ?cycleId=&evaluateeId= 로 조회.
 * **등급 계산 미반영(참고용)**. 행수준 RBAC 는 서비스에서 강제.
 */
@ApiTags('action-items')
@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly service: ActionItemsService) {}

  @Get()
  @ApiOkEnvelopeArray(ActionItemDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListActionItemsQuery) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @ApiOkEnvelope(ActionItemDto)
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  // 생성: 부서장·HR(서비스에서 상위 장 권한 추가 검증).
  @Post()
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(ActionItemDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActionItemDto) {
    return this.service.create(user, dto);
  }

  // 내용 수정: 부서장·HR.
  @Patch(':id')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(ActionItemDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateActionItemDto,
  ) {
    return this.service.update(user, id, dto);
  }

  // 상태 전이: 담당 본인 + 부서장 + HR(서비스에서 검증) — 컨트롤러 레벨 role 제한 없음(employee 담당 허용).
  @Patch(':id/status')
  @ApiOkEnvelope(ActionItemDto)
  transition(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TransitionActionItemDto,
  ) {
    return this.service.transition(user, id, dto);
  }
}
