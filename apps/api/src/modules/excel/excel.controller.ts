import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ExcelService } from './excel.service';
import { TEMPLATE_COLUMN_MAP, TemplateKind } from './excel.columns';
import { Roles } from '../../common/decorators/roles';

const TEMPLATE_KINDS = Object.keys(TEMPLATE_COLUMN_MAP) as TemplateKind[];

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 업로드 파일 최소 타입(@types/multer 글로벌 네임스페이스 의존 회피). */
interface UploadedXlsx {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller('excel')
@Roles(Role.hr_admin)
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  // ── 임포트 (multipart, field: file) ──
  @Post('import/templates')
  @UseInterceptors(FileInterceptor('file'))
  importTemplates(
    @UploadedFile() file: UploadedXlsx,
    @Query('cycleId') cycleId: string,
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    if (!cycleId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'cycleId 가 필요해요.' });
    return this.excelService.importTemplates(file.buffer, cycleId);
  }

  @Post('import/org')
  @UseInterceptors(FileInterceptor('file'))
  importOrg(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importOrg(file.buffer);
  }

  /** M3 Item1: 임직원 명부(6컬럼) 일괄 온보딩 — 조직 트리 + 사용자 upsert(초기비번 1234). */
  @Post('import/roster')
  @UseInterceptors(FileInterceptor('file'))
  importRoster(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importRoster(file.buffer);
  }

  @Post('import/achievements')
  @UseInterceptors(FileInterceptor('file'))
  importAchievements(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importAchievements(file.buffer);
  }

  // ── 양식(빈 템플릿) 다운로드 ──
  @Get('template/:kind')
  async downloadTemplate(@Param('kind') kind: string, @Res() res: Response) {
    if (!TEMPLATE_KINDS.includes(kind as TemplateKind)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `kind 는 ${TEMPLATE_KINDS.join(' | ')} 중 하나여야 해요.`,
      });
    }
    const buf = await this.excelService.buildTemplate(kind as TemplateKind);
    this.sendXlsx(res, `template-${kind}.xlsx`, buf);
  }

  // ── 익스포트 (스트림 다운로드) ──
  @Get('export/audit')
  async exportAudit(
    @Query('actorId') actorId: string,
    @Query('action') action: string,
    @Query('entity') entity: string,
    @Query('entityId') entityId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buf = await this.excelService.exportAuditLogs({
      actorId,
      action,
      entity,
      entityId,
      from,
      to,
    });
    this.sendXlsx(res, 'audit-logs.xlsx', buf);
  }

  @Get('export/results')
  async exportResults(@Query('cycleId') cycleId: string, @Res() res: Response) {
    const buf = await this.excelService.exportResults(cycleId);
    this.sendXlsx(res, `results-${cycleId}.xlsx`, buf);
  }

  @Get('export/distribution')
  async exportDistribution(@Query('cycleId') cycleId: string, @Res() res: Response) {
    const buf = await this.excelService.exportDistribution(cycleId);
    this.sendXlsx(res, `distribution-${cycleId}.xlsx`, buf);
  }

  @Get('export/compensation')
  async exportCompensation(@Query('cycleId') cycleId: string, @Res() res: Response) {
    const buf = await this.excelService.exportCompensation(cycleId);
    this.sendXlsx(res, `compensation-${cycleId}.xlsx`, buf);
  }

  private sendXlsx(res: Response, filename: string, buf: Buffer): void {
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }
}
