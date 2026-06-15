import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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
import {
  CommentDto,
  EvaluationDetailDto,
  EvaluationDto,
  EvaluationEvidenceDto,
  GradeDistributionRowDto,
} from './dto/evaluation-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

/** 업로드 파일 최소 타입(@types/multer 글로벌 네임스페이스 의존 회피). */
interface UploadedEvidenceFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @ApiOkEnvelopeArray(EvaluationDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListEvaluationsQuery) {
    return this.evaluationsService.list(user, query);
  }

  // 주의: ':id' 보다 위에 선언해야 라우팅이 올바르게 동작.
  @Get('grade-distribution')
  @Roles(Role.hr_admin, Role.division_head)
  @ApiOkEnvelopeArray(GradeDistributionRowDto)
  gradeDistribution(
    @CurrentUser() user: AuthUser,
    @Query() query: GradeDistributionQuery,
  ) {
    return this.evaluationsService.gradeDistribution(user, query);
  }

  @Get(':id')
  @ApiOkEnvelope(EvaluationDetailDto)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.getDetail(user, id);
  }

  @Post()
  @ApiOkEnvelope(EvaluationDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.create(user, dto);
  }

  // 부서장 평가 자동 배정(수동 재배정용). 시드/진행 중 주기에도 멱등 배정.
  @Post('auto-assign')
  @Roles(Role.hr_admin)
  autoAssign(@Body() dto: AutoAssignDownwardDto) {
    return this.evaluationsService.autoAssignDownward(dto.cycleId, dto.reset ?? false);
  }

  @Patch(':id')
  @ApiOkEnvelope(EvaluationDetailDto)
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchEvaluationDto,
  ) {
    return this.evaluationsService.patch(user, id, dto);
  }

  @Post(':id/comment')
  @ApiOkEnvelope(CommentDto)
  comment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.evaluationsService.addComment(user, id, dto);
  }

  // ── 문항별 증빙 첨부 (본인평가) ──
  // ':id' 하위 정적 경로는 위에 둘 필요 없음(완전 일치 우선). multipart field: file.
  @Get(':id/evidence')
  @ApiOkEnvelopeArray(EvaluationEvidenceDto)
  listEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('kpiId') kpiId?: string,
  ) {
    return this.evaluationsService.listEvidence(user, id, kpiId);
  }

  @Post(':id/evidence')
  // multer 한도는 메모리 백스톱(20MB). 실사용 상한(10MB)은 서비스가 깔끔한 413(FILE_TOO_LARGE)으로 강제.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedEvidenceFile,
    @Query('kpiId') kpiId: string,
  ) {
    if (!kpiId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'kpiId 가 필요해요.' });
    }
    return this.evaluationsService.uploadEvidence(user, id, kpiId, file);
  }

  @Get(':id/evidence/:evidenceId/download')
  async downloadEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.evaluationsService.getEvidenceFile(user, id, evidenceId);
    res.setHeader('Content-Type', file.mimeType);
    // 한글 파일명 대응 — RFC 5987 filename* 인코딩.
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.send(file.data);
  }

  @Delete(':id/evidence/:evidenceId')
  deleteEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.evaluationsService.deleteEvidence(user, id, evidenceId);
  }

  @Post(':id/submit')
  @ApiOkEnvelope(EvaluationDto)
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.submit(user, id);
  }

  @Post(':id/finalize')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(EvaluationDto)
  finalize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.evaluationsService.finalize(id, user);
  }
}
