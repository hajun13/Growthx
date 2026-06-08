/**
 * 그룹 대표(=에너지엑스 전체 대표이사) 전체 관리자 권한 부여 — 멱등 패치.
 *
 * 대상: 박성현(경영그룹)·박창영(친환경기술그룹)·홍두화(경영그룹).
 * 세 분은 각 그룹 대표이자 회사 전체 대표이사(총괄)이므로 전체 관리자(hr_admin) 권한이 필요하다.
 *   - role            → hr_admin   (권한부여·시스템설정·감사로그 등 6개 기능 전부 + 전사 열람)
 *   - visibilityScope → company    (행수준 전사 열람)
 *   - position(ceo)·그룹 소속은 변경하지 않는다 → 부서장 평가 자동배정(캐스케이드)은 position 기준이라
 *     role 을 올려도 그룹 평가자 자격은 그대로 유지된다.
 *
 * 이미 hr_admin/company 인 행은 변화 없음(멱등). 재시드와 무관하게 실행 중 DB 에 바로 적용 가능.
 *
 * 실행: npx ts-node prisma/patch-group-rep-admins.ts
 *       (또는 npm run patch:group-rep-admins)
 */
import { PrismaClient, Role, VisibilityScope } from '@prisma/client';

const prisma = new PrismaClient();

const GROUP_REP_ADMIN_EMAILS = [
  'spark@energyx.ai', // 박성현 — 경영그룹
  'pcy@energyx.co.kr', // 박창영 — 친환경기술그룹
  'dhong@energyx.co.kr', // 홍두화 — 경영그룹(공동대표)
];

async function main() {
  console.log('그룹 대표 전체 관리자 권한 패치 시작…');
  for (const email of GROUP_REP_ADMIN_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, position: true, visibilityScope: true },
    });
    if (!user) {
      console.warn(`  ⚠️  미존재: ${email} — 건너뜀(시드/임포트 확인 필요)`);
      continue;
    }
    if (user.role === Role.hr_admin && user.visibilityScope === VisibilityScope.company) {
      console.log(`  = 이미 적용됨: ${user.name}(${email}) role=hr_admin scope=company`);
      continue;
    }
    await prisma.user.update({
      where: { email },
      data: { role: Role.hr_admin, visibilityScope: VisibilityScope.company },
    });
    console.log(
      `  ✓ 갱신: ${user.name}(${email}) role ${user.role}→hr_admin, scope ${user.visibilityScope}→company (position=${user.position} 유지)`,
    );
  }
  console.log('완료.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
