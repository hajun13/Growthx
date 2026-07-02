import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { AppealsService } from './appeals.service';
import {
  AppealAttachmentsService,
  UploadedAppealFile,
} from './appeal-attachments.service';
import {
  CreateAppealDto,
  DecideAppealDto,
  ListAppealsQuery,
  RespondAppealDto,
} from './dto/appeal.dto';
import {
  AppealAttachmentDto,
  AppealDto,
  AppealRecordDto,
} from './dto/appeal-response.dto';
import {
  ApiOkEnvelope,
  ApiOkEnvelopeArray,
} from '../../common/swagger/api-envelope.decorator';
import { Roles } from '../../common/decorators/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';

@ApiTags('appeals')
@Controller('appeals')
export class AppealsController {
  constructor(
    private readonly appealsService: AppealsService,
    private readonly attachments: AppealAttachmentsService,
  ) {}

  @Get()
  @ApiOkEnvelopeArray(AppealDto)
  list(@CurrentUser() user: AuthUser, @Query() query: ListAppealsQuery) {
    return this.appealsService.list(user, query);
  }

  @Post()
  @ApiOkEnvelope(AppealRecordDto)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppealDto) {
    return this.appealsService.create(user, dto);
  }

  /** 팀장 1차 답변. */
  @Post(':id/respond')
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead)
  @ApiOkEnvelope(AppealRecordDto)
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondAppealDto,
  ) {
    return this.appealsService.respond(user, id, dto);
  }

  /** HR 최종 결정 (5지 분기 캐스케이드). */
  @Post(':id/decide')
  @Roles(Role.hr_admin)
  @ApiOkEnvelope(AppealRecordDto)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecideAppealDto,
  ) {
    return this.appealsService.decide(user, id, dto);
  }

  // ── 이의제기 증빙 첨부 (EvaluationEvidence 패턴). multipart field: file. ──
  @Get(':id/attachments')
  @ApiOkEnvelopeArray(AppealAttachmentDto)
  listAttachments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attachments.list(user, id);
  }

  @Post(':id/attachments')
  // 업로드는 신청자 본인 또는 HR. 부서장/팀장도 자기 결과에 이의제기를 낼 수 있어(create 무제한)
  // 신청자가 될 수 있으므로 전 역할 허용 + 행 수준 소유권은 서비스 assertUploader 가 재검증.
  @Roles(Role.hr_admin, Role.division_head, Role.team_lead, Role.employee)
  // multer 한도는 메모리 백스톱(20MB). 실사용 상한(10MB)은 서비스가 413(FILE_TOO_LARGE)으로 강제.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiOkEnvelope(AppealAttachmentDto)
  uploadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedAppealFile,
  ) {
    return this.attachments.upload(user, id, file);
  }

  @Get(':id/attachments/:attId/download')
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Res() res: Response,
  ) {
    const file = await this.attachments.getFile(user, id, attId);
    res.setHeader('Content-Type', file.mimeType);
    // 한글 파일명 대응 — RFC 5987 filename* 인코딩.
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.send(file.data);
  }

  @Delete(':id/attachments/:attId')
  deleteAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attId') attId: string,
  ) {
    return this.attachments.remove(user, id, attId);
  }
}
