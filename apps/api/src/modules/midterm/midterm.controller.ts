import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MidtermReviewStatus, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { MidtermProgressService } from './midterm-progress.service';
import { MidtermReviewsService } from './midterm-reviews.service';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { MidtermNotifyService } from './midterm-notify.service';
import { RebaselineService } from './rebaseline.service';
import {
  CommentMidtermDto,
  DecideMidtermDto,
  OpenMidtermDto,
  SubmitMidtermRevisionDto,
} from './dto/midterm-flow.dto';
import {
  ConfirmMidtermReviewDto,
  CreateRebaselineRequestDto,
  ListMidtermReviewsQuery,
  ListRebaselineRequestsQuery,
  MidtermProgressQuery,
  RebaselineHistoryQuery,
  ReviewRebaselineRequestDto,
  SendBackMidtermReviewDto,
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
 * 2단계 흐름 응답 봉투(느슨) — `data` 형태가 엔드포인트마다 다르다
 * (상세 = 리뷰+체크인+이력, 개시 = 대상·경고 요약, 재배정 = 스캔·변경 건수).
 * 계획에 없는 DTO 클래스를 새로 만들지 않고 object 로 발행한다 — 프론트는 `lib/types.ts` 의
 * `MidtermDetail` 로 좁혀 쓴다(Task 10).
 */
const ApiOkLooseEnvelope = () =>
  ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: { type: 'object', additionalProperties: true } },
    },
  });

/** 위와 동일하되 `data` 가 배열인 경우(이력 타임라인). */
const ApiOkLooseEnvelopeArray = () =>
  ApiOkResponse({
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
  });

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
    private readonly flow: MidtermReviewFlowService,
    private readonly notify: MidtermNotifyService,
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

  // 상급자 재조정 요청(부서장·HR). self_done|confirmed 에서, reviewerNote(사유) 필수.
  @Post('reviews/:id/request-revision')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(MidtermReviewDto)
  requestRevision(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendBackMidtermReviewDto,
  ) {
    return this.reviews.sendBack(user, id, MidtermReviewStatus.revision_requested, dto);
  }

  // 상급자 반려(부서장·HR). self_done 에서만, reviewerNote(사유) 필수.
  @Post('reviews/:id/reject')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(MidtermReviewDto)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendBackMidtermReviewDto,
  ) {
    return this.reviews.sendBack(user, id, MidtermReviewStatus.rejected, dto);
  }

  // ── 2단계 중간점검(2026-07-23) ──
  // pending →(1차 코멘트) commented →(본인 수정) revised →(2차 판정) closed | returned.
  // @Roles 는 HR 전용 3개(open·reopen·reassign)에만. 나머지는 서비스가 체인 소속을 검증한다
  // (B-1 정합 — 부서장은 role 이 아니라 Department.headUserId 로 판정하므로, role 게이트를 걸면
  // employee 권한을 가진 부서장이 잠긴다).
  // 알림은 **트랜잭션 커밋 후** 여기서 발송한다 — 흐름 서비스는 의도(NotifyIntent[])만 돌려준다.

  @Post('reviews/open')
  @Roles(Role.hr_admin)
  @ApiOkLooseEnvelope()
  async open(@CurrentUser() user: AuthUser, @Body() dto: OpenMidtermDto) {
    const res = await this.flow.open(user, dto);
    if (res.notify) await this.notify.dispatch(res.notify);
    return { data: res.data };
  }

  @Post('reviews/:id/comment')
  @ApiOkLooseEnvelope()
  async comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CommentMidtermDto,
  ) {
    const res = await this.flow.comment(user, id, dto);
    await this.notify.dispatch(res.notify);
    return { data: res.data };
  }

  @Post('reviews/:id/revision/submit')
  @ApiOkLooseEnvelope()
  async submitRevision(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitMidtermRevisionDto,
  ) {
    const res = await this.flow.submitRevision(user, id, dto);
    await this.notify.dispatch(res.notify);
    return { data: res.data };
  }

  @Post('reviews/:id/approve')
  @ApiOkLooseEnvelope()
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecideMidtermDto,
  ) {
    const res = await this.flow.approve(user, id, dto);
    await this.notify.dispatch(res.notify);
    return { data: res.data };
  }

  @Post('reviews/:id/return')
  @ApiOkLooseEnvelope()
  async returnToMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecideMidtermDto,
  ) {
    const res = await this.flow.returnToMember(user, id, dto);
    await this.notify.dispatch(res.notify);
    return { data: res.data };
  }

  @Post('reviews/:id/reopen')
  @Roles(Role.hr_admin)
  @ApiOkLooseEnvelope()
  async reopen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const res = await this.flow.reopen(user, id);
    return { data: res.data };
  }

  @Post('reviews/reassign')
  @Roles(Role.hr_admin)
  @ApiOkLooseEnvelope()
  async reassign(@CurrentUser() user: AuthUser, @Body() dto: OpenMidtermDto) {
    const res = await this.flow.reassign(user, dto.cycleId);
    return { data: res.data };
  }

  @Get('reviews/:id/detail')
  @ApiOkLooseEnvelope()
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return { data: await this.flow.detailForViewer(user, id) };
  }

  // 이력 타임라인만 따로(설계 §6). 상세와 같은 열람 권한을 쓰기 위해 detailForViewer 를 거친다 —
  // 권한 규칙을 두 곳에 복제하면 한쪽만 고쳐져 새는 사고가 난다.
  @Get('reviews/:id/trail')
  @ApiOkLooseEnvelopeArray()
  async trail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const detail = await this.flow.detailForViewer(user, id);
    return { data: detail.trail };
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
