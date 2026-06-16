/**
 * 1회성 운영 적재: 2026년 연봉갱신 전달 1.xlsx (Index 시트)의
 * 경력/연봉 데이터를 **기존 사용자에 이름 매칭**해 채운다.
 * (신규 사용자 생성 안 함 — 매칭 안 되는 행은 검토 큐로 보고만.)
 *
 * 매칭 키:
 *   이름(I열)으로 active User 를 검색.
 *   DB·엑셀 양쪽에서 이름이 유일할 때만 자동 매칭.
 *   동명이인(중복) / 미매칭은 검토 큐로 보고(쓰기 안 함).
 *
 * 기본은 **비어 있는 값만 채움(비파괴)**.
 * --overwrite 면 기존 값도 덮어씀.
 * --dry 면 DB 쓰기 없이 매칭 결과만 출력.
 * --cycleId <id> 면 X(조정분)·AA(승격)·AB(인센티브) 를 CompensationAdjustment 에 upsert.
 *
 * 사용:
 *   ts-node prisma/import-compensation-roster.ts [xlsxPath] [--dry] [--overwrite] [--cycleId <id>]
 *   (xlsxPath 생략 시 기본 Downloads 경로)
 *
 * 열 인덱스(1-base, 헤더 행 4):
 *   I( 9) = 이름
 *   K(11) = 입사일 (비파괴 참고)
 *   M(13) = 25.02기준 → careerBaseMonths
 *   N(14) = 전경력(월) → priorCareerMonths
 *   Q(17) = 경력직급 → careerPosition
 *   R(18) = 연차 → serviceYears
 *   S(19) = 고려대상 열외 → considerationExclusion
 *   T(20) = 24년도 연봉 → previousSalary (비파괴)
 *   U(21) = 25년도 연봉(이전제외A) → currentSalaryExclTransfer
 *   V(22) = 25년도 연봉(이전포함B) → currentSalary (비파괴)
 *   X(24) = 조정분 → CompensationAdjustment.adjustmentAmount  (--cycleId 필요)
 *   AA(27) = 승격 라벨 → CompensationAdjustment.promotionPositionCode (역매핑 시도)
 *   AB(28) = 인센티브 → CompensationAdjustment.incentiveAmount          (--cycleId 필요)
 */

import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();

const DEFAULT_XLSX =
  'C:/Users/user/Downloads/2026년 연봉갱신 전달 1.xlsx';
const SHEET_NAME = 'Index';
const HEADER_ROW = 4;
const DATA_START_ROW = 5;

// ── 열 인덱스 (1-base) ──
const COL = {
  name: 9,           // I  이름
  hireDate: 11,      // K  입사일
  careerBase: 13,    // M  25.02기준(월)
  priorCareer: 14,   // N  전경력(월)
  careerPosition: 17,// Q  경력직급
  serviceYears: 18,  // R  연차
  consideration: 19, // S  고려대상 열외
  prevSalary: 20,    // T  24년도 연봉
  currSalaryA: 21,   // U  25년도 연봉(이전제외A)
  currSalaryB: 22,   // V  25년도 연봉(이전포함B)
  adjustment: 24,    // X  조정분
  promotion: 27,     // AA 승격 직급 라벨
  incentive: 28,     // AB 인센티브
} as const;

// 헤더 행 검증 기대값 (부분 포함 검사)
const EXPECTED_HEADERS: Record<number, string> = {
  [COL.name]: '이름',
  [COL.careerBase]: '25.02',
  [COL.priorCareer]: '전경력',
  [COL.careerPosition]: '경력직급',
  [COL.serviceYears]: '연차',
  [COL.prevSalary]: '24년도',
  [COL.currSalaryA]: '이전제외',
  [COL.currSalaryB]: '이전포함',
};

// ── 셀 값 헬퍼 (기존 스크립트 패턴 그대로) ──

function cellStr(c: ExcelJS.Cell): string {
  const v = c.value as unknown;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if (typeof o.text === 'string') return o.text;
    if ('result' in o) return String(o.result ?? '');
    return '';
  }
  return String(v);
}

/** 셀 값을 숫자로 파싱. 수식 result 포함. 빈/하이픈/문자는 null. */
function cellNum(c: ExcelJS.Cell): number | null {
  const v = c.value as unknown;
  if (v == null) return null;
  // 수식 객체 { formula, result }
  if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
    const o = v as Record<string, unknown>;
    if ('result' in o) {
      const r = o.result;
      if (r == null) return null;
      const n = Number(r);
      return Number.isFinite(n) ? n : null;
    }
  }
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  if (s === '' || s === '-' || s === '—') return null;
  const n = Number(s.replace(/,/g, '')); // 천 단위 쉼표 제거
  return Number.isFinite(n) ? n : null;
}

/** 'YYYY-MM-DD' 또는 Date → 자정(UTC). 빈/파싱실패 → null. */
function parseDate(c: ExcelJS.Cell): Date | null {
  const v = c.value as unknown;
  if (v instanceof Date) {
    if (!Number.isFinite(v.getTime())) return null;
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  const s = cellStr(c).trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

// ── 엑셀 행 타입 ──
interface RosterRow {
  rowIdx: number;
  name: string;
  hireDate: Date | null;
  careerBaseMonths: number | null;
  priorCareerMonths: number | null;
  careerPosition: string | null;
  serviceYears: number | null;
  considerationExclusion: string | null;
  previousSalary: number | null;
  currentSalaryExclTransfer: number | null;
  currentSalary: number | null;
  // CompensationAdjustment (cycleId 있을 때만 사용)
  adjustmentAmount: number | null;
  promotionLabel: string | null;
  incentiveAmount: number | null;
}

// ── 유효한 행인지 판별 (이름 셀 비면 스킵) ──
function isEmptyRow(row: ExcelJS.Row): boolean {
  return cellStr(row.getCell(COL.name)).trim() === '';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const xlsxPath =
    args.find((a) => !a.startsWith('--')) ?? DEFAULT_XLSX;
  const dry = args.includes('--dry');
  const overwrite = args.includes('--overwrite');
  const cycleIdIdx = args.indexOf('--cycleId');
  const cycleId =
    cycleIdIdx >= 0 && args[cycleIdIdx + 1]
      ? args[cycleIdIdx + 1]
      : null;

  console.log('======= 연봉갱신 표 (Index 시트) 적재 스크립트 =======');
  console.log(`파일: ${xlsxPath}`);
  console.log(
    `모드: ${dry ? 'DRY-RUN(쓰기 없음)' : '적용'} / ${overwrite ? '덮어쓰기' : '빈 값만 채움'}`,
  );
  if (cycleId) console.log(`cycleId: ${cycleId} (CompensationAdjustment upsert 활성)`);

  // ── 1) 엑셀 파싱 ──
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) {
    console.error(`[ERROR] 시트 "${SHEET_NAME}" 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  // 헤더 검증 (행 4)
  const headerRow = ws.getRow(HEADER_ROW);
  const headerWarnings: string[] = [];
  for (const [colIdx, expected] of Object.entries(EXPECTED_HEADERS)) {
    const actual = cellStr(headerRow.getCell(Number(colIdx))).trim();
    if (!actual.includes(expected)) {
      headerWarnings.push(
        `  열 ${colIdx}: 기대 "${expected}" / 실제 "${actual}"`,
      );
    }
  }
  if (headerWarnings.length) {
    console.warn(`\n[WARN] 헤더 불일치 ${headerWarnings.length}건 — 열 매핑을 확인하세요:`);
    headerWarnings.forEach((w) => console.warn(w));
    console.warn('');
  }

  // 데이터 행 파싱
  const rosterRows: RosterRow[] = [];
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (isEmptyRow(row)) continue;

    const name = cellStr(row.getCell(COL.name)).trim();
    if (!name) continue;

    const serviceYearsRaw = cellNum(row.getCell(COL.serviceYears));
    // 연차 R: 임원 등 "-" 행은 null 유지
    const serviceYears =
      serviceYearsRaw !== null ? Math.round(serviceYearsRaw) : null;

    const careerBaseRaw = cellNum(row.getCell(COL.careerBase));
    const priorCareerRaw = cellNum(row.getCell(COL.priorCareer));
    const adjRaw = cellNum(row.getCell(COL.adjustment));
    const incRaw = cellNum(row.getCell(COL.incentive));

    const promotionStr = cellStr(row.getCell(COL.promotion)).trim();

    rosterRows.push({
      rowIdx: r,
      name,
      hireDate: parseDate(row.getCell(COL.hireDate)),
      careerBaseMonths:
        careerBaseRaw !== null ? Math.round(careerBaseRaw) : null,
      priorCareerMonths:
        priorCareerRaw !== null ? Math.round(priorCareerRaw) : null,
      careerPosition:
        cellStr(row.getCell(COL.careerPosition)).trim() || null,
      serviceYears,
      considerationExclusion:
        cellStr(row.getCell(COL.consideration)).trim() || null,
      previousSalary: cellNum(row.getCell(COL.prevSalary)),
      currentSalaryExclTransfer:
        cellNum(row.getCell(COL.currSalaryA)) !== null
          ? Math.round(cellNum(row.getCell(COL.currSalaryA))!)
          : null,
      currentSalary: cellNum(row.getCell(COL.currSalaryB)),
      adjustmentAmount: adjRaw !== null ? Math.round(adjRaw) : null,
      promotionLabel: promotionStr || null,
      incentiveAmount: incRaw !== null ? Math.round(incRaw) : null,
    });
  }
  console.log(`엑셀 데이터 행: ${rosterRows.length}건`);

  // ── 2) DB 사용자 로드 (active 만) ──
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      hireDate: true,
      previousSalary: true,
      currentSalary: true,
      priorCareerMonths: true,
      careerBaseMonths: true,
      careerPosition: true,
      serviceYears: true,
      considerationExclusion: true,
      currentSalaryExclTransfer: true,
    },
  });

  // 이름 → 사용자 목록 인덱스
  const byName = new Map<string, (typeof users)>();
  for (const u of users) {
    const existing = byName.get(u.name) ?? [];
    existing.push(u);
    byName.set(u.name, existing);
  }

  // 엑셀 내 이름 빈도 (양쪽 유일할 때만 매칭 허용)
  const excelNameCount = new Map<string, number>();
  for (const r of rosterRows) {
    excelNameCount.set(r.name, (excelNameCount.get(r.name) ?? 0) + 1);
  }

  // ── 3) 매칭 ──
  type UserRecord = (typeof users)[number];
  interface MatchResult {
    row: RosterRow;
    user: UserRecord;
  }

  const matched: MatchResult[] = [];
  const ambiguous: string[] = []; // 동명이인 / 엑셀 중복
  const unmatched: string[] = [];  // DB 미매칭

  for (const row of rosterRows) {
    const dbCands = byName.get(row.name);
    const excelCount = excelNameCount.get(row.name) ?? 0;

    if (!dbCands || dbCands.length === 0) {
      unmatched.push(`R${row.rowIdx} "${row.name}"`);
      continue;
    }
    // DB에서도 유일, 엑셀에서도 유일해야 자동 매칭
    if (dbCands.length > 1) {
      ambiguous.push(
        `R${row.rowIdx} "${row.name}" — DB에 ${dbCands.length}명 (이메일: ${dbCands.map((u) => u.email).join(', ')})`,
      );
      continue;
    }
    if (excelCount > 1) {
      ambiguous.push(
        `R${row.rowIdx} "${row.name}" — 엑셀 내 ${excelCount}행 중복`,
      );
      continue;
    }
    matched.push({ row, user: dbCands[0] });
  }

  // ── 4) 적재 ──
  let updatedUser = 0;
  let skippedUser = 0; // 변경사항 없어서 skip
  let updatedAdj = 0;
  const adjErrors: string[] = [];

  // cycleId 유효성 확인 (있을 때)
  if (cycleId) {
    const cycle = await prisma.evaluationCycle.findUnique({
      where: { id: cycleId },
      select: { id: true },
    });
    if (!cycle) {
      console.error(`[ERROR] cycleId "${cycleId}" 를 DB에서 찾을 수 없습니다.`);
      process.exit(1);
    }
  }

  // PositionDef 역매핑 캐시 (라벨 → code)
  const positionByLabel = new Map<string, string>();
  if (cycleId) {
    const defs = await prisma.positionDef.findMany({
      select: { code: true, label: true },
    });
    for (const d of defs) positionByLabel.set(d.label, d.code);
  }

  for (const { row, user } of matched) {
    // User 필드 빌드
    type UserData = {
      hireDate?: Date;
      previousSalary?: number;
      currentSalary?: number;
      currentSalaryExclTransfer?: number;
      priorCareerMonths?: number;
      careerBaseMonths?: number;
      careerPosition?: string;
      serviceYears?: number;
      considerationExclusion?: string;
    };
    const userData: UserData = {};

    function shouldSet<T>(
      incoming: T | null | undefined,
      current: T | null | undefined,
    ): boolean {
      if (incoming == null) return false;
      if (overwrite) return true;
      return current == null; // 비파괴: 비어 있을 때만
    }

    if (shouldSet(row.hireDate, user.hireDate))
      userData.hireDate = row.hireDate!;
    if (shouldSet(row.previousSalary, user.previousSalary))
      userData.previousSalary = row.previousSalary!;
    if (shouldSet(row.currentSalary, user.currentSalary))
      userData.currentSalary = row.currentSalary!;
    if (shouldSet(row.currentSalaryExclTransfer, user.currentSalaryExclTransfer))
      userData.currentSalaryExclTransfer = row.currentSalaryExclTransfer!;
    if (shouldSet(row.priorCareerMonths, user.priorCareerMonths))
      userData.priorCareerMonths = row.priorCareerMonths!;
    if (shouldSet(row.careerBaseMonths, user.careerBaseMonths))
      userData.careerBaseMonths = row.careerBaseMonths!;
    if (shouldSet(row.careerPosition, user.careerPosition))
      userData.careerPosition = row.careerPosition!;
    if (shouldSet(row.serviceYears, user.serviceYears))
      userData.serviceYears = row.serviceYears!;
    if (shouldSet(row.considerationExclusion, user.considerationExclusion))
      userData.considerationExclusion = row.considerationExclusion!;

    const hasUserChanges = Object.keys(userData).length > 0;

    if (!hasUserChanges) {
      skippedUser++;
    } else {
      updatedUser++;
      if (!dry) {
        await prisma.user.update({ where: { id: user.id }, data: userData });
      }
    }

    // CompensationAdjustment upsert (cycleId 있을 때만)
    if (cycleId) {
      const hasAdj =
        row.adjustmentAmount !== null ||
        row.promotionLabel !== null ||
        row.incentiveAmount !== null;

      if (hasAdj) {
        // 승격 직급 역매핑
        let promotionCode: string | null = null;
        if (row.promotionLabel) {
          const code = positionByLabel.get(row.promotionLabel);
          if (code) {
            promotionCode = code;
          } else {
            adjErrors.push(
              `R${row.rowIdx} "${row.name}": 승격 라벨 "${row.promotionLabel}" → PositionDef.code 매핑 실패 (promotionPositionCode 미저장)`,
            );
          }
        }

        type AdjData = {
          adjustmentAmount?: number | null;
          promotionPositionCode?: string | null;
          incentiveAmount?: number | null;
        };
        const adjData: AdjData = {};
        if (row.adjustmentAmount !== null) adjData.adjustmentAmount = row.adjustmentAmount;
        if (promotionCode !== null) adjData.promotionPositionCode = promotionCode;
        if (row.incentiveAmount !== null) adjData.incentiveAmount = row.incentiveAmount;

        updatedAdj++;
        if (!dry) {
          await prisma.compensationAdjustment.upsert({
            where: { userId_cycleId: { userId: user.id, cycleId } },
            create: {
              userId: user.id,
              cycleId,
              adjustmentAmount: adjData.adjustmentAmount ?? null,
              promotionPositionCode: adjData.promotionPositionCode ?? null,
              incentiveAmount: adjData.incentiveAmount ?? null,
            },
            update: adjData,
          });
        }
      }
    }
  }

  // ── 5) 리포트 ──
  console.log('\n======= 적재 결과 =======');
  console.log(`엑셀 행: ${rosterRows.length}  /  DB 사용자(active): ${users.length}`);
  console.log(`자동 매칭: ${matched.length}  /  동명이인·모호: ${ambiguous.length}  /  미매칭: ${unmatched.length}`);
  console.log(
    `User 업데이트: ${updatedUser} (변경없음 skip: ${skippedUser})`,
  );
  if (cycleId) {
    console.log(`CompensationAdjustment upsert: ${updatedAdj}`);
  }

  if (headerWarnings.length) {
    console.log(`\n[WARN] 헤더 불일치 ${headerWarnings.length}건 — 위 경고 참조`);
  }

  if (ambiguous.length) {
    console.log(`\n[검토 큐 — 동명이인/엑셀중복 ${ambiguous.length}] (쓰기 안 함, 수동 확인 필요)`);
    ambiguous.forEach((a) => console.log('  - ' + a));
  }

  if (unmatched.length) {
    console.log(`\n[검토 큐 — DB 미매칭 ${unmatched.length}] (쓰기 안 함, 이름 확인 필요)`);
    unmatched.forEach((u) => console.log('  - ' + u));
  }

  if (adjErrors.length) {
    console.log(`\n[CompensationAdjustment 경고 ${adjErrors.length}]`);
    adjErrors.forEach((e) => console.log('  - ' + e));
  }

  console.log('=========================');
  if (dry) console.log('(DRY-RUN — DB에 쓰지 않았습니다)');
}

main()
  .catch((e) => {
    console.error('IMPORT_ERROR', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
