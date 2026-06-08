import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  CycleStatus,
  DepartmentType,
  EmploymentStatus,
  Grade,
  JobLevel,
  KpiCategory,
  KpiGroup,
  KpiStatus,
  LegalEntity,
  MeasureType,
  Prisma,
  Role,
  VisibilityScope,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from '../../common/rules/scoring.service';
import { AuditService } from '../../common/audit/audit.service';
import {
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
import { KpiImportCommitDto } from './dto/kpi-import-commit.dto';

// 감사 로그 익스포트용 한글 라벨(프론트 lib/ui.ts 와 동기화).
const AUDIT_ACTION_LABEL: Record<string, string> = {
  'rule_set.create': '규칙 세트 생성',
  'rule_set.update': '규칙 세트 변경',
  'cycle.schedule.update': '평가 일정 변경',
  'cycle.schedule.lock': '평가 단계 잠금',
  'cycle.schedule.unlock': '평가 단계 재오픈',
  'cycle.kpi_snapshot.create': 'KPI 스냅샷 생성',
  'cycle.delete': '평가 주기 삭제',
  'cycle.legacy_results.import': '과거 평가결과 가져오기',
  'kpi.import': 'KPI 일괄 등록',
  'kpi.import.commit': 'KPI 일괄 등록(편집 적재)',
  'kpi.approve': 'KPI 승인',
  'kpi.reject': 'KPI 반려',
  'kpi_category_policy.update': 'KPI 분류 정책 변경',
  'evaluation.submit': '평가 제출',
  'evaluation.finalize': '평가 확정',
  'evaluation.overall_grade.override': '종합등급 직접 조정',
  'grade_pool.compute': '등급 풀 산정',
  'grade_pool.update': '등급 풀 수정',
  'appeal.decide': '이의제기 처리',
  'competency_question.create': '역량 문항 추가',
  'competency_question.update': '역량 문항 수정',
  'competency_question.delete': '역량 문항 삭제',
  'competency_response.submit': '역량 응답 제출',
  'competency_response.save': '역량 응답 임시저장',
  'monthly_performance.upsert': '월 실적 입력',
  'monthly_performance.update': '월 실적 수정',
  'position.create': '직급 추가',
  'position.update': '직급 수정',
  'position.delete': '직급 삭제',
};
const AUDIT_ENTITY_LABEL: Record<string, string> = {
  RuleSet: '규칙 세트',
  EvaluationCycle: '평가 주기',
  CycleSchedule: '평가 일정',
  Kpi: 'KPI',
  KpiCategoryPolicy: 'KPI 분류 정책',
  Evaluation: '평가',
  GradePool: '등급 풀',
  Appeal: '이의제기',
  MonthlyPerformance: '월 실적',
  PositionDef: '직급',
  CompetencyQuestion: '역량 문항',
  CompetencyResponse: '역량 응답',
};

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
    private readonly audit: AuditService,
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
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // 수식 셀: { formula, result } → result 사용.
      if ('result' in o) return String(o.result ?? '').trim();
      // 리치텍스트(hyperlink/comment): { text } 또는 { richText:[{text}] }.
      if ('richText' in o && Array.isArray(o.richText)) {
        return (o.richText as { text?: unknown }[]).map((t) => String(t.text ?? '')).join('').trim();
      }
      if ('text' in o) return String(o.text ?? '').trim();
      if (v instanceof Date) return v.toISOString();
    }
    return String(v).trim();
  }

  private num(v: unknown): number | null {
    if (v == null || v === '') return null;
    // 수식/객체 셀은 str() 가 result/text 를 풀어준다.
    const s = this.str(v);
    if (s === '' || s === '-') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * 날짜 정규화. ExcelJS Date 객체 · Excel serial number(예: 45505) · 텍스트("2023.12.30","2021-05-13") 혼재 처리.
   * 인식 불가 시 null.
   */
  private toDate(v: unknown): Date | null {
    if (v == null || v === '' || v === '-') return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    // 수식 result 가 Date 인 경우.
    if (typeof v === 'object' && 'result' in (v as Record<string, unknown>)) {
      return this.toDate((v as { result: unknown }).result);
    }
    if (typeof v === 'number') {
      // Excel serial(1900 epoch). 25569 = 1970-01-01. 86400000ms/day.
      if (v > 1 && v < 600000) {
        const ms = Math.round((v - 25569) * 86400000);
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
    const s = this.str(v);
    if (!s || s === '-') return null;
    // "2023.12.30" / "2023-12-30" / "2023/12/30" → ISO.
    const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
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

    // 직급 레지스트리(PositionDef): label/code → 기본값(role/scope/jobLevel) 단일 출처(B-5).
    const posDefs = await this.prisma.positionDef.findMany();
    const defByCode = new Map(posDefs.map((d) => [d.code, d]));
    const codeByLabel = new Map(posDefs.map((d) => [d.label, d.code]));

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
      // 라벨→코드: 레지스트리 label 우선, 없으면 KOREAN_POSITION_MAP 폴백(B-5).
      const position =
        codeByLabel.get(positionLabel.trim()) ?? parseKoreanPosition(positionLabel);
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

      // role/scope/jobLevel 자동기본: 레지스트리 기본값 → HR팀 소속이면 hr_admin/company 오버라이드(B-5).
      const def = defByCode.get(position);
      const isHr = isHrDeptName(leafDeptName);
      const role = isHr ? Role.hr_admin : (def?.defaultRole ?? Role.employee);
      const scope = isHr
        ? VisibilityScope.company
        : (def?.defaultScope ?? VisibilityScope.self);
      const jobLevel = def?.defaultJobLevel ?? deriveJobLevel(position);

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

  // ─────────────── YoY: 과거결과 임포트 (평가자정리 시트) ───────────────

  /** ExcelJS 셀 raw 값(수식 result 풀이 포함). 위치 기반 파서용. */
  private rawCell(ws: ExcelJS.Worksheet, row: number, col: number): unknown {
    const v = ws.getRow(row).getCell(col).value as unknown;
    if (v && typeof v === 'object' && 'result' in (v as Record<string, unknown>)) {
      return (v as { result: unknown }).result;
    }
    return v;
  }

  /** 4대보험 소속 라벨 → LegalEntity. 미일치 시 energyx 기본. */
  private parseLegalEntity(label: string): LegalEntity {
    const n = label.replace(/\s/g, '');
    if (n.includes('미래') || n.includes('mirae')) return LegalEntity.mirae_plan;
    return LegalEntity.energyx;
  }

  /** 한글 등급 문자 → Grade. 미일치 시 null. */
  private parseGrade(label: string): Grade | null {
    const g = label.trim().toUpperCase();
    return (['S', 'A', 'B', 'C', 'D'] as const).includes(g as Grade)
      ? (g as Grade)
      : null;
  }

  /**
   * YoY 과거결과 임포트 — `평가자정리` 시트(헤더 4·5행 2단, 데이터 6행~).
   * 컬럼(1-indexed): 2성명 3법인 4그룹 5본부(- 없음) 6팀(- 없음) 7직급 8직책
   *   9그룹입사일 10입사일 11/12 1차(실적·역량) 13/14 2차 15/16 최종 19최종점수 20최종등급.
   * 이름 매칭 3분기: 재직(연결) / 퇴사(비활성 User 생성) / 검토큐(모호 → 미적재).
   * 멱등: (userId, cycleId) upsert. 원본 등급/점수 우선, 없으면 2025 RuleSet 으로 실적 기반 재계산.
   */
  async importLegacyResults(buffer: Buffer, cycleId: string | undefined, actorId?: string) {
    const wb = await this.loadWorkbook(buffer);
    const ws =
      wb.worksheets.find((w) => w.name.includes('평가자정리')) ?? wb.worksheets[0];
    if (!ws) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '평가자정리 시트를 찾을 수 없어요.' });
    }

    // 대상 사이클: 명시 cycleId 우선, 없으면 year=2025 자동탐색.
    let cycle = cycleId
      ? await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } })
      : await this.prisma.evaluationCycle.findFirst({ where: { year: 2025 } });
    if (!cycle) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: cycleId
          ? '대상 사이클을 찾을 수 없어요.'
          : '2025년 사이클이 없어요. 먼저 seed 로 2025 사이클을 생성해 주세요.',
      });
    }
    const targetCycleId = cycle.id;
    const rules = await this.scoring.loadRuleSetForCycle(targetCycleId);

    // 현재 재직 User 이름 인덱스(매칭용). 동명이인 대비 다중 보관.
    const allUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, departmentId: true, legalEntity: true },
    });
    const byName = new Map<string, typeof allUsers>();
    for (const u of allUsers) {
      const list = byName.get(u.name) ?? [];
      list.push(u);
      byName.set(u.name, list);
    }
    // 부서 id → {groupName, divisionName, teamName} 조상 경로(보조매칭·검증용).
    const deptPath = await this.buildDeptPathMap();

    const errors: { row: number; message: string }[] = [];
    const review: { row: number; name: string; reason: string }[] = [];
    let imported = 0;
    let matched = 0;
    let createdResigned = 0;
    let legalEntityUpdated = 0;

    const lastRow = ws.rowCount;
    for (let r = 6; r <= lastRow; r++) {
      const name = this.str(this.rawCell(ws, r, 2));
      if (!name) continue; // 빈 행 스킵(시트 꼬리).

      const legalLabel = this.str(this.rawCell(ws, r, 3));
      const groupName = this.str(this.rawCell(ws, r, 4));
      const dashOrNull = (s: string) => (s === '' || s === '-' ? null : s);
      const divisionName = dashOrNull(this.str(this.rawCell(ws, r, 5)));
      const teamName = dashOrNull(this.str(this.rawCell(ws, r, 6)));
      const positionLabel = this.str(this.rawCell(ws, r, 7));
      const legalEntity = this.parseLegalEntity(legalLabel);
      const groupJoinedAt = this.toDate(this.rawCell(ws, r, 9));
      const joinedAt = this.toDate(this.rawCell(ws, r, 10));

      // 라운드별 실적·역량 원형.
      const r1Perf = this.num(this.rawCell(ws, r, 11));
      const r1Comp = this.num(this.rawCell(ws, r, 12));
      const r2Perf = this.num(this.rawCell(ws, r, 13));
      const r2Comp = this.num(this.rawCell(ws, r, 14));
      const fPerf = this.num(this.rawCell(ws, r, 15));
      const fComp = this.num(this.rawCell(ws, r, 16));
      const originScore = this.num(this.rawCell(ws, r, 19));
      const originGrade = this.parseGrade(this.str(this.rawCell(ws, r, 20)));

      if (!groupName) {
        errors.push({ row: r, message: `'${name}' 행의 그룹이 비어 있어요.` });
        continue;
      }

      // ── 이름 매칭 3분기 ──
      const candidates = byName.get(name) ?? [];
      let userId: string | null = null;
      let isNewResigned = false;

      if (candidates.length === 1) {
        userId = candidates[0].id;
      } else if (candidates.length > 1) {
        // 동명이인 → 그룹/본부 보조매칭.
        const narrowed = candidates.filter((u) => {
          const p = u.departmentId ? deptPath.get(u.departmentId) : undefined;
          if (!p) return false;
          if (p.group !== groupName) return false;
          if (divisionName && p.division && p.division !== divisionName) return false;
          return true;
        });
        if (narrowed.length === 1) {
          userId = narrowed[0].id;
        } else {
          review.push({
            row: r,
            name,
            reason: `동명이인(${candidates.length}명) — 그룹/본부로도 ${narrowed.length === 0 ? '매칭 실패' : `${narrowed.length}명 모호`}`,
          });
          continue; // 검토큐 → 미적재.
        }
      } else {
        // 매칭 실패 → 퇴사자 User upsert(멱등). 결정적 placeholder 이메일(name+group 슬러그).
        const position = parseKoreanPosition(positionLabel) ?? undefined;
        const email = this.resignedEmail(name, groupName);
        const before = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        const upserted = await this.prisma.user.upsert({
          where: { email },
          create: {
            email,
            name,
            passwordHash: await bcrypt.hash(INITIAL_PASSWORD, 10),
            role: Role.employee,
            position: position ?? 'pro',
            jobLevel: position ? deriveJobLevel(position) : null,
            departmentId: null, // 조직도 통합 트리에는 미배치(스냅샷으로만 보존).
            visibilityScope: VisibilityScope.self,
            isActive: false,
            employmentStatus: EmploymentStatus.resigned,
            resignedAt: joinedAt ?? null,
            legalEntity,
            mustChangePassword: false,
          },
          update: {
            name,
            position: position ?? 'pro',
            jobLevel: position ? deriveJobLevel(position) : null,
            isActive: false,
            employmentStatus: EmploymentStatus.resigned,
            resignedAt: joinedAt ?? null,
            legalEntity,
          },
          select: { id: true },
        });
        userId = upserted.id;
        isNewResigned = true;
        if (!before) createdResigned += 1; // 신규 생성만 카운트(재임포트 시 0).
      }

      if (!userId) continue;

      // 재직 매칭자: legalEntity 갱신(엑셀 기준) + 카운트.
      if (!isNewResigned) {
        matched += 1;
        const existing = candidates.find((u) => u.id === userId);
        if (existing && existing.legalEntity !== legalEntity) {
          await this.prisma.user.update({ where: { id: userId }, data: { legalEntity } });
          legalEntityUpdated += 1;
        }
      }

      // ── 점수·등급 결정: 원본 우선, 없으면 실적 기반 재계산 ──
      let finalScore = originScore;
      let finalGrade: Grade | null = originGrade;
      if (finalGrade == null && finalScore != null) {
        finalGrade = this.scoring.scoreToGrade(finalScore, rules.gradeScale);
      }
      if (finalScore == null && fPerf != null) {
        // 원본 점수 없음 → 최종 실적 점수를 종합점수로(역량 미반영).
        finalScore = fPerf;
        finalGrade = this.scoring.scoreToGrade(fPerf, rules.gradeScale);
      }

      // byType: 라운드별 원형(실적·역량) + source.
      const round = (perf: number | null, comp: number | null) =>
        perf == null && comp == null ? null : { perf, comp };
      const byType = {
        round1: round(r1Perf, r1Comp),
        round2: round(r2Perf, r2Comp),
        final: round(fPerf, fComp),
        source: 'import' as const,
      };

      await this.prisma.evaluationResult.upsert({
        where: { userId_cycleId: { userId, cycleId: targetCycleId } },
        create: {
          userId,
          cycleId: targetCycleId,
          finalGrade,
          finalScore,
          byType: byType as unknown as Prisma.InputJsonValue,
          groupSnapshot: groupName,
          divisionSnapshot: divisionName,
          teamSnapshot: teamName,
        },
        update: {
          finalGrade,
          finalScore,
          byType: byType as unknown as Prisma.InputJsonValue,
          groupSnapshot: groupName,
          divisionSnapshot: divisionName,
          teamSnapshot: teamName,
        },
      });
      imported += 1;
      // 그룹입사일은 현재 미사용(향후 근속 표시용) — 의도적 보존만.
      void groupJoinedAt;
    }

    const total = imported + review.length + errors.length;
    const ok = errors.length === 0 && review.length === 0;

    await this.audit.record({
      entity: 'EvaluationCycle',
      entityId: targetCycleId,
      action: 'cycle.legacy_results.import',
      actorId,
      after: { total, imported, matched, createdResigned, reviewQueue: review.length },
    });

    return {
      data: {
        ok,
        cycleId: targetCycleId,
        total,
        imported,
        matched,
        createdResigned,
        reviewQueue: review.length,
        review,
        errors,
        legalEntityUpdated,
      },
    };
  }

  /** 부서 id → 조상 경로(group/division/team 이름) 매핑. 보조매칭·검증용. */
  private async buildDeptPathMap(): Promise<
    Map<string, { group: string | null; division: string | null; team: string | null }>
  > {
    const depts = await this.prisma.department.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    });
    const byId = new Map(depts.map((d) => [d.id, d]));
    const out = new Map<string, { group: string | null; division: string | null; team: string | null }>();
    for (const d of depts) {
      let group: string | null = null;
      let division: string | null = null;
      let team: string | null = null;
      let cursor: string | null = d.id;
      for (let i = 0; i < 10 && cursor; i++) {
        const node = byId.get(cursor);
        if (!node) break;
        if (node.type === DepartmentType.group) group = node.name;
        else if (node.type === DepartmentType.division) division = node.name;
        else if (node.type === DepartmentType.team) team = node.name;
        cursor = node.parentId;
      }
      out.set(d.id, { group, division, team });
    }
    return out;
  }

  /**
   * 퇴사자 placeholder 이메일(결정적 — 멱등 upsert 키).
   * name+group 슬러그 → 같은 사람 재임포트 시 동일 이메일 → 중복 User 생성 방지.
   * `resigned-{nameHex}-{groupHex}@import.local` (한글 그대로 두면 안전성 낮아 hex 인코딩).
   */
  private resignedEmail(name: string, group: string): string {
    const hex = (s: string) =>
      Buffer.from(s.trim()).toString('hex').slice(0, 24);
    return `resigned-${hex(name)}-${hex(group)}@import.local`;
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

  // ─────────────── 개인별 KPI 양식 임포트 (kpi-import-contract §1·2·4) ───────────────

  /**
   * 핵심전략(한글) → KpiCategory/KpiGroup 매핑 테이블.
   * 정규화: 공백·개행·`&` 제거 후 includes 매칭. 미매칭 → null(데이터 끝/무시).
   * 'orders' 의 '업무수행' 스템은 실양식 변이('업무수행평가'·'업무수행성과') 포괄을 위한 확장(계약 §2 표 보완 — 변경통지 필요).
   */
  private static readonly KPI_CATEGORY_MAP: ReadonlyArray<{
    keys: string[];
    category: KpiCategory;
    group: KpiGroup;
  }> = [
    { keys: ['매출액'], category: KpiCategory.revenue, group: KpiGroup.performance_core },
    { keys: ['공정액'], category: KpiCategory.construction, group: KpiGroup.performance_core },
    {
      keys: ['수주업무수행성과', '업무수행성과', '업무수행평가', '업무수행', '수주'],
      category: KpiCategory.orders,
      group: KpiGroup.performance_core,
    },
    { keys: ['협업성과', '협업'], category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth },
    { keys: ['자기개발', '자기계발'], category: KpiCategory.development, group: KpiGroup.collaboration_growth },
  ];

  /** 핵심전략 텍스트 → {category, group}. 미매칭 시 null. */
  private mapKpiCategory(raw: string): { category: KpiCategory; group: KpiGroup } | null {
    const n = raw.replace(/\s/g, '').replace(/&/g, '');
    if (!n) return null;
    for (const m of ExcelService.KPI_CATEGORY_MAP) {
      for (const k of m.keys) {
        if (n.includes(k)) return { category: m.category, group: m.group };
      }
    }
    return null;
  }

  /** 헤더 셀 텍스트 정규화: 공백·개행 전부 제거(병합·줄바꿈 헤더 매칭용). */
  private normHeader(v: unknown): string {
    return this.str(v).replace(/[\s ]/g, '');
  }

  /**
   * 헤더 텍스트 기반 동적 열 매핑(고정 위치 파서 대체).
   * 양식 레이아웃 변이(변형A=가중치4칸 H~K·등급 L~P / 변형B=가중치1칸 H·등급 I~M /
   * 구버전=좌측 패딩 없음·헤더 2행) 를 모두 자동 흡수한다.
   *
   * 절차:
   *  1) 1~8행을 훑어 '핵심전략' + ('성과관리지표/KPI' 또는 '측정방식') 가 함께 있는 행을 헤더 상단행으로.
   *  2) 상단행 텍스트로 논리 필드(category·csf·title·targetText·measureMethod) 열 매핑.
   *  3) 가중치: 상단행이 '가중치' 인 열 전체 집합(병합으로 1칸 또는 4칸).
   *  4) 등급기준 S~D: 하위행(상단행+1)이 정확히 S/A/B/C/D 인 열을 각각 매핑.
   *  5) 데이터 시작행: 헤더(상단행) + 2(점수구간 행 다음). 안전하게 카테고리 매핑으로 끝 판정.
   * 못 찾으면 null.
   */
  private detectKpiColumns(ws: ExcelJS.Worksheet): {
    headerRow: number;
    dataStart: number;
    cols: {
      category: number | null;
      csf: number | null;
      title: number | null;
      targetText: number | null;
      measureMethod: number | null;
    };
    weightCols: number[];
    grading: Partial<Record<'S' | 'A' | 'B' | 'C' | 'D', number>>;
  } | null {
    const maxCol = Math.max(ws.columnCount, 20);

    // 1) 헤더 상단행 탐지.
    let headerRow = -1;
    for (let r = 1; r <= 8; r++) {
      const cells: string[] = [];
      for (let c = 1; c <= maxCol; c++) cells.push(this.normHeader(this.rawCell(ws, r, c)));
      const hasCat = cells.some((x) => x.includes('핵심전략'));
      const hasKpi = cells.some((x) => x.includes('성과관리지표') || x.includes('KPI'));
      const hasMeasure = cells.some((x) => x.includes('측정방식'));
      if (hasCat && (hasKpi || hasMeasure)) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) return null;

    const top: string[] = [];
    const sub: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      top[c] = this.normHeader(this.rawCell(ws, headerRow, c));
      sub[c] = this.normHeader(this.rawCell(ws, headerRow + 1, c));
    }

    const find = (pred: (t: string) => boolean): number | null => {
      for (let c = 1; c <= maxCol; c++) if (top[c] && pred(top[c])) return c;
      return null;
    };

    const cols = {
      category: find((t) => t.includes('핵심전략')),
      csf: find((t) => t.includes('전략목표') || t.toUpperCase().includes('CSF')),
      title: find((t) => t.includes('성과관리지표') || t.includes('KPI')),
      // '2026목표' 또는 '목표'(단, '전략목표'=CSF 는 제외).
      targetText: find((t) => t.includes('2026') || (t.includes('목표') && !t.includes('전략'))),
      measureMethod: find((t) => t.includes('측정방식')),
    };

    // 가중치 열 집합(상단행이 '가중치'). 병합 시 1칸, 직급별 분리 시 다칸.
    const weightCols: number[] = [];
    for (let c = 1; c <= maxCol; c++) if (top[c].includes('가중치')) weightCols.push(c);

    // 등급기준 S~D: 하위행이 정확히 S/A/B/C/D 인 열.
    const grading: Partial<Record<'S' | 'A' | 'B' | 'C' | 'D', number>> = {};
    for (let c = 1; c <= maxCol; c++) {
      const s = sub[c].toUpperCase();
      if ((['S', 'A', 'B', 'C', 'D'] as const).includes(s as 'S') && grading[s as 'S'] == null) {
        grading[s as 'S'] = c;
      }
    }

    // 데이터 시작행: 상단행 + 2(상단행+1=S~D 라벨행, +2=점수구간행). 점수구간행도 카테고리 매핑으로 자연 skip 되지만 안전하게 +2.
    return { headerRow, dataStart: headerRow + 2, cols, weightCols, grading };
  }

  /** 가중치 열 집합 중 첫 번째 비0·비'-' 숫자칸 값 ×100 반올림 정수(%). 없으면 null. */
  private extractKpiWeight(ws: ExcelJS.Worksheet, row: number, weightCols: number[]): number | null {
    for (const c of weightCols) {
      const v = this.num(this.rawCell(ws, row, c));
      if (v != null && v !== 0) return Math.round(v * 100);
    }
    return null;
  }

  /** 동적 등급기준 열 매핑 → {S,A,B,C,D} 텍스트 맵. 빈/'-' 은 제외. 비어 있으면 null. */
  private extractGradingCriteria(
    ws: ExcelJS.Worksheet,
    row: number,
    grading: Partial<Record<'S' | 'A' | 'B' | 'C' | 'D', number>>,
  ): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const key of ['S', 'A', 'B', 'C', 'D'] as const) {
      const col = grading[key];
      if (col == null) continue;
      const g = this.str(this.rawCell(ws, row, col));
      if (g && g !== '-') out[key] = g;
    }
    return Object.keys(out).length ? out : null;
  }

  /** '개인별  KPI작성'(공백2개) 시트 선택. 정규화 includes 로 '(2)' 변이 포괄. 못 찾으면 첫 시트. */
  private pickKpiSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
    const found = wb.worksheets.find((w) =>
      w.name.replace(/\s/g, '').includes('개인별KPI작성'),
    );
    return found ?? wb.worksheets[0];
  }

  /**
   * 개인별 KPI 양식(buffer) 파싱 → 행 목록(검증·미리보기 공용). 저장하지 않음.
   * 헤더 텍스트 기반 동적 열 매핑(detectKpiColumns) — 레이아웃 변이(가중치 칸 수·등급 위치·좌측 패딩·헤더 행) 자동 흡수.
   * 핵심전략 열 매핑 실패 행은 데이터 끝/안내문/합계행으로 보고 skip.
   */
  private parseKpiSheet(wb: ExcelJS.Workbook): {
    rows: {
      category: KpiCategory;
      group: KpiGroup;
      csf: string | null;
      title: string;
      targetText: string | null;
      measureMethod: string | null;
      weight: number | null;
      isQualitative: boolean;
      gradingCriteria: Record<string, string> | null;
      valid: boolean;
      message: string | null;
    }[];
    errors: { row: number; message: string }[];
    sheetName: string;
  } {
    const ws = this.pickKpiSheet(wb);
    const rows: ReturnType<ExcelService['parseKpiSheet']>['rows'] = [];
    const errors: { row: number; message: string }[] = [];
    if (!ws) return { rows, errors, sheetName: '' };

    const det = this.detectKpiColumns(ws);
    if (!det || det.cols.category == null) {
      errors.push({ row: 0, message: 'KPI 양식 헤더(핵심전략·측정방식·등급기준)를 찾을 수 없어요. 표준 양식인지 확인해 주세요.' });
      return { rows, errors, sheetName: ws.name };
    }
    const { cols, weightCols, grading } = det;

    const lastRow = ws.rowCount;
    for (let r = det.dataStart; r <= lastRow; r++) {
      const catRaw = this.str(this.rawCell(ws, r, cols.category!));
      const mapped = this.mapKpiCategory(catRaw);
      if (!mapped) continue; // 매핑 실패 → 데이터 끝/안내문/합계행 → 무시(에러 아님).

      const title = cols.title != null ? this.str(this.rawCell(ws, r, cols.title)) : '';
      const csf = (cols.csf != null ? this.str(this.rawCell(ws, r, cols.csf)) : '') || null;
      const targetText = (cols.targetText != null ? this.str(this.rawCell(ws, r, cols.targetText)) : '') || null;
      const measureMethod = (cols.measureMethod != null ? this.str(this.rawCell(ws, r, cols.measureMethod)) : '') || null;
      const weight = this.extractKpiWeight(ws, r, weightCols);
      const gradingCriteria = this.extractGradingCriteria(ws, r, grading);
      const isQualitative = this.suggestQualitative(gradingCriteria);

      let valid = true;
      let message: string | null = null;
      if (!title) {
        valid = false;
        message = '성과관리지표(KPI)가 비어 있어요.';
        errors.push({ row: r, message });
      } else if (weight == null) {
        // 가중치 누락은 경고(차단 안 함) — 적재 시 0 으로 저장.
        message = '가중치가 비어 있어요.';
        errors.push({ row: r, message });
      }

      rows.push({
        category: mapped.category,
        group: mapped.group,
        csf,
        title,
        targetText,
        measureMethod,
        weight,
        isQualitative,
        gradingCriteria,
        valid,
        message,
      });
    }
    return { rows, errors, sheetName: ws.name };
  }

  /**
   * 정성/정량 제안값 휴리스틱(제안일 뿐 — 관리자가 화면에서 override).
   * 등급기준(S~D) 텍스트에 수치 토큰(%·숫자+단위·임의 숫자)이 전혀 없고 서술 문장만 있으면 정성(true).
   * 등급기준이 비었거나 수치 토큰이 있으면 보수적으로 정량(false).
   */
  private suggestQualitative(
    gradingCriteria: Record<string, string> | null,
  ): boolean {
    if (!gradingCriteria) return false;
    const text = Object.values(gradingCriteria).join(' ').trim();
    if (!text) return false;
    // %·숫자+단위·임의 숫자 → 수치 기준 → 정량.
    const hasNumeric = /[%]|\d+\s*(건|일|억|회|개|점|명|원|만|천)|\d/.test(text);
    return !hasNumeric;
  }

  /**
   * 개인별 KPI 양식 미리보기(적재 안 함). 계약 §4-1.
   * 파일 1개 파싱 결과 + 가중치합·오류행. 대상자 매칭/저장 없음.
   */
  async previewKpi(buffer: Buffer, fileName?: string) {
    const wb = await this.loadWorkbook(buffer);
    const { rows, errors } = this.parseKpiSheet(wb);
    const validCount = rows.filter((r) => r.valid).length;
    const weightSum = rows.reduce((s, r) => s + (r.weight ?? 0), 0);
    return {
      data: {
        fileName: fileName ?? null,
        rows,
        validCount,
        errorCount: errors.length,
        weightSum,
        errors,
      },
    };
  }

  /**
   * 개인별 KPI 양식 적재(draft 생성). 계약 §4-2.
   * - userId 필수(대상자). cycleId 생략 시 활성 사이클. 없으면 BadRequest.
   * - 멱등: 트랜잭션에서 (userId, cycleId) status=draft 기존 KPI 삭제 후 재생성(제출/승인본 보존).
   * - measureType=qualitative, isQualitative=true, targetValue=null, targetText/gradingCriteria 보존.
   * - 가중치 합 검증(validateWeights) 우회 — 합계만 경고로 반환.
   */
  async importKpi(
    buffer: Buffer,
    userId: string,
    cycleId: string | undefined,
    actorId?: string,
    fileName?: string,
  ) {
    const targetCycleId = await this.resolveImportTarget(userId, cycleId);

    const wb = await this.loadWorkbook(buffer);
    const { rows, errors } = this.parseKpiSheet(wb);
    const validRows = rows.filter((r) => r.valid);

    // 멱등 적재: 기존 draft 삭제 후 신규 생성(트랜잭션).
    const result = await this.prisma.$transaction(async (tx) => {
      const del = await tx.kpi.deleteMany({
        where: { userId, cycleId: targetCycleId, status: KpiStatus.draft },
      });
      let imported = 0;
      for (const row of validRows) {
        await tx.kpi.create({
          data: {
            userId,
            cycleId: targetCycleId,
            category: row.category,
            group: row.group,
            csf: row.csf,
            title: row.title,
            targetText: row.targetText,
            measureMethod: row.measureMethod,
            measureType: MeasureType.qualitative,
            isQualitative: true,
            targetValue: null,
            weight: row.weight ?? 0,
            gradingCriteria: (row.gradingCriteria as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            status: KpiStatus.draft,
          },
        });
        imported += 1;
      }
      return { imported, deletedDrafts: del.count };
    });

    const weightSum = validRows.reduce((s, r) => s + (r.weight ?? 0), 0);
    const warnings: string[] = [];
    if (weightSum !== 100) {
      warnings.push(`가중치 합이 100%가 아니에요(현재 ${weightSum}%).`);
    }

    await this.audit.record({
      entity: 'Kpi',
      entityId: userId,
      action: 'kpi.import',
      actorId,
      after: { userId, cycleId: targetCycleId, imported: result.imported, deletedDrafts: result.deletedDrafts, weightSum },
    });

    return {
      data: {
        ok: errors.length === 0,
        fileName: fileName ?? null,
        userId,
        cycleId: targetCycleId,
        imported: result.imported,
        deletedDrafts: result.deletedDrafts,
        weightSum,
        errors,
        warnings,
      },
    };
  }

  /**
   * 개인별 KPI 양식 — 화면 편집 행 적재(draft 생성). 계약 §4-4.
   * importKpi 와 동일한 멱등 트랜잭션·audit·결과 shape 를 재사용하되, 파일 재파싱 대신 관리자가
   * 미리보기에서 편집한 rows 를 적재한다(정성/정량 토글·누락 보완 반영).
   * - title 빈 행은 스킵 + warning. measureType=qualitative 상수, isQualitative=row.isQualitative,
   *   targetValue=null. weightSum≠100 은 warning(차단 안 함). validateWeights 우회.
   */
  async commitKpi(dto: KpiImportCommitDto, actorId?: string) {
    const { userId, cycleId, fileName, rows, submit } = dto;
    const targetCycleId = await this.resolveImportTarget(userId, cycleId);

    // 정제: 빈 title 스킵(warning), gradingCriteria null/빈칸 제거.
    const warnings: string[] = [];
    const validRows = rows.filter((row) => {
      const ok = !!(row.title && row.title.trim());
      if (!ok) warnings.push('성과관리지표(KPI)가 비어 있는 행을 건너뛰었어요.');
      return ok;
    });

    const weightSum = validRows.reduce((s, r) => s + (r.weight ?? 0), 0);

    // 제출(submit=true): 적재와 동시에 submitted 로 생성. 본인 제출과 동일 불변식
    // (가중치 합=100 등)을 RuleSet 으로 검증 — 위반 시 적재 자체를 막는다(부분 제출 방지).
    if (submit) {
      if (validRows.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '제출할 KPI 행이 없어요. 성과관리지표(KPI) 명을 채워 주세요.',
        });
      }
      const ruleSet = await this.scoring.loadRuleSetForCycle(targetCycleId);
      this.scoring.validateWeights(
        validRows.map((r) => ({
          weight: r.weight ?? 0,
          isQualitative: r.isQualitative,
          group: r.group,
        })),
        ruleSet.weightPolicy,
      );
    }
    const status = submit ? KpiStatus.submitted : KpiStatus.draft;

    const result = await this.prisma.$transaction(async (tx) => {
      const del = await tx.kpi.deleteMany({
        where: { userId, cycleId: targetCycleId, status: KpiStatus.draft },
      });
      let imported = 0;
      for (const row of validRows) {
        const grading = this.cleanGradingCriteria(row.gradingCriteria);
        await tx.kpi.create({
          data: {
            userId,
            cycleId: targetCycleId,
            category: row.category,
            group: row.group,
            csf: (row.csf && row.csf.trim()) || null,
            title: row.title.trim(),
            targetText: (row.targetText && row.targetText.trim()) || null,
            measureMethod: (row.measureMethod && row.measureMethod.trim()) || null,
            measureType: MeasureType.qualitative,
            isQualitative: row.isQualitative,
            targetValue: null,
            weight: row.weight ?? 0,
            gradingCriteria: (grading as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            status,
          },
        });
        imported += 1;
      }
      return { imported, deletedDrafts: del.count };
    });

    if (!submit && weightSum !== 100) {
      warnings.push(`가중치 합이 100%가 아니에요(현재 ${weightSum}%).`);
    }

    await this.audit.record({
      entity: 'Kpi',
      entityId: userId,
      action: 'kpi.import.commit',
      actorId,
      after: { userId, cycleId: targetCycleId, imported: result.imported, deletedDrafts: result.deletedDrafts, weightSum, submitted: !!submit },
    });

    return {
      data: {
        ok: true,
        userId,
        cycleId: targetCycleId,
        fileName: fileName ?? null,
        imported: result.imported,
        deletedDrafts: result.deletedDrafts,
        weightSum,
        submitted: !!submit,
        errors: [] as { row: number; message: string }[],
        warnings,
      },
    };
  }

  /** 대상 사용자 존재·활성 + 사이클 결정(명시 우선, 없으면 활성). importKpi/commitKpi 공용. */
  private async resolveImportTarget(
    userId: string,
    cycleId: string | undefined,
  ): Promise<string> {
    if (!userId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '대상 사용자(userId)가 필요해요.' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '대상 사용자를 찾을 수 없어요.' });
    }
    const cycle = cycleId
      ? await this.prisma.evaluationCycle.findUnique({ where: { id: cycleId } })
      : await this.prisma.evaluationCycle.findFirst({ where: { status: CycleStatus.active }, orderBy: { createdAt: 'desc' } });
    if (!cycle) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: cycleId ? '대상 평가 주기를 찾을 수 없어요.' : '활성 평가 주기가 없어요. cycleId 를 지정해 주세요.',
      });
    }
    return cycle.id;
  }

  /** 편집 gradingCriteria 정제: 빈칸/'-'/null 제거. 남은 게 없으면 null. */
  private cleanGradingCriteria(
    input: Partial<Record<'S' | 'A' | 'B' | 'C' | 'D', string | null | undefined>> | null | undefined,
  ): Record<string, string> | null {
    if (!input) return null;
    const out: Record<string, string> = {};
    for (const key of ['S', 'A', 'B', 'C', 'D'] as const) {
      const v = input[key];
      if (typeof v === 'string' && v.trim() && v.trim() !== '-') out[key] = v.trim();
    }
    return Object.keys(out).length ? out : null;
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
      { header: '작업 내용', key: 'action', width: 28 },
      { header: '대상', key: 'entity', width: 18 },
      { header: '대상 ID', key: 'entityId', width: 30 },
      { header: '변경 전', key: 'before', width: 40 },
      { header: '변경 후', key: 'after', width: 40 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const r of rows) {
      ws.addRow({
        at: r.at?.toISOString() ?? '',
        actorName: r.user?.name ?? (r.userId ? r.userId : '시스템'),
        actorEmail: r.user?.email ?? '',
        action: AUDIT_ACTION_LABEL[r.action] ?? r.action,
        entity: AUDIT_ENTITY_LABEL[r.entity] ?? r.entity,
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
