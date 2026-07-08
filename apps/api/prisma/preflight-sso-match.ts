/**
 * SSO 전환 pre-flight 게이트.
 *
 * Azure AD 사용자 목록 CSV 를 org.users 와 대조해 3분류한다.
 * missing 이 0 이 아니면 SSO 배포를 하지 않는다 — 그 사용자는 로그인이 불가능하다.
 *
 * CSV 는 Entra 관리 콘솔 > 사용자 > 사용자 다운로드 결과를 그대로 쓴다.
 * 필수 컬럼: userPrincipalName, mail (둘 중 하나라도 org.users 와 맞으면 matched)
 *
 * upn 과 mail 을 둘 다 후보로 넣는 이유: Keycloak IdP 에 upn→email 폴백 매퍼를 걸어서,
 * 최종 저장되는 이메일이 mail 이 있으면 mail, 없으면 upn 이기 때문이다.
 *   → EX-DB-API/docs/superpowers/plans/2026-07-08-growthx-keycloak-sso.md Task 2 Step 3
 *
 * ⚠ 이 스크립트는 "Entra 가 가진 값"을 본다. "토큰에 실리는 값"은 GATE A 에서 실측한다.
 *   둘이 다르면 실측을 믿는다.
 *
 * 사용:  pnpm -C apps/api run preflight:sso azure-users.csv
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { parseCsv } from './csv';

const prisma = new PrismaClient();

interface Row {
  email: string;
  name: string;
  role: string;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('사용법: pnpm -C apps/api run preflight:sso <azure-users.csv>');
    process.exit(2);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 를 찾을 수 없습니다: ${csvPath}`);
    process.exit(2);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (rows.length === 0) {
    console.error('CSV 에 데이터 행이 없습니다.');
    process.exit(2);
  }

  const headerKeys = Object.keys(rows[0]);
  const hasUpn = headerKeys.includes('userPrincipalName');
  const hasMail = headerKeys.includes('mail');
  if (!hasUpn && !hasMail) {
    console.error(
      `CSV 에 userPrincipalName / mail 컬럼이 없습니다. 발견된 컬럼: ${headerKeys.join(', ')}`,
    );
    process.exit(2);
  }

  // Azure 측 이메일 후보 집합 (upn, mail 둘 다)
  const azureEmails = new Set<string>();
  for (const r of rows) {
    for (const key of ['userPrincipalName', 'mail']) {
      const v = r[key]?.toLowerCase();
      if (v) azureEmails.add(v);
    }
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true, role: true },
  });
  const aliases = await prisma.userEmailAlias.findMany({ select: { email: true, userId: true } });
  const aliasByUser = new Map<string, string[]>();
  for (const a of aliases) {
    aliasByUser.set(a.userId, [...(aliasByUser.get(a.userId) ?? []), a.email.toLowerCase()]);
  }

  const matched: string[] = [];
  const aliasNeeded: (Row & { candidate: string })[] = [];
  const missing: Row[] = [];

  for (const u of users) {
    const primary = u.email.toLowerCase();
    if (azureEmails.has(primary)) {
      matched.push(primary);
      continue;
    }
    if ((aliasByUser.get(u.id) ?? []).some((a) => azureEmails.has(a))) {
      matched.push(primary);
      continue;
    }

    // local-part 가 같은 Azure 계정이 있으면 별칭으로 해소 가능
    const local = primary.split('@')[0];
    const candidate = [...azureEmails].find((a) => a.split('@')[0] === local);
    if (candidate) {
      aliasNeeded.push({ email: primary, name: u.name, role: u.role, candidate });
    } else {
      missing.push({ email: primary, name: u.name, role: u.role });
    }
  }

  console.log(`\nAzure AD 계정 후보: ${azureEmails.size}개 (upn+mail, 중복 제거)`);
  console.log(`org.users 활성 사용자: ${users.length}명\n`);
  console.log(`✅ matched      : ${matched.length}`);
  console.log(`⚠️  alias-needed : ${aliasNeeded.length}`);
  for (const a of aliasNeeded) {
    console.log(`     ${a.email} ← ${a.candidate}  (${a.name}, ${a.role})`);
  }
  console.log(`❌ missing      : ${missing.length}`);
  for (const m of missing) {
    console.log(`     ${m.email}  (${m.name}, ${m.role})`);
  }

  if (aliasNeeded.length > 0) {
    console.log('\n--- 해소 SQL ---');
    for (const a of aliasNeeded) {
      console.log(
        `INSERT INTO org.user_email_aliases (email, user_id, note, created_at)\n` +
          `SELECT '${a.candidate}', id, 'Azure AD 이메일이 org.users.email 과 다름', now()\n` +
          `FROM org.users WHERE email = '${a.email}';`,
      );
    }
  }

  if (missing.length > 0) {
    console.error('\nmissing 이 0 이 아닙니다. SSO 배포를 중단하세요.');
    process.exit(1);
  }
  if (aliasNeeded.length > 0) {
    console.error('\nalias-needed 를 user_email_aliases 에 넣기 전까지 배포하지 마세요.');
    process.exit(1);
  }
  console.log('\n게이트 통과.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
