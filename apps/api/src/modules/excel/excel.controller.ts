import {
  BadRequestException,
  Body,
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
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { ExcelService } from './excel.service';
import { TEMPLATE_COLUMN_MAP, TemplateKind } from './excel.columns';
import { Roles } from '../../common/decorators/roles';
import { RequireFeature } from '../../common/decorators/require-feature';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user';
import { KpiImportCommitDto, KpiImportSubmitDto } from './dto/kpi-import-commit.dto';
import { CompensationIndexCommitDto } from './dto/compensation-index.dto';
import {
  KpiImportPreviewDto,
  KpiImportResultDto,
  KpiImportSubmitResultDto,
} from './dto/kpi-import-response.dto';
import { ApiOkEnvelope } from '../../common/swagger/api-envelope.decorator';

const TEMPLATE_KINDS = Object.keys(TEMPLATE_COLUMN_MAP) as TemplateKind[];

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 업로드 파일 최소 타입(@types/multer 글로벌 네임스페이스 의존 회피). */
interface UploadedXlsx {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@ApiTags('excel')
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

  /** M3 Item1: 임직원 명부(6컬럼) 일괄 온보딩 — 조직 트리 + 사용자 upsert(초기비번 1234). */
  @Post('import/roster')
  @UseInterceptors(FileInterceptor('file'))
  importRoster(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importRoster(file.buffer);
  }

  /** YoY: 과거결과(평가자정리 시트) 임포트. cycleId 생략 시 2025 사이클 자동탐색. */
  @Post('import/legacy-results')
  @UseInterceptors(FileInterceptor('file'))
  importLegacyResults(
    @UploadedFile() file: UploadedXlsx,
    @CurrentUser() user: AuthUser,
    @Query('cycleId') cycleId?: string,
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importLegacyResults(file.buffer, cycleId, user.id);
  }

  @Post('import/achievements')
  @UseInterceptors(FileInterceptor('file'))
  importAchievements(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.importAchievements(file.buffer);
  }

  /** 개인별 KPI 양식 미리보기(적재 안 함). 파싱 결과 + 가중치합·오류행. */
  @Post('import/kpi/preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOkEnvelope(KpiImportPreviewDto)
  previewKpi(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.previewKpi(file.buffer, file.originalname);
  }

  /**
   * 개인별 KPI 양식 적재(draft 생성). userId 필수, cycleId 생략 시 활성 사이클.
   * 멱등: 같은 (userId, cycleId) draft 삭제 후 재생성.
   */
  @Post('import/kpi')
  @UseInterceptors(FileInterceptor('file'))
  importKpi(
    @UploadedFile() file: UploadedXlsx,
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('cycleId') cycleId?: string,
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    if (!userId) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '대상 사용자(userId)가 필요해요.' });
    return this.excelService.importKpi(file.buffer, userId, cycleId, user.id, file.originalname);
  }

  /**
   * 개인별 KPI — 화면에서 편집한 행 적재(JSON body, multipart 아님).
   * 미리보기 후 관리자가 정성/정량 토글·누락 보완한 rows 를 그대로 draft 적재.
   * 멱등: 같은 (userId, cycleId) draft 삭제 후 재생성.
   */
  @Post('import/kpi/commit')
  @ApiOkEnvelope(KpiImportResultDto)
  commitKpi(@Body() dto: KpiImportCommitDto, @CurrentUser() user: AuthUser) {
    return this.excelService.commitKpi(dto, user.id);
  }

  /** 적재된 draft KPI 제출(2단계 — 적재 후 제출). HR 전용. */
  @Post('import/kpi/submit')
  @ApiOkEnvelope(KpiImportSubmitResultDto)
  submitImportedKpi(@Body() dto: KpiImportSubmitDto, @CurrentUser() user: AuthUser) {
    return this.excelService.submitImportedKpi(dto, user.id);
  }

  /**
   * 경영실적(월별 손익) 양식 미리보기(적재 안 함). "…경영실적" 시트의 매출(R6)·원가(R7) 행 추출.
   * 반환 { prevYear, months } 는 그대로 /monthly-performance/bulk 바디(cycleId/departmentId/year 추가)로 변환 가능.
   * 적재는 부서 선택이 필요하므로 미리보기 → 그리드 채움 → bulk 저장(2단계).
   */
  @Post('preview/financial-performance')
  @Roles(Role.hr_admin, Role.division_head)
  @UseInterceptors(FileInterceptor('file'))
  previewFinancialPerformance(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.previewFinancialPerformance(file.buffer, file.originalname);
  }

  /** 보상 Index 시트 미리보기 — 기존 직원 매칭/미등록 구분, 적재 전 화면 편집용. */
  @Post('preview/compensation-index')
  @UseInterceptors(FileInterceptor('file'))
  previewCompensationIndex(@UploadedFile() file: UploadedXlsx) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    return this.excelService.previewCompensationIndex(file.buffer, file.originalname);
  }

  /** 보상 Index 시트 적재 — 미리보기 후 화면에서 수정한 rows 를 저장. */
  @Post('import/compensation-index')
  importCompensationIndex(
    @Body() dto: CompensationIndexCommitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.excelService.importCompensationIndex(dto, user.id);
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
  @RequireFeature('감사로그')
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
  async exportCompensation(
    @Query('cycleId') cycleId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const buf = await this.excelService.exportCompensation(cycleId, user);
    this.sendXlsx(res, `compensation-${cycleId}.xlsx`, buf);
  }

  private sendXlsx(res: Response, filename: string, buf: Buffer): void {
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }
}
