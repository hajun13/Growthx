/**
 * 2025 역량평가 문항·응답·종합의견 임포트(1회성 운영 데이터 적재).
 *
 * 배경: 기존 2025 결과 임포트(평가자정리 엑셀)는 역량을 "단일 환산 점수"로만 저장했다.
 * 이 스크립트는 실제 개인별 평가표 엑셀(D:\2025\**\*평가표*.xlsx, 90개)의
 * "역량평가서(개인_비직책자/직책자)" 시트를 파싱해 **문항 단위**(본인+1차/2차/최종)
 * 응답과 종합의견을 2025 사이클에 채운다 — 새 다단계 역량평가서 UI로 그대로 조회 가능.
 *
 * 문항 세트는 비직책자/직책자 각 16개(4카테고리×4문항, 카테고리 가중치 30/25/15/30%)로
 * 전 그룹 공통(회사 표준 양식) — 최초 유효 파일에서 1회 추출해 canonical 로 고정하고,
 * 이후 파일은 같은 행(13~28) 인덱스로 점수만 매칭한다(텍스트 불일치는 경고만, 스킵하지 않음).
 *
 * 시트 셀 레이아웃(고정, 엑셀 수식 추적으로 확정):
 *   B12행 헤더: 지표|가중치|키워드|행동지표|본인평가|1차평가자|2차평가자|최종평가자
 *   13~28행: 문항(카테고리 rowSpan) — C=카테고리 가중치(0~1), D=키워드, E=행동지표,
 *            F=본인 점수, G=1차 점수, H=2차 점수, I=최종 점수(1~5, 공백=미실시)
 *   G7/G8/G9: 1차/2차/최종 평가자 "이름 직책"(예: "박승현 팀장"), "-"=미지정
 *   C33/C35/C37: 1차/2차/최종 종합의견(병합 2행, 각 첫 행에만 값)
 *
 * 매칭: 피평가자·평가자 모두 org.users 이름 단순 일치(전사 122명 동명이인 0명 확인됨,
 * 2025 결과 임포트 시 이미 재직/퇴사 판정이 끝난 인원들이라 이름이 유일하다).
 * 미매칭 평가자는 그 단계만 스킵(로그), 미매칭 피평가자는 파일 전체 스킵(로그).
 *
 * 실행(apps/api 에서, 로컬 DATABASE_URL=localhost:5432 도커 포워딩 사용):
 *   npx ts-node prisma/import-legacy-competency.ts --dry-run [--root "D:\2025"] [--cycle <id>]
 *   npx ts-node prisma/import-legacy-competency.ts --commit  [--root "D:\2025"] [--cycle <id>]
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { Grade, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const rootArg = argValue('--root') ?? 'D:\\2025';
const cycleArg = argValue('--cycle');
const SUBMITTED_AT = new Date('2025-12-15T00:00:00.000Z');

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const SCORE_TO_GRADE: Record<number, Grade> = {
  1: Grade.D,
  2: Grade.C,
  3: Grade.B,
  4: Grade.A,
  5: Grade.S,
};

// 평가자 표기 "이름 직책" 에서 직책 접미(팀장/본부장/대표/이사 등)를 떼고 이름만 추출.
// "-" 또는 빈 값 = 미지정.
function parseEvaluatorName(raw: unknown): string | null {
  const text = cellText(raw)?.trim();
  if (!text || text === '-') return null;
  const first = text.split(/\s+/)[0];
  return first || null;
}

// exceljs 셀 값 → 평문 문자열. 수식 캐시({formula,result})·richText·null 전부 처리.
function cellText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result !== undefined) return cellText(o.result);
    if (typeof o.text === 'string') return o.text;
  }
  return null;
}

function cellNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const o = v as { result?: unknown };
    if (typeof o.result === 'number') return o.result;
  }
  return null;
}

interface QuestionDef {
  order: number;
  categoryName: string;
  weight: number; // 카테고리 가중치 %(0~100), 문항마다 동일값(엑셀 원본 그대로 — 개수분할 아님)
  text: string; // 행동지표(E열)
  hint: string; // 키워드(D열)
}

type TargetGroup = 'manager' | 'non_manager';

interface PersonRow {
  file: string;
  targetGroup: TargetGroup;
  name: string;
  department: string | null;
  position: string | null;
  evaluators: { round1: string | null; round2: string | null; round3: string | null };
  scores: { self: number | null; round1: number | null; round2: number | null; round3: number | null }[]; // 인덱스=canonical 문항 순서
  opinions: { round1: string | null; round2: string | null; round3: string | null };
  rowTextMismatch: boolean;
}

async function findXlsxFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.xlsx$/i.test(entry.name) && !entry.name.startsWith('~$')) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function competencySheetOf(wb: ExcelJS.Workbook): { ws: ExcelJS.Worksheet; targetGroup: TargetGroup } | null {
  const ws = wb.worksheets.find((w) => w.name.startsWith('역량평가서'));
  if (!ws) return null;
  const targetGroup: TargetGroup = ws.name.includes('비직책자') ? 'non_manager' : 'manager';
  return { ws, targetGroup };
}

// 13~28행에서 canonical 문항 정의(카테고리·가중치·키워드·행동지표) 1회 추출.
function extractQuestionDefs(ws: ExcelJS.Worksheet): QuestionDef[] {
  const defs: QuestionDef[] = [];
  for (let r = 13; r <= 28; r++) {
    const row = ws.getRow(r);
    const categoryName = (cellText(row.getCell(2).value) ?? '').replace(/\s+/g, ' ').trim();
    const weightFrac = cellNumber(row.getCell(3).value) ?? 0;
    const hint = cellText(row.getCell(4).value) ?? '';
    const text = cellText(row.getCell(5).value) ?? '';
    if (!categoryName || !text) break;
    defs.push({ order: r - 12, categoryName, weight: Math.round(weightFrac * 100), text, hint });
  }
  return defs;
}

// 같은 targetGroup 의 canonical 문항과 이 파일의 13~28행 텍스트가 일치하는지(정보용, 비차단).
function rowsMatchCanonical(ws: ExcelJS.Worksheet, canonical: QuestionDef[]): boolean {
  for (let i = 0; i < canonical.length; i++) {
    const r = 13 + i;
    const row = ws.getRow(r);
    const text = cellText(row.getCell(5).value) ?? '';
    if (text !== canonical[i].text) return false;
  }
  return true;
}

function parsePerson(file: string, ws: ExcelJS.Worksheet, targetGroup: TargetGroup, canonical: QuestionDef[]): PersonRow | null {
  const name = cellText(ws.getCell('C5').value)?.trim();
  if (!name) return null;
  const department = cellText(ws.getCell('C6').value)?.trim() ?? null;
  const position = cellText(ws.getCell('C7').value)?.trim() ?? null;
  const evaluators = {
    round1: parseEvaluatorName(ws.getCell('G7').value),
    round2: parseEvaluatorName(ws.getCell('G8').value),
    round3: parseEvaluatorName(ws.getCell('G9').value),
  };
  const scores = canonical.map((_, i) => {
    const r = 13 + i;
    const row = ws.getRow(r);
    return {
      self: cellNumber(row.getCell(6).value),
      round1: cellNumber(row.getCell(7).value),
      round2: cellNumber(row.getCell(8).value),
      round3: cellNumber(row.getCell(9).value),
    };
  });
  const opinions = {
    round1: cellText(ws.getCell('C33').value)?.trim() || null,
    round2: cellText(ws.getCell('C35').value)?.trim() || null,
    round3: cellText(ws.getCell('C37').value)?.trim() || null,
  };
  return {
    file,
    targetGroup,
    name,
    department,
    position,
    evaluators,
    scores,
    opinions,
    rowTextMismatch: !rowsMatchCanonical(ws, canonical),
  };
}

// ── 문항 사전 생성(카테고리+질문) — run() 이 canonical 추출 직후 호출해 questionIdOf 캐시를 채운다 ──
const questionCache: Record<TargetGroup, string[]> = { manager: [], non_manager: [] };
function questionIdOf(tg: TargetGroup, index: number): string {
  const id = questionCache[tg][index];
  if (!id) throw new Error(`문항 캐시 미초기화: ${tg}[${index}]`);
  return id;
}

async function createQuestionsIfNeeded(cycleId: string, defsByGroup: Record<TargetGroup, QuestionDef[] | null>, commit: boolean) {
  if (!commit) {
    for (const tg of ['non_manager', 'manager'] as const) {
      const defs = defsByGroup[tg];
      if (!defs) continue;
      // DRY-RUN: 실제 id 없이 안정적 placeholder(순번 기반)로 채워 카운팅만 가능하게.
      for (const d of defs) questionCache[tg][d.order - 1] = `dry-${tg}-${d.order}`;
    }
    return;
  }
  const hrAdmin = await prisma.user.findFirst({ where: { role: 'hr_admin' } });
  if (!hrAdmin) throw new Error('hr_admin 사용자를 찾을 수 없어요(문항 createdById 필요).');

  for (const tg of ['non_manager', 'manager'] as const) {
    const defs = defsByGroup[tg];
    if (!defs) continue;
    for (const d of defs) {
      const category = await prisma.competencyCategory.upsert({
        where: { name: d.categoryName },
        create: { name: d.categoryName },
        update: {},
      });
      const existing = await prisma.competencyQuestion.findFirst({
        where: { cycleId, targetGroup: tg, order: d.order },
      });
      const row = existing
        ? await prisma.competencyQuestion.update({
            where: { id: existing.id },
            data: { text: d.text, hint: d.hint, categoryId: category.id, weight: d.weight },
          })
        : await prisma.competencyQuestion.create({
            data: {
              cycleId,
              order: d.order,
              text: d.text,
              hint: d.hint,
              categoryId: category.id,
              weight: d.weight,
              targetGroup: tg,
              isActive: true,
              createdById: hrAdmin.id,
            },
          });
      questionCache[tg][d.order - 1] = row.id;
    }
  }
}

// canonical 추출 → 문항 upsert(questionCache 채움) → 응답/의견 적재, 순서로 진행.
async function run() {
  console.log(`모드: ${COMMIT ? 'COMMIT(적재)' : 'DRY-RUN(검증만)'} · 루트: ${rootArg}`);

  const cycle = cycleArg
    ? await prisma.evaluationCycle.findUnique({ where: { id: cycleArg } })
    : await prisma.evaluationCycle.findFirst({ where: { year: 2025 } });
  if (!cycle) throw new Error('2025 사이클을 찾을 수 없어요(--cycle 로 직접 지정 가능).');
  console.log(`사이클: ${cycle.name} (${cycle.id}, status=${cycle.status})`);

  const files = await findXlsxFiles(rootArg);
  console.log(`엑셀 파일 ${files.length}개 발견`);

  const canonical: Record<TargetGroup, QuestionDef[] | null> = { manager: null, non_manager: null };
  const people: PersonRow[] = [];
  const parseErrors: { file: string; reason: string }[] = [];

  for (const file of files) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const sheet = competencySheetOf(wb);
      if (!sheet) {
        parseErrors.push({ file, reason: '역량평가서 시트 없음' });
        continue;
      }
      if (!canonical[sheet.targetGroup]) {
        canonical[sheet.targetGroup] = extractQuestionDefs(sheet.ws);
        console.log(
          `[canonical:${sheet.targetGroup}] ${canonical[sheet.targetGroup]!.length}문항 추출 (기준파일: ${path.basename(file)})`,
        );
      }
      const defs = canonical[sheet.targetGroup]!;
      const person = parsePerson(file, sheet.ws, sheet.targetGroup, defs);
      if (!person) {
        parseErrors.push({ file, reason: '성명(C5) 없음' });
        continue;
      }
      people.push(person);
    } catch (e) {
      parseErrors.push({ file, reason: (e as Error).message });
    }
  }

  console.log(`파싱 성공 ${people.length}명, 실패 ${parseErrors.length}건`);
  if (parseErrors.length) {
    console.log('파싱 실패:');
    for (const e of parseErrors) console.log(`  - ${path.basename(e.file)}: ${e.reason}`);
  }
  const mismatched = people.filter((p) => p.rowTextMismatch);
  if (mismatched.length) {
    console.log(
      `행 텍스트 불일치(정보용, 그대로 진행) ${mismatched.length}건: ${mismatched.map((p) => p.name).join(', ')}`,
    );
  }

  await createQuestionsIfNeeded(cycle.id, canonical, COMMIT);
  if (COMMIT) {
    console.log(
      `문항 upsert 완료: non_manager ${questionCache.non_manager.length}개 · manager ${questionCache.manager.length}개`,
    );
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userIdByName = new Map(users.map((u) => [u.name, u.id]));

  const unmatchedEvaluatees: string[] = [];
  const unmatchedEvaluators = new Set<string>();
  let selfCount = 0;
  let round1Count = 0;
  let round2Count = 0;
  let round3Count = 0;
  let opinionCount = 0;

  for (const p of people) {
    const evaluateeId = userIdByName.get(p.name);
    if (!evaluateeId) {
      unmatchedEvaluatees.push(`${p.name} (${path.basename(p.file)})`);
      continue;
    }
    const evaluatorIds: Record<'round1' | 'round2' | 'round3', string | null> = {
      round1: null,
      round2: null,
      round3: null,
    };
    (['round1', 'round2', 'round3'] as const).forEach((stage) => {
      const rawName = p.evaluators[stage];
      if (!rawName) return;
      const id = userIdByName.get(rawName);
      if (id) evaluatorIds[stage] = id;
      else unmatchedEvaluators.add(`${rawName} (평가자, ${stage}, 피평가자=${p.name})`);
    });

    if (!canonical[p.targetGroup]) continue;
    const defs = canonical[p.targetGroup]!;
    const writes: { questionId: string; stage: string; evaluatorId: string; grade: Grade }[] = [];

    for (let i = 0; i < defs.length; i++) {
      const s = p.scores[i];
      const questionId = questionIdOf(p.targetGroup, i);
      if (s.self !== null && s.self >= 1 && s.self <= 5) {
        writes.push({ questionId, stage: 'self', evaluatorId: evaluateeId, grade: SCORE_TO_GRADE[s.self] });
        selfCount++;
      }
      if (s.round1 !== null && s.round1 >= 1 && s.round1 <= 5 && evaluatorIds.round1) {
        writes.push({ questionId, stage: 'round1', evaluatorId: evaluatorIds.round1, grade: SCORE_TO_GRADE[s.round1] });
        round1Count++;
      }
      if (s.round2 !== null && s.round2 >= 1 && s.round2 <= 5 && evaluatorIds.round2) {
        writes.push({ questionId, stage: 'round2', evaluatorId: evaluatorIds.round2, grade: SCORE_TO_GRADE[s.round2] });
        round2Count++;
      }
      if (s.round3 !== null && s.round3 >= 1 && s.round3 <= 5 && evaluatorIds.round3) {
        writes.push({ questionId, stage: 'round3', evaluatorId: evaluatorIds.round3, grade: SCORE_TO_GRADE[s.round3] });
        round3Count++;
      }
    }

    const opinionWrites: { stage: string; evaluatorId: string; comment: string }[] = [];
    (['round1', 'round2', 'round3'] as const).forEach((stage) => {
      const comment = p.opinions[stage];
      const evalId = evaluatorIds[stage];
      if (comment && evalId) {
        opinionWrites.push({ stage, evaluatorId: evalId, comment });
        opinionCount++;
      }
    });

    if (COMMIT) {
      for (const w of writes) {
        await prisma.competencyResponse.upsert({
          where: {
            questionId_userId_cycleId_stage: {
              questionId: w.questionId,
              userId: evaluateeId,
              cycleId: cycle.id,
              stage: w.stage,
            },
          },
          create: {
            questionId: w.questionId,
            userId: evaluateeId,
            cycleId: cycle.id,
            stage: w.stage,
            evaluatorId: w.evaluatorId,
            grade: w.grade,
            submittedAt: SUBMITTED_AT,
          },
          update: { evaluatorId: w.evaluatorId, grade: w.grade, submittedAt: SUBMITTED_AT },
        });
      }
      for (const o of opinionWrites) {
        await prisma.competencyOpinion.upsert({
          where: { cycleId_userId_stage: { cycleId: cycle.id, userId: evaluateeId, stage: o.stage } },
          create: { cycleId: cycle.id, userId: evaluateeId, stage: o.stage, evaluatorId: o.evaluatorId, comment: o.comment },
          update: { evaluatorId: o.evaluatorId, comment: o.comment },
        });
      }
    }
  }

  console.log('\n=== 결과 요약 ===');
  console.log(`본인평가 응답 ${selfCount}건 · 1차 ${round1Count}건 · 2차 ${round2Count}건 · 최종 ${round3Count}건`);
  console.log(`종합의견 ${opinionCount}건`);
  console.log(`미매칭 피평가자(파일 스킵) ${unmatchedEvaluatees.length}건: ${unmatchedEvaluatees.join(', ') || '없음'}`);
  console.log(`미매칭 평가자(해당 단계만 스킵) ${unmatchedEvaluators.size}건:`);
  for (const u of unmatchedEvaluators) console.log(`  - ${u}`);
  if (!COMMIT) {
    console.log('\n[DRY-RUN] 실제 DB 반영 없음. 문제 없으면 --commit 으로 재실행하세요.');
  }
}

run()
  .catch((e) => {
    console.error('IMPORT_ERROR', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
