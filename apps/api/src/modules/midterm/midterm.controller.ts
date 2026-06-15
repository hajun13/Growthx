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
import { MidtermProgressService } from './midterm-progress.service';
import { MidtermReviewsService } from './midterm-reviews.service';
import { RebaselineService } from './rebaseline.service';
import {
  ConfirmMidtermReviewDto,
  CreateRebaselineRequestDto,
  ListMidtermReviewsQuery,
  ListRebaselineRequestsQuery,
  MidtermProgressQuery,
  RebaselineHistoryQuery,
  ReviewRebaselineRequestDto,
  SubmitMidtermSelfReviewDto,
  UpdateRebaselineRequestDto,
} from './dto/midterm.dto';
import {
  RebaselineHistoryEntryDto,
  RebaselineRequestDetailDto,
  RebaselineRequestViewDto,
} from './dto/rebaseline-response.dto';
import {
  MidtermProgressDto,
  MidtermReviewDto,
} from './dto/midterm-response.dto';

/**
 * 6월 중간평가 — 진척 점검(②) + 자가점검/부서장 확인.
 * 경로: /midterm/progress · /midterm/reviews · /midterm/reviews/:id/confirm.
 */
@ApiTags('midterm')
@Controller('midterm')
export class MidtermController {
  constructor(
    private readonly progress: MidtermProgressService,
    private readonly reviews: MidtermReviewsService,
    private readonly rebaseline: RebaselineService,
  ) {}

  @Get('progress')
  @ApiOkEnvelope(MidtermProgressDto)
  getProgress(@CurrentUser() user: AuthUser, @Query() query: MidtermProgressQuery) {
    return this.progress.progress(user, query);
  }

  @Get('reviews')
  @ApiOkEnvelopeArray(MidtermReviewDto)
  listReviews(@CurrentUser() user: AuthUser, @Query() query: ListMidtermReviewsQuery) {
    return this.reviews.list(user, query);
  }

  // 본인 자가점검 제출(모든 인증 사용자가 본인 것 제출 가능).
  @Post('reviews')
  @ApiOkEnvelope(MidtermReviewDto)
  submitSelf(@CurrentUser() user: AuthUser, @Body() dto: SubmitMidtermSelfReviewDto) {
    return this.reviews.submitSelf(user, dto);
  }

  // 부서장 확인(부서장·HR). 서비스에서 상위 장(round) 권한을 추가 검증.
  @Patch('reviews/:id/confirm')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(MidtermReviewDto)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmMidtermReviewDto,
  ) {
    return this.reviews.confirm(user, id, dto);
  }

  // ④ 재조정 요청 워크플로우 — 본인 제안 → 부서장 검토 → 승인 시 반영.
  //    role 게이트 없음(employee 포함 본인 것 생성 가능). 서비스에서 단계·소유권·검토자 검증.

  // 생성+제출(본인). evaluateeId 는 서버가 current.id 로 강제.
  @Post('rebaseline-requests')
  @ApiOkEnvelope(RebaselineRequestDetailDto)
  createRebaselineRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRebaselineRequestDto,
  ) {
    return this.rebaseline.create(user, dto);
  }

  // 목록(역할별 가시 범위 + forReview 검토 큐).
  @Get('rebaseline-requests')
  @ApiOkEnvelopeArray(RebaselineRequestViewDto)
  listRebaselineRequests(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRebaselineRequestsQuery,
  ) {
    return this.rebaseline.list(user, query);
  }

  // 상세(제안 items + 현재 KPI 비교·가중치 검증 상태).
  @Get('rebaseline-requests/:id')
  @ApiOkEnvelope(RebaselineRequestDetailDto)
  getRebaselineRequest(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rebaseline.detail(user, id);
  }

  // 본인 수정·재제출(submitted/rejected 상태).
  @Patch('rebaseline-requests/:id')
  @ApiOkEnvelope(RebaselineRequestDetailDto)
  updateRebaselineRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRebaselineRequestDto,
  ) {
    return this.rebaseline.update(user, id, dto);
  }

  // 부서장 검토(승인/반려). approve 면 적용. role 게이트 없음 — 서비스에서 부서장 검증.
  @Patch('rebaseline-requests/:id/review')
  @ApiOkEnvelope(RebaselineRequestDetailDto)
  reviewRebaselineRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewRebaselineRequestDto,
  ) {
    return this.rebaseline.review(user, id, dto);
  }

  // ④ 재조정 이력/diff 조회 — 본인·부서장·HR(서비스에서 검증). 승인 반영분만 스냅샷 기반.
  @Get('rebaseline/history')
  @ApiOkEnvelopeArray(RebaselineHistoryEntryDto)
  rebaselineHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: RebaselineHistoryQuery,
  ) {
    return this.rebaseline.history(user, query);
  }
}
