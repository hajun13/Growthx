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
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CompetencyService } from './competency.service';
import {
  BulkCompetencyResponseDto,
  CompetencyResponseSummaryQuery,
  CopyFromCycleDto,
  CreateCompetencyCategoryDto,
  CreateCompetencyQuestionDto,
  ListCompetencyQuestionsQuery,
  ListCompetencyResponsesQuery,
  UpdateCompetencyCategoryDto,
  UpdateCompetencyQuestionDto,
} from './dto/competency.dto';
import {
  CompetencyCategoryDto,
  CompetencyCategoryDeleteResultDto,
  CompetencyQuestionDto,
  CompetencyQuestionDeleteResultDto,
  CompetencyResponseDto,
} from './dto/competency-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('competency')
@Controller()
export class CompetencyController {
  constructor(private readonly service: CompetencyService) {}

  // ── 카테고리 ──
  @Get('competency-categories')
  @ApiOkEnvelopeArray(CompetencyCategoryDto)
  listCategories() {
    return this.service.listCategories();
  }

  @Post('competency-categories')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyCategoryDto)
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompetencyCategoryDto,
  ) {
    return this.service.createCategory(user, dto);
  }

  @Patch('competency-categories/:id')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyCategoryDto)
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyCategoryDto,
  ) {
    return this.service.updateCategory(user, id, dto);
  }

  @Delete('competency-categories/:id')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyCategoryDeleteResultDto)
  removeCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeCategory(user, id);
  }

  // ── 질문 ──
  @Get('competency-questions')
  @ApiOkEnvelopeArray(CompetencyQuestionDto)
  listQuestions(@Query() query: ListCompetencyQuestionsQuery) {
    return this.service.listQuestions(query);
  }

  @Post('competency-questions/copy-from-cycle')
  @Roles(Role.hr_admin)
  @ApiOkEnvelopeArray(CompetencyQuestionDto)
  copyFromCycle(
    @CurrentUser() user: AuthUser,
    @Body() dto: CopyFromCycleDto,
  ) {
    return this.service.copyFromCycle(user, dto);
  }

  @Post('competency-questions')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyQuestionDto)
  createQuestion(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompetencyQuestionDto,
  ) {
    return this.service.createQuestion(user, dto);
  }

  @Patch('competency-questions/:id')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyQuestionDto)
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompetencyQuestionDto,
  ) {
    return this.service.updateQuestion(user, id, dto);
  }

  @Delete('competency-questions/:id')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(CompetencyQuestionDeleteResultDto)
  removeQuestion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removeQuestion(user, id);
  }

  // ── 응답 ──
  @Get('competency-responses')
  @ApiOkEnvelopeArray(CompetencyResponseDto)
  listResponses(
    @CurrentUser() user: AuthUser,
    @Query() query: ListCompetencyResponsesQuery,
  ) {
    return this.service.listResponses(user, query);
  }

  @Post('competency-responses/bulk')
  @ApiOkEnvelopeArray(CompetencyResponseDto)
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
