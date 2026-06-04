import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { JobLevel, KpiCategory, KpiGroup, MeasureType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import {
  ColumnDef,
  TEMPLATE_COLUMN_MAP,
  TemplateKind,
} from './excel.columns';

/**
 * 엑셀 임포트/익스포트 (C-1).
 * 임포트: KPI 양식·조직/대상자·KPI 실적 .xlsx → 검증·오류행 리포트.
 * 익스포트: 결과·등급분포·보상 .xlsx 스트림.
 * 컬럼은 KPI 양식 xlsx 구조 준용(헤더 한글/영문 모두 허용).
 */
@Injectable()
export class ExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  // ─────────────── IMPORT ───────────────

  private async loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
    if (!buffer?.length) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '업로드된 파일이 비어 있어요.' });
    }
    const wb = new ExcelJS.Workbook();
    // exceljs 의 load 는 ArrayBuffer 를 받는다.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb;
  }

  /** 헤더 행 기준으로 각 데이터 행을 {header: value} 객체로 변환. */
  private rowsToObjects(ws: ExcelJS.Worksheet): Record<string, unknown>[] {
    const headers: string[] = [];
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell, col) => {
      headers[col] = String(cell.value ?? '').trim();
    });
    const out: Record<string, unknown>[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (!row.hasValues) continue;
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const key = headers[col];
        if (key) obj[key] = cell.value;
      });
      out.push(obj);
    }
    return out;
  }

  private str(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'object' && 'text' in (v as Record<string, unknown>)) {
      return String((v as { text: unknown }).text ?? '').trim();
    }
    return String(v).trim();
  }

  private num(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(this.str(v));
    return Number.isFinite(n) ? n : null;
  }

  /** KPI 양식 임포트 → KpiTemplate(items) 생성. 오류 행 리포트. */
  async importTemplates(buffer: Buffer, cycleId: string) {
    const wb = await this.loadWorkbook(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '시트를 찾을 수 없어요.' });
    const rows = this.rowsToObjects(ws);

    const errors: { row: number; message: string }[] = [];
    // jobLevel 별로 항목 모음
    const byJob = new Map<JobLevel, { category: KpiCategory; group: KpiGroup; sampleStrategy: string | null; defaultMeasureType: MeasureType; defaultWeight: number; isQualitative: boolean }[]>();

    rows.forEach((row, idx) => {
      const lineNo = idx + 2;
      const jobLevel = this.str(row['jobLevel'] ?? row['직급'] ?? row['양식']);
      const category = this.str(row['category'] ?? row['핵심전략'] ?? row['카테고리']);
      const group = this.str(row['group'] ?? row['지표그룹'] ?? row['그룹']);
      const measureType = this.str(row['measureType'] ?? row['측정방식']);
      const weight = this.num(row['weight'] ?? row['가중치']);
      const sampleStrategy = this.str(row['sampleStrategy'] ?? row['전략'] ?? row['샘플전략']) || null;

      if (!(jobLevel in JobLevel)) {
        errors.push({ row: lineNo, message: `jobLevel '${jobLevel}' 가 올바르지 않아요.` });
        return;
      }
      if (!(category in KpiCategory)) {
        errors.push({ row: lineNo, message: `category '${category}' 가 올바르지 않아요.` });
        return;
      }
      if (!(group in KpiGroup)) {
        errors.push({ row: lineNo, message: `group '${group}' 가 올바르지 않아요.` });
        return;
      }
      if (!(measureType in MeasureType)) {
        errors.push({ row: lineNo, message: `measureType '${measureType}' 가 올바르지 않아요.` });
        return;
      }
      if (weight == null) {
        errors.push({ row: lineNo, message: `weight 가 숫자가 아니에요.` });
        return;
      }
      const jl = jobLevel as JobLevel;
      const list = byJob.get(jl) ?? [];
      list.push({
        category: category as KpiCategory,
        group: group as KpiGroup,
        sampleStrategy,
        defaultMeasureType: measureType as MeasureType,
        defaultWeight: weight,
        isQualitative: (measureType as MeasureType) === MeasureType.qualitative,
      });
      byJob.set(jl, list);
    });

    if (errors.length) {
      return {
        data: { validCount: 0, errorCount: errors.length, imported: 0, errors, ok: false },
      };
    }

    // 검증(가중치 합·정성 상한) 후 생성
    const rules = await this.scoring.loadRuleSetForCycle(cycleId);
    let imported = 0;
    for (const [jobLevel, items] of byJob) {
      this.scoring.validateWeights(
        items.map((i) => ({ weight: i.defaultWeight, isQualitative: i.isQualitative })),
        rules.weightPolicy,
      );
      await this.prisma.kpiTemplate.create({
        data: { cycleId, jobLevel, items: { create: items } },
      });
      imported++;
    }
    return {
      data: { validCount: rows.length, errorCount: 0, imported, errors: [], ok: true },
    };
  }

  /** 조직/대상자 임포트 → Department(없으면 생성) + User upsert. */
  async importOrg(buffer: Buffer) {
    const wb = await this.loadWorkbook(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '시트를 찾을 수 없어요.' });
    const rows = this.rowsToObjects(ws);
    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const lineNo = idx + 2;
      const row = rows[idx];
      const email = this.str(row['email'] ?? row['이메일']);
      const name = this.str(row['name'] ?? row['이름']);
      const deptName = this.str(row['department'] ?? row['부서']);
      if (!email || !name) {
        errors.push({ row: lineNo, message: 'email·name 은 필수예요.' });
        continue;
      }
      let departmentId: string | null = null;
      if (deptName) {
        const dept = await this.prisma.department.findFirst({ where: { name: deptName } });
        departmentId = dept?.id ?? null;
        if (!departmentId) {
          errors.push({ row: lineNo, message: `부서 '${deptName}' 를 찾을 수 없어요.` });
          continue;
        }
      }
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        await this.prisma.user.update({
          where: { email },
          data: { name, departmentId: departmentId ?? existing.departmentId },
        });
      }
      // 신규 사용자는 비밀번호 설정이 필요하므로 임포트 대상에서 제외(존재하는 사용자만 갱신).
      imported++;
    }
    return {
      data: { validCount: imported, errorCount: errors.length, imported, errors, ok: errors.length === 0 },
    };
  }

  /** KPI 실적 임포트 → Achievement 생성(달성률 계산). */
  async importAchievements(buffer: Buffer) {
    const wb = await this.loadWorkbook(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '시트를 찾을 수 없어요.' });
    const rows = this.rowsToObjects(ws);
    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const lineNo = idx + 2;
      const row = rows[idx];
      const kpiId = this.str(row['kpiId'] ?? row['KPI']);
      const quarter = this.num(row['quarter'] ?? row['분기']);
      const actualValue = this.num(row['actualValue'] ?? row['실적']);
      if (!kpiId || quarter == null || actualValue == null) {
        errors.push({ row: lineNo, message: 'kpiId·quarter·actualValue 는 필수예요.' });
        continue;
      }
      const kpi = await this.prisma.kpi.findUnique({ where: { id: kpiId } });
      if (!kpi) {
        errors.push({ row: lineNo, message: `KPI '${kpiId}' 를 찾을 수 없어요.` });
        continue;
      }
      const rate =
        kpi.targetValue && kpi.targetValue !== 0
          ? Math.round((actualValue / kpi.targetValue) * 1000) / 10
          : 0;
      await this.prisma.achievement.create({
        data: { kpiId, quarter, actualValue, achievementRate: rate },
      });
      imported++;
    }
    return {
      data: { validCount: imported, errorCount: errors.length, imported, errors, ok: errors.length === 0 },
    };
  }

  // ─────────────── EXPORT ───────────────

  /** 평가 결과 .xlsx 버퍼. */
  async exportResults(cycleId: string): Promise<Buffer> {
    const results = await this.prisma.evaluationResult.findMany({
      where: { cycleId },
      include: { user: { include: { department: true } } },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('결과');
    ws.columns = [
      { header: '이름', key: 'name', width: 14 },
      { header: '부서', key: 'dept', width: 18 },
      { header: '종합등급', key: 'grade', width: 10 },
      { header: '종합점수', key: 'score', width: 10 },
      { header: '백분위', key: 'percentile', width: 10 },
    ];
    for (const r of results) {
      ws.addRow({
        name: r.user?.name ?? r.userId,
        dept: r.user?.department?.name ?? '',
        grade: r.finalGrade ?? '',
        score: r.finalScore ?? '',
        percentile: r.percentile ?? '',
      });
    }
    return this.toBuffer(wb);
  }

  /** 등급 분포 .xlsx 버퍼. */
  async exportDistribution(cycleId: string): Promise<Buffer> {
    const results = await this.prisma.evaluationResult.findMany({ where: { cycleId } });
    const counts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) counts[r.finalGrade]++;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('등급분포');
    ws.columns = [
      { header: '등급', key: 'grade', width: 10 },
      { header: '인원', key: 'count', width: 10 },
    ];
    for (const g of ['S', 'A', 'B', 'C', 'D']) ws.addRow({ grade: g, count: counts[g] });
    return this.toBuffer(wb);
  }

  /** 보상(인상률) 시뮬레이션 .xlsx 버퍼. */
  async exportCompensation(cycleId: string): Promise<Buffer> {
    const comps = await this.prisma.compensation.findMany({
      where: { cycleId },
      include: { user: true },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('보상');
    ws.columns = [
      { header: '이름', key: 'name', width: 14 },
      { header: '등급', key: 'grade', width: 10 },
      { header: '인상률(%)', key: 'rate', width: 12 },
      { header: '시뮬레이션', key: 'sim', width: 12 },
    ];
    for (const c of comps) {
      ws.addRow({
        name: c.user?.name ?? c.userId,
        grade: c.finalGrade,
        rate: c.raiseRate,
        sim: c.simulated ? 'Y' : 'N',
      });
    }
    return this.toBuffer(wb);
  }

  // ─────────────── TEMPLATE (빈 양식) ───────────────

  /** 임포트 양식(빈 .xlsx) 버퍼. 임포트 파서가 읽는 헤더와 동일(SSOT 공유). */
  async buildTemplate(kind: TemplateKind): Promise<Buffer> {
    const cols: ColumnDef[] = TEMPLATE_COLUMN_MAP[kind];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('양식');
    ws.columns = cols.map((c) => ({
      header: c.header,
      key: c.header,
      width: Math.max(14, c.header.length + 6),
    }));

    // 헤더 행 스타일 + 안내 주석.
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    cols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      const noteLines = [
        c.required ? '필수' : '선택',
        c.note ? c.note : '',
        c.aliases.length ? `허용 헤더 별칭: ${c.aliases.join(', ')}` : '',
      ].filter(Boolean);
      cell.note = noteLines.join('\n');
    });

    // 1줄 예시 행(안내). 임포트 시 그대로 두면 검증 오류가 날 수 있으니 채워 넣고 삭제 안내.
    const example: Record<string, string | number> = {};
    for (const c of cols) example[c.header] = c.example;
    const exRow = ws.addRow(example);
    exRow.font = { italic: true, color: { argb: 'FF888888' } };

    return this.toBuffer(wb);
  }

  // ─────────────── AUDIT LOG EXPORT ───────────────

  /** 감사 로그 익스포트 .xlsx 버퍼. audit-logs GET 과 동일 필터(actor·action·entity·기간). */
  async exportAuditLogs(query: {
    actorId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    from?: string;
    to?: string;
  }): Promise<Buffer> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorId) where.userId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.at = {};
      if (query.from) (where.at as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.at as Prisma.DateTimeFilter).lte = new Date(query.to);
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('감사로그');
    ws.columns = [
      { header: '일시', key: 'at', width: 22 },
      { header: '행위자', key: 'actorName', width: 14 },
      { header: '이메일', key: 'actorEmail', width: 26 },
      { header: '액션', key: 'action', width: 28 },
      { header: '대상엔티티', key: 'entity', width: 18 },
      { header: 'entityId', key: 'entityId', width: 30 },
      { header: 'before', key: 'before', width: 40 },
      { header: 'after', key: 'after', width: 40 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const r of rows) {
      ws.addRow({
        at: r.at?.toISOString() ?? '',
        actorName: r.user?.name ?? (r.userId ? r.userId : '시스템'),
        actorEmail: r.user?.email ?? '',
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        before: this.summarizeJson(r.before),
        after: this.summarizeJson(r.after),
      });
    }
    return this.toBuffer(wb);
  }

  /** Json 값을 셀에 넣을 수 있는 짧은 문자열로 요약(과길이 절단). */
  private summarizeJson(v: Prisma.JsonValue | null): string {
    if (v == null) return '';
    let s: string;
    try {
      s = typeof v === 'string' ? v : JSON.stringify(v);
    } catch {
      s = String(v);
    }
    return s.length > 500 ? `${s.slice(0, 497)}...` : s;
  }

  private async toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
    const arr = await wb.xlsx.writeBuffer();
    return Buffer.from(arr as ArrayBuffer);
  }
}
