import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompetencyService } from './competency.service';
import {
  BulkCompetencyResponseDto,
  CompetencyResponseSummaryQuery,
  CreateCompetencyQuestionDto,
  ListCompetencyQuestionsQuery,
  ListCompetencyResponsesQuery,
  UpdateCompetencyQuestionDto,
} from './dto/competency.dto';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@Controller()
export class CompetencyController {
  constructor(private readonly service: CompetencyService) {}

  // ── 질문 ──
  @Get('competency-questions')
  listQuestions(@Query() query: ListCompetencyQuestionsQuery) {
    return this.service.listQuestions(query);
  }

  @Post('competency-questions')
  @Roles(Role.hr_admin)
  createQuestion(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompetencyQuestionDto,
  ) {
    return this.service.createQuestion(user, dto);
  }

  @Patch('competency-questions/:id')
  @Roles(Role.hr_admin)
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyQuestionDto,
  ) {
    return this.service.updateQuestion(user, id, dto);
  }

  @Delete('competency-questions/:id')
  @Roles(Role.hr_admin)
  removeQuestion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeQuestion(user, id);
  }

  // ── 응답 ──
  @Get('competency-responses')
  listResponses(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCompetencyResponsesQuery,
  ) {
    return this.service.listResponses(user, query);
  }

  @Post('competency-responses/bulk')
  bulkRespond(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkCompetencyResponseDto,
  ) {
    return this.service.bulkRespond(user, dto);
  }

  @Get('competency-responses/summary')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: CompetencyResponseSummaryQuery,
  ) {
    return this.service.summary(user, query);
  }
}
