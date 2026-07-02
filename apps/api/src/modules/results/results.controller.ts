import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ResultsService } from './results.service';
import {
  AggregateResultDto,
  DistributionQuery,
  ExportResultQuery,
  ListResultsQuery,
  ResultDetailQuery,
  SummaryTableQuery,
} from './dto/result.dto';
import {
  DistributionDto,
  EvaluationResultDto,
  SummaryRowDto,
} from './dto/result-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('results')
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  @ApiOkEnvelopeArray(EvaluationResultDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListResultsQuery) {
    return this.resultsService.list(user, query);
  }

  // 평가자정리 표 — 다단계 평가 요약(정적 경로, :userId 보다 먼저).
  @Get('summary')
  @ApiOkEnvelopeArray(SummaryRowDto)
  summary(@CurrentUser() user: AuthUser, @Query() query: SummaryTableQuery) {
    return this.resultsService.summaryTable(user, query);
  }

  // 등급 분포(필터·스코프 가드) — 정적 경로라 :userId 보다 먼저 선언.
  @Get('distribution')
  @ApiOkEnvelope(DistributionDto)
  distribution(@CurrentUser() user: AuthUser, @Query() query: DistributionQuery) {
    return this.resultsService.distribution(user, query);
  }

  @Post('aggregate')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(EvaluationResultDto)
  aggregate(@CurrentUser() user: AuthUser, @Body() dto: AggregateResultDto) {
    return this.resultsService.aggregate(user, dto);
  }

  // M3 Item 9: 개인 평가 결과 내보내기 (excel | pdf=인쇄용 HTML).
  @Get(':userId/export')
  async export(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query() query: ExportResultQuery,
    @Res() res: Response,
  ) {
    const out = await this.resultsService.export(user, userId, query);
    if (out.kind === 'excel') {
      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="result-${userId}.xlsx"`,
      );
      res.send(out.buffer);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(out.html);
  }

  @Get(':userId')
  @ApiOkEnvelope(EvaluationResultDto)
  getDetail(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query() query: ResultDetailQuery,
  ) {
    return this.resultsService.getDetail(user, userId, query);
  }
}
