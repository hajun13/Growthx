/**
 * 2026 개인별 KPI 양식 폴더 일괄 임포트(1회성 운영 데이터 적재).
 *
 * 대상: `D:\2026\26년도 취합\{2.엔지니어링,3.친환경기술,4.이노베이션,5.건축설계}` 폴더의
 *       개인별 KPI 양식 .xlsx (하위 `삭제용` 폴더·.zip 은 제외).
 * 파서: 실서비스 ExcelService(previewKpi 파싱 + commitKpi 적재)를 재사용.
 *   commitKpi 는 title 있는 행을 전부 적재하므로 분류 인식 실패 행도 유실 없이 draft 로 들어간다
 *   (인식 실패 행은 기본 분류 orders/performance_core 로 적재 + 보고서에 "분류 확인 필요" 표기).
 * 상태: draft(멱등 — 기존 draft+submitted 교체, 결재 진행/확정본 보존). AI 폴백 비활성(결정론 파서).
 * 매칭: 파일명에 포함된 사용자 이름(활성 사용자 이름 전사 유일 — 동명이인 0) 단순 일치.
 *
 * ── 역할변형 양식 보정(그룹 2 신재생/기술 "본부장/개인(팀장 이하)" 2행 병기 → 130%) ──
 *   한 표에 "본부장 X" 행과 "개인(팀장 이하) X" 행을 모두 나열하고 각자 자기 역할 행만 채우는 양식.
 *   본부장(role=division_head+)은 "본부장" 행만, 팀장 이하는 "개인(팀장 이하)" 행만 남겨 100% 복원.
 *
 * 실행(apps/api 에서, 로컬 도커 포워딩 localhost:5432):
 *   npx ts-node prisma/import-kpi-folders.ts --dry-run
 *   npx ts-node prisma/import-kpi-folders.ts --commit
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { ExcelService } from '../src/modules/excel/excel.service';
import { AuditService } from '../src/common/audit/audit.service';
import { ScoringService } from '../src/common/rules/scoring.service';
import { KpiParseAgent } from '../src/modules/integration/deepseek/kpi-parse.agent';

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const SUBMIT = args.includes('--submit');
const rootArg = argValue('--root') ?? 'D:\\2026\\26년도 취합';
const YEAR = Number(argValue('--year') ?? '2026');
const GROUPS = [
  '2.[EX]엔지니어링그룹',
  '3.[EX]친환경기술그룹',
  '4.[EX]이노베이션그룹',
  '5.[MR]건축설계그룹',
];
// 본부장 이상(역할변형 양식에서 "본부장" 행을 갖는 계층).
const HEAD_ROLES = new Set(['division_head', 'group_lead']);

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

type PreviewRow = {
  category: any; group: any; csf: string | null; title: string;
  targetText: string | null; measureMethod: string | null;
  weight: number | null; isQualitative: boolean;
  gradingCriteria: Record<string, string> | null; valid: boolean; message: string | null;
};

/** 역할변형 행 필터 + commitKpi DTO 행 매핑. 반환: {rows, weightSum, dropped, unresolved}. */
function correctRows(previewRows: PreviewRow[], isHead: boolean) {
  const kept = previewRows.filter((r) => {
    const txt = `${r.csf ?? ''} ${r.title ?? ''}`;
    const headMarker = /본부장/.test(txt);
    const memberMarker = /팀장\s*이하|개인\s*\(\s*팀장/.test(txt);
    if (headMarker && !memberMarker) return isHead; // "본부장 X" 행 — 본부장만
    if (memberMarker && !headMarker) return !isHead; // "개인(팀장 이하) X" 행 — 팀장 이하만
    return true; // 공통 행
  });
  const dropped = previewRows.length - kept.length;
  // title 있는 행만(commitKpi 도 빈 title 스킵). 분류 인식 실패(valid=false·title 有)도 적재.
  const rows = kept
    .filter((r) => r.title && r.title.trim())
    .map((r) => ({
      category: r.category,
      group: r.group,
      csf: r.csf ?? null,
      title: r.title.trim(),
      targetText: r.targetText ?? null,
      measureMethod: r.measureMethod ?? null,
      weight: Math.max(0, Math.min(100, Math.round(r.weight ?? 0))),
      isQualitative: r.isQualitative,
      gradingCriteria: r.gradingCriteria ?? null,
    }));
  const weightSum = rows.reduce((s, r) => s + r.weight, 0);
  const unresolved = kept.filter((r) => r.title && r.title.trim() && !r.valid).length;
  return { rows, weightSum, dropped, unresolved };
}

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const kpiParseAgent = new KpiParseAgent({ isEnabled: () => false } as any);
  const excel = new ExcelService(
    prisma as any,
    new ScoringService(prisma as any),
    new AuditService(prisma as any),
    {} as any, // compensations — 적재 경로에서 미사용
    kpiParseAgent,
  );

  const cycle = await prisma.evaluationCycle.findFirst({ where: { year: YEAR } });
  if (!cycle) throw new Error(`${YEAR}년 사이클이 없어요.`);
  console.log(`대상 사이클: ${cycle.name} (${cycle.id}) status=${cycle.status}`);

  const actor = await prisma.user.findFirst({
    where: { role: 'hr_admin', isActive: true }, select: { id: true },
  });
  const actorId = actor?.id;

  const users = await prisma.user.findMany({
    where: { isActive: true }, select: { id: true, name: true, role: true, position: true },
  });
  const dupes = users.map((u) => u.name).filter((n, i, a) => a.indexOf(n) !== i);
  if (dupes.length) console.warn(`⚠ 동명이인: ${[...new Set(dupes)].join(', ')}`);

  const targets: { group: string; file: string; full: string }[] = [];
  for (const g of GROUPS) {
    const dir = path.join(rootArg, g);
    if (!fs.existsSync(dir)) { console.warn(`⚠ 폴더 없음: ${dir}`); continue; }
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (!fs.statSync(full).isFile()) continue; // 삭제용 하위폴더 스킵
      if (!f.toLowerCase().endsWith('.xlsx')) continue; // .zip 스킵
      targets.push({ group: g, file: f, full });
    }
  }
  console.log(`대상 파일: ${targets.length}개\n`);

  // ── 제출 모드: 적재된 draft → submitted(결재 대기). 파일 재파싱 없이 매칭 사용자만 제출(중복 제거). ──
  if (SUBMIT) {
    const seen = new Set<string>();
    const uniq: { id: string; name: string }[] = [];
    for (const t of targets) {
      const base = t.file.replace(/\.xlsx$/i, '');
      const hits = users.filter((u) => base.includes(u.name));
      if (hits.length === 1 && !seen.has(hits[0].id)) {
        seen.add(hits[0].id);
        uniq.push({ id: hits[0].id, name: hits[0].name });
      }
    }
    let sOk = 0, sFail = 0, sTotal = 0;
    const sProblems: string[] = [];
    for (const u of uniq) {
      try {
        const res = await excel.submitImportedKpi({ userId: u.id, cycleId: cycle.id }, actorId);
        sOk++; sTotal += res.data.submitted;
        console.log(`  ✓ ${u.name.padEnd(5)} 제출 ${String(res.data.submitted).padStart(2)}건`);
      } catch (err: any) {
        sFail++;
        const msg = err?.response?.message ?? err?.message ?? String(err);
        console.log(`  ✗ ${u.name.padEnd(5)} 제출 실패 — ${JSON.stringify(msg)}`);
        sProblems.push(`${u.name}: ${JSON.stringify(msg)}`);
      }
    }
    console.log(`\n===== 제출(submit) 요약 =====`);
    console.log(`대상 ${uniq.length}명 | 성공 ${sOk} | 실패 ${sFail} | 제출 ${sTotal}건`);
    if (sProblems.length) { console.log(`\n--- 실패(${sProblems.length}) ---`); sProblems.forEach((p) => console.log('  · ' + p)); }
    await prisma.$disconnect();
    return;
  }

  let ok = 0, failed = 0, noMatch = 0, totalKpis = 0;
  const problems: string[] = [];

  for (const t of targets) {
    const base = t.file.replace(/\.xlsx$/i, '');
    const hits = users.filter((u) => base.includes(u.name));
    if (hits.length !== 1) {
      noMatch++;
      console.log(`  ✗ [매칭 ${hits.length}] ${t.file}`);
      problems.push(`매칭 ${hits.length}명: ${t.file}`);
      continue;
    }
    const user = hits[0];
    const isHead = HEAD_ROLES.has(user.role);
    const buffer = fs.readFileSync(t.full);

    try {
      const pv = await excel.previewKpi(buffer, t.file);
      const { rows, weightSum, dropped, unresolved } = correctRows(pv.data.rows as PreviewRow[], isHead);

      const wf = weightSum === 100 ? '' : ` ⚠합 ${weightSum}%`;
      const df = dropped ? ` 역할행 -${dropped}` : '';
      const uf = unresolved ? ` 분류확인 ${unresolved}` : '';

      if (!COMMIT) {
        totalKpis += rows.length;
        console.log(`  · ${user.name.padEnd(5)} ${String(rows.length).padStart(2)}건${wf}${df}${uf}  ${t.file}`);
      } else {
        const res = await excel.commitKpi(
          { userId: user.id, cycleId: cycle.id, fileName: t.file, rows: rows as any },
          actorId,
        );
        totalKpis += res.data.imported;
        const kept = res.data.warnings.find((x) => x.includes('교체되지 않았어요')) ? ' ⚠보존있음' : '';
        console.log(`  ✓ ${user.name.padEnd(5)} 적재 ${String(res.data.imported).padStart(2)}건(삭제 ${res.data.deletedDrafts})${wf}${df}${uf}${kept}  ${t.file}`);
      }
      if (weightSum !== 100) problems.push(`${user.name} (${t.file}): 가중치합 ${weightSum}%`);
      if (unresolved) problems.push(`${user.name} (${t.file}): 분류 확인 필요 ${unresolved}행`);
      ok++;
    } catch (err: any) {
      failed++;
      const msg = err?.response?.message ?? err?.message ?? String(err);
      console.log(`  ✗ [실패] ${user.name} ${t.file} — ${JSON.stringify(msg)}`);
      problems.push(`실패 ${user.name} (${t.file}): ${JSON.stringify(msg)}`);
    }
  }

  console.log(`\n===== ${COMMIT ? '적재(commit)' : '미리보기(dry-run)'} 요약 =====`);
  console.log(`파일 ${targets.length} | 성공 ${ok} | 실패 ${failed} | 매칭실패 ${noMatch} | KPI ${totalKpis}건`);
  if (problems.length) {
    console.log(`\n--- 확인 필요(${problems.length}) ---`);
    problems.forEach((p) => console.log('  · ' + p));
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
