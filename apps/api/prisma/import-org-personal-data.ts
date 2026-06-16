/**
 * 1회성 운영 적재: 조직도 xlsx(Amaranth_…_OrganizationChart)의
 * 생년월일(birthDate)·입사일(hireDate)을 **기존 사용자에 매칭**해 채운다.
 * (신규 사용자 생성 안 함 — 매칭 안 되는 행은 검토 큐로 보고만.)
 *
 * 매칭 키(우선순위):
 *   1) 사원ID(사원명 괄호 안, 예 "박성현(spark)"→spark) = 회사이메일 local-part
 *   2) 명시 회사메일(col 13) 전체 일치
 *   3) 유일 이름(조직도·DB 양쪽에서 1명뿐일 때만)
 *
 * 기본은 **비어 있는 값만 채움(비파괴)**. 기존 값을 조직도 기준으로 덮어쓰려면 --overwrite.
 * --dry 면 DB 쓰기 없이 매칭 결과만 출력.
 *
 * 사용:
 *   ts-node prisma/import-org-personal-data.ts <xlsxPath> [--dry] [--overwrite]
 *   (xlsxPath 생략 시 기본 Downloads 경로)
 */
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();

const DEFAULT_XLSX =
  'C:/Users/user/Downloads/Amaranth_10_OrganizationChart_20260616.xlsx';

// 열 인덱스(1-base) — 조직도 헤더 기준.
const COL = { company: 1, nameId: 7, birth: 9, email: 13, hire: 17 } as const;

type Entity = 'energyx' | 'mirae_plan' | null;
// 회사명(col 1) → 법인. 동일인이 두 법인에 모두 적히면 입사일이 법인별로 다르다(생년월일은 동일).
function toEntity(company: string): Entity {
  if (company.includes('에너지엑스')) return 'energyx';
  if (company.includes('미래환경')) return 'mirae_plan';
  return null;
}

function cellStr(c: ExcelJS.Cell): string {
  const v = c.value as unknown;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if (typeof o.text === 'string') return o.text;
    if ('result' in o) return String(o.result);
    return '';
  }
  return String(v);
}

function localPart(email: string): string {
  return email.split('@')[0].trim().toLowerCase();
}

// 'YYYY-MM-DD' → 자정(UTC) Date. 빈/미래/파싱 실패는 null.
function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) return null;
  return d;
}

interface OrgRow {
  row: number;
  name: string;
  loginId: string;
  email: string;
  entity: Entity;
  birthDate: Date | null;
  hireDate: Date | null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const xlsxPath = args.find((a) => !a.startsWith('--')) ?? DEFAULT_XLSX;
  const dry = args.includes('--dry');
  const overwrite = args.includes('--overwrite');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];

  // ── 1) 조직도 파싱 + loginId(=key) 로 그룹핑(동일인이 두 법인에 적힐 수 있음 — 행 보존) ──
  const groups = new Map<string, OrgRow[]>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const rowCells = ws.getRow(r);
    const nameId = cellStr(rowCells.getCell(COL.nameId)).trim();
    if (!nameId) continue;
    const m = nameId.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const name = (m ? m[1] : nameId).trim();
    const loginId = (m ? m[2] : '').trim().toLowerCase();
    const parsed: OrgRow = {
      row: r,
      name,
      loginId,
      email: cellStr(rowCells.getCell(COL.email)).trim().toLowerCase(),
      entity: toEntity(cellStr(rowCells.getCell(COL.company)).trim()),
      birthDate: parseDate(cellStr(rowCells.getCell(COL.birth)).trim()),
      hireDate: parseDate(cellStr(rowCells.getCell(COL.hire)).trim()),
    };
    const key = loginId || `name:${name}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(parsed);
  }
  // 대표 행(이름·매칭용) = 그룹 첫 행. 적재값은 매칭된 사용자 법인에 맞춰 별도 선택.
  const orgRows = [...groups.values()].map((g) => g[0]);

  // 생년월일이 법인 간 불일치하는 진짜 이상치만 경고(입사일 차이는 법인별로 정상).
  const conflicts: string[] = [];
  for (const g of groups.values()) {
    const births = new Set(
      g.map((x) => x.birthDate?.getTime()).filter((t) => t != null),
    );
    if (births.size > 1)
      conflicts.push(
        `${g[0].name}(${g[0].loginId}): 생년월일 불일치 (행 ${g.map((x) => x.row).join('/')})`,
      );
  }

  // ── 2) DB 사용자 로드 + 매칭 인덱스(local-part / email / name) ──
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      legalEntity: true,
      birthDate: true,
      hireDate: true,
    },
  });
  const byLocal = new Map<string, typeof users>();
  const byEmail = new Map<string, (typeof users)[number]>();
  const byName = new Map<string, typeof users>();
  for (const u of users) {
    const lp = localPart(u.email);
    (byLocal.get(lp) ?? byLocal.set(lp, []).get(lp)!).push(u);
    byEmail.set(u.email.toLowerCase(), u);
    (byName.get(u.name) ?? byName.set(u.name, []).get(u.name)!).push(u);
  }
  // 조직도 내 이름 빈도(이름 폴백 매칭은 양쪽 모두 유일할 때만 허용).
  const orgNameCount = new Map<string, number>();
  for (const o of orgRows)
    orgNameCount.set(o.name, (orgNameCount.get(o.name) ?? 0) + 1);

  function resolve(o: OrgRow): { user: (typeof users)[number]; via: string } | null {
    if (o.loginId) {
      const cand = byLocal.get(o.loginId);
      if (cand && cand.length === 1) return { user: cand[0], via: 'loginId' };
    }
    if (o.email && byEmail.has(o.email))
      return { user: byEmail.get(o.email)!, via: 'email' };
    const nm = byName.get(o.name);
    if (nm && nm.length === 1 && (orgNameCount.get(o.name) ?? 0) === 1)
      return { user: nm[0], via: 'name' };
    return null;
  }

  // ── 3) 매칭·적재 ──
  let matched = 0;
  let updated = 0;
  let birthSet = 0;
  let hireSet = 0;
  const unmatched: string[] = [];
  for (const o of orgRows) {
    const hit = resolve(o);
    if (!hit) {
      unmatched.push(`R${o.row} ${o.name}(${o.loginId || '-'})`);
      continue;
    }
    matched++;
    const u = hit.user;
    // 동일인 다중 법인 행 중, 사용자 법인(legalEntity)에 맞는 행의 입사일을 채택.
    const group = groups.get(o.loginId || `name:${o.name}`) ?? [o];
    const entityRow = group.find((x) => x.entity === u.legalEntity) ?? group[0];
    const birth = group.find((x) => x.birthDate)?.birthDate ?? null;
    const hire = entityRow.hireDate ?? group.find((x) => x.hireDate)?.hireDate ?? null;

    const data: { birthDate?: Date; hireDate?: Date } = {};
    if (birth && (overwrite || u.birthDate == null)) {
      data.birthDate = birth;
      birthSet++;
    }
    if (hire && (overwrite || u.hireDate == null)) {
      data.hireDate = hire;
      hireSet++;
    }
    if (Object.keys(data).length === 0) continue;
    updated++;
    if (!dry) await prisma.user.update({ where: { id: u.id }, data });
  }

  // ── 4) 리포트 ──
  console.log('================ 조직도 개인정보 적재 결과 ================');
  console.log(`모드: ${dry ? 'DRY-RUN(쓰기 없음)' : '적용'} / ${overwrite ? '덮어쓰기' : '빈 값만 채움'}`);
  console.log(`조직도 고유 인원: ${orgRows.length}  /  DB 사용자: ${users.length}`);
  console.log(`매칭: ${matched}  /  미매칭: ${unmatched.length}`);
  console.log(`업데이트 대상: ${updated} (생년월일 ${birthSet} · 입사일 ${hireSet})`);
  if (conflicts.length) {
    console.log(`\n[중복행 값 충돌 ${conflicts.length}]`);
    conflicts.slice(0, 20).forEach((c) => console.log('  - ' + c));
  }
  if (unmatched.length) {
    console.log(`\n[미매칭 ${unmatched.length}] — 수동 확인 필요`);
    unmatched.forEach((u) => console.log('  - ' + u));
  }
  console.log('=========================================================');
}

main()
  .catch((e) => {
    console.error('IMPORT_ERROR', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
