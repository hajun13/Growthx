/**
 * break-glass 계정 설정 — 웹 UI 를 만들지 않는다. UI 가 없으면 지킬 것도 없다.
 *
 * SSO 전환 후 비밀번호 로그인은 allowPasswordLogin=true 계정만 허용된다(auth.service.login).
 * Keycloak/Azure AD 장애 시 관리자가 들어올 비상구다.
 *
 * 사용:  pnpm -C apps/api exec ts-node prisma/set-break-glass-password.ts <email> <password>
 * 해제:  pnpm -C apps/api exec ts-node prisma/set-break-glass-password.ts <email> --revoke
 */
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MIN_LENGTH = 16;

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('사용법: ts-node prisma/set-break-glass-password.ts <email> <password|--revoke>');
    process.exit(2);
  }

  if (password === '--revoke') {
    await prisma.user.update({ where: { email }, data: { allowPasswordLogin: false } });
    console.log(`✅ ${email} 의 비밀번호 로그인을 해제했습니다.`);
    return;
  }

  if (password.length < MIN_LENGTH) {
    console.error(`비상구 계정 비밀번호는 최소 ${MIN_LENGTH}자여야 합니다.`);
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash, allowPasswordLogin: true },
    select: { email: true, name: true, role: true },
  });
  console.log(`✅ break-glass 활성: ${user.email} (${user.name}, ${user.role})`);
  console.warn('⚠️  이 계정은 SSO 를 우회합니다. 감사 대상으로 관리하세요.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
