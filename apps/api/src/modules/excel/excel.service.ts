import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DepartmentType, JobLevel, KpiCategory, KpiGroup, MeasureType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import {
  defaultRoleScope,
  deriveJobLevel,
  isHrDeptName,
  parseKoreanPosition,
  INITIAL_PASSWORD,
} from '../../common/access/position.util';
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

  /**
   * M3 Item1: 임직원 명부 임포트 → 조직 트리(group→division→team) upsert + 사용자 upsert.
   * 시트 컬럼: 그룹|본부|팀|직급|이름|이메일 (본부/팀 빈값 허용=상위 직속).
   * - 조직: 이름 기준 매칭/생성(같은 부모 아래 같은 이름이면 재사용). 멱등.
   * - 사용자: email 기준 upsert. position 한글→enum, deptId=최하위 소속,
   *   초기비번 1234 bcrypt + mustChangePassword=true, role/visibilityScope 자동기본.
   * 응답: { validCount, errorCount, imported, errors:[{row,message}] }.
   */
  async importRoster(buffer: Buffer) {
    const wb = await this.loadWorkbook(buffer);
    // "임직원 명부" 시트 우선, 없으면 첫 시트.
    const ws =
      wb.worksheets.find((w) => w.name.includes('명부')) ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '시트를 찾을 수 없어요.' });
    const rows = this.rowsToObjects(ws);

    const errors: { row: number; message: string }[] = [];
    let validCount = 0;
    let imported = 0;

    // 부서 캐시: parentId + name → id (멱등 매칭). 초기 로드.
    const deptCache = new Map<string, string>();
    const existingDepts = await this.prisma.department.findMany({
      select: { id: true, name: true, parentId: true },
    });
    for (const d of existingDepts) {
      deptCache.set(`${d.parentId ?? 'ROOT'}::${d.name}`, d.id);
    }

    const upsertDept = async (
      name: string,
      type: DepartmentType,
      parentId: string | null,
    ): Promise<string> => {
      const key = `${parentId ?? 'ROOT'}::${name}`;
      const cached = deptCache.get(key);
      if (cached) return cached;
      const created = await this.prisma.department.create({
        data: { name, type, parentId },
      });
      deptCache.set(key, created.id);
      return created.id;
    };

    for (let idx = 0; idx < rows.length; idx++) {
      const lineNo = idx + 2;
      const row = rows[idx];
      const groupName = this.str(row['그룹'] ?? row['group']);
      const divisionName = this.str(row['본부'] ?? row['division']);
      const teamName = this.str(row['팀'] ?? row['team']);
      const positionLabel = this.str(row['직급'] ?? row['직책'] ?? row['position']);
      const name = this.str(row['이름'] ?? row['name']);
      const email = this.str(row['이메일'] ?? row['email']).toLowerCase();

      if (!groupName) {
        errors.push({ row: lineNo, message: '그룹은 필수예요.' });
        continue;
      }
      if (!name || !email) {
        errors.push({ row: lineNo, message: '이름·이메일은 필수예요.' });
        continue;
      }
      const position = parseKoreanPosition(positionLabel);
      if (!position) {
        errors.push({ row: lineNo, message: `직급 '${positionLabel}'을(를) 인식할 수 없어요.` });
        continue;
      }

      // 조직 트리 upsert (group → division? → team?)
      let parentId: string | null = null;
      let leafDeptId: string;
      let leafDeptName: string;
      parentId = await upsertDept(groupName, DepartmentType.group, null);
      leafDeptId = parentId;
      leafDeptName = groupName;
      if (divisionName) {
        parentId = await upsertDept(divisionName, DepartmentType.division, parentId);
        leafDeptId = parentId;
        leafDeptName = divisionName;
      }
      if (teamName) {
        leafDeptId = await upsertDept(teamName, DepartmentType.team, parentId);
        leafDeptName = teamName;
      }

      // role/scope 자동기본 (HR팀 소속 판정 = 최하위 부서명)
      const { role, scope } = defaultRoleScope(position, isHrDeptName(leafDeptName));
      const jobLevel = deriveJobLevel(position);

      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        // 멱등: 이름·직급·소속·파생 role/scope/jobLevel 갱신. 비밀번호는 보존(재해시 안 함).
        await this.prisma.user.update({
          where: { email },
          data: {
            name,
            position,
            departmentId: leafDeptId,
            role,
            visibilityScope: scope,
            jobLevel,
            isActive: true,
          },
        });
      } else {
        const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);
        await this.prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role,
            position,
            jobLevel,
            departmentId: leafDeptId,
            visibilityScope: scope,
            mustChangePassword: true,
            isActive: true,
          },
        });
      }
      validCount++;
      imported++;
    }

    return {
      data: {
        validCount,
        errorCount: errors.length,
        imported,
        errors,
        ok: errors.length === 0,
      },
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

  // ─────────────── M3 Item 9: 개인 평가 결과 내보내기 ───────────────

  /**
   * 개인 평가 결과 데이터 수집 (Excel/HTML 공용).
   * 기본정보 + KPI별 자기/팀장/본부장 점수·등급·코멘트 + 최종 등급 + 역량 평가(참고).
   */
  private async collectResultExport(userId: string, cycleId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    const cycle = await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } });
    const result = await this.prisma.evaluationResult.findUnique({
      where: { userId_cycleId: { userId, cycleId } },
    });

    const kpis = await this.prisma.kpi.findMany({
      where: { userId, cycleId },
      orderBy: { createdAt: 'asc' },
    });

    // 평가별 KpiScore 를 (kpiId, type/round) 로 인덱싱.
    const evals = await this.prisma.evaluation.findMany({
      where: { cycleId, evaluateeId: userId },
      include: { kpiScores: true },
    });
    const scoreKey = (kpiId: string, type: string, round: number | null) =>
      `${kpiId}|${type}|${round ?? ''}`;
    const scoreMap = new Map<string, { grade: string | null; score: number }>();
    for (const e of evals) {
      for (const s of e.kpiScores) {
        scoreMap.set(scoreKey(s.kpiId, e.type, e.round), {
          grade: s.grade,
          score: s.score,
        });
      }
    }

    const kpiRows = kpis.map((k) => ({
      title: k.title,
      category: k.category,
      group: k.group,
      weight: k.weight,
      self: scoreMap.get(scoreKey(k.id, 'self', null)) ?? null,
      downward1: scoreMap.get(scoreKey(k.id, 'downward', 1)) ?? null,
      downward2: scoreMap.get(scoreKey(k.id, 'downward', 2)) ?? null,
    }));

    // 역량 평가(참고용).
    const competency = await this.prisma.competencyResponse.findMany({
      where: { userId, cycleId },
      include: { question: { select: { text: true, order: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const competencyRows = competency
      .map((c) => ({
        text: c.question?.text ?? c.questionId,
        order: c.question?.order ?? 0,
        grade: c.grade,
        comment: c.comment ?? '',
      }))
      .sort((a, b) => a.order - b.order);

    return {
      user: {
        name: user?.name ?? userId,
        department: user?.department?.name ?? '',
        position: user?.position ?? '',
      },
      cycleName: cycle?.name ?? cycleId,
      finalGrade: result?.finalGrade ?? null,
      finalScore: result?.finalScore ?? null,
      percentile: result?.percentile ?? null,
      kpiRows,
      competencyRows,
    };
  }

  /** 개인 평가 결과 .xlsx 버퍼 (KPI 시트 + 역량 시트). */
  async exportUserResult(userId: string, cycleId: string): Promise<Buffer> {
    const d = await this.collectResultExport(userId, cycleId);
    const wb = new ExcelJS.Workbook();

    // 시트1: KPI 평가.
    const ws = wb.addWorksheet('평가결과');
    ws.addRow(['이름', d.user.name]);
    ws.addRow(['부서', d.user.department]);
    ws.addRow(['직책', d.user.position]);
    ws.addRow(['평가 주기', d.cycleName]);
    ws.addRow(['최종 종합 등급', d.finalGrade ?? '-']);
    ws.addRow(['최종 종합 점수', d.finalScore ?? '-']);
    ws.addRow(['전사 상위 %', d.percentile != null ? `${d.percentile}%` : '-']);
    ws.addRow([]);
    const header = ws.addRow([
      'KPI',
      '카테고리',
      '지표그룹',
      '가중치',
      '본인평가(등급)',
      '본인평가(점수)',
      '팀장평가(등급)',
      '팀장평가(점수)',
      '본부장평가(등급)',
      '본부장평가(점수)',
    ]);
    header.font = { bold: true };
    for (const r of d.kpiRows) {
      ws.addRow([
        r.title,
        r.category,
        r.group,
        r.weight,
        r.self?.grade ?? '',
        r.self?.score ?? '',
        r.downward1?.grade ?? '',
        r.downward1?.score ?? '',
        r.downward2?.grade ?? '',
        r.downward2?.score ?? '',
      ]);
    }

    // 시트2: 역량 평가(연봉 미반영).
    const cs = wb.addWorksheet('역량평가');
    cs.addRow(['※ 본 평가는 연봉에 반영되지 않습니다.']);
    cs.addRow([]);
    const ch = cs.addRow(['질문', '등급', '코멘트']);
    ch.font = { bold: true };
    for (const c of d.competencyRows) {
      cs.addRow([c.text, c.grade, c.comment]);
    }

    return this.toBuffer(wb);
  }

  /** 개인 평가 결과 HTML 문자열 (브라우저 인쇄 → PDF). */
  async exportUserResultHtml(userId: string, cycleId: string): Promise<string> {
    const d = await this.collectResultExport(userId, cycleId);
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const kpiBody = d.kpiRows
      .map(
        (r) => `<tr>
          <td>${esc(r.title)}</td>
          <td>${esc(r.category)}</td>
          <td>${esc(r.group)}</td>
          <td class="num">${esc(r.weight)}</td>
          <td>${esc(r.self?.grade ?? '-')}</td>
          <td>${esc(r.downward1?.grade ?? '-')}</td>
          <td>${esc(r.downward2?.grade ?? '-')}</td>
        </tr>`,
      )
      .join('');

    const compBody = d.competencyRows
      .map(
        (c) => `<tr><td>${esc(c.text)}</td><td>${esc(c.grade)}</td><td>${esc(c.comment)}</td></tr>`,
      )
      .join('');

    return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<title>평가 결과 - ${esc(d.user.name)}</title>
<style>
  body{font-family:'Pretendard',system-ui,sans-serif;color:#1d1d1f;margin:40px;}
  h1{font-size:24px;letter-spacing:-0.02em;}
  h2{font-size:18px;margin-top:32px;}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;}
  th,td{border:1px solid #d2d2d7;padding:8px 10px;text-align:left;}
  th{background:#f5f5f7;}
  td.num{text-align:right;}
  .meta{margin:8px 0;}
  .meta b{display:inline-block;width:120px;color:#6e6e73;}
  .grade{font-size:20px;font-weight:700;color:#0066cc;}
  .note{color:#86868b;font-size:13px;margin-top:8px;}
  @media print{body{margin:16px;}}
</style></head>
<body>
  <h1>${esc(d.cycleName)} 평가 결과</h1>
  <div class="meta"><b>이름</b>${esc(d.user.name)}</div>
  <div class="meta"><b>부서</b>${esc(d.user.department)}</div>
  <div class="meta"><b>직책</b>${esc(d.user.position)}</div>
  <div class="meta"><b>최종 종합 등급</b><span class="grade">${esc(d.finalGrade ?? '-')}</span> (점수 ${esc(d.finalScore ?? '-')})</div>
  <div class="meta"><b>전사 상위 %</b>${d.percentile != null ? `${d.percentile}%` : '-'}</div>

  <h2>KPI 평가</h2>
  <table>
    <thead><tr><th>KPI</th><th>카테고리</th><th>지표그룹</th><th>가중치</th><th>본인</th><th>팀장</th><th>본부장</th></tr></thead>
    <tbody>${kpiBody || '<tr><td colspan="7">KPI 없음</td></tr>'}</tbody>
  </table>

  <h2>역량 평가</h2>
  <p class="note">※ 본 평가는 연봉에 반영되지 않습니다.</p>
  <table>
    <thead><tr><th>질문</th><th>등급</th><th>코멘트</th></tr></thead>
    <tbody>${compBody || '<tr><td colspan="3">응답 없음</td></tr>'}</tbody>
  </table>
</body></html>`;
  }
}
