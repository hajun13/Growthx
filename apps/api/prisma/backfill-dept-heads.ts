/**
 * 부서장 명시 지정(headUserId) 백필 — B-1 전환(2026-07-07).
 *
 * 배경: 평가자 배정이 role(team_lead/division_head)·직책(position) 자동 추론과
 * 명시 지정(headUserId)을 혼용하다가, 명시 지정 단일 기준으로 전환했다
 * (권한 레벨과 평가 조직 분리 — hr_admin 승격이 부서장을 배정에서 빼던 문제).
 * 이 스크립트는 전환 직전의 자동 추론 결과(=오늘의 실효 조직)를 그대로
 * headUserId 로 영속화해, 전환 후에도 평가 체인이 동일하게 유지되게 한다.
 *
 * 규칙(기존 추론과 동일):
 *  - team     : 소속 active 사용자 중 role=team_lead (id 정렬 첫 번째)
 *  - division : role=division_head (동일)
 *  - group    : 직속 active 사용자 중 직책 우선순위(ceo>president>vice_president>
 *               executive>director) 최상위 1명
 *  - 이미 active 부서장이 명시 지정된 부서는 건너뜀(멱등).
 *  - 후보 0명 → 미지정 유지(해당 계층 스킵 = 상위가 평가), 후보 다수 → 보고.
 *
 * 실행: apps/api 에서
 *   npx ts-node prisma/backfill-dept-heads.ts [--dry-run]
 */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const GROUP_RANK = ['ceo', 'president', 'vice_president', 'executive', 'director'];

async function main() {
  const depts = await prisma.department.findMany({
    select: { id: true, name: true, type: true, headUserId: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  let set = 0;
  let kept = 0;
  const skippedNoCandidate: string[] = [];
  const multiCandidate: string[] = [];

  for (const d of depts) {
    // 이미 active 부서장이 지정돼 있으면 유지.
    if (d.headUserId) {
      const head = await prisma.user.findUnique({
        where: { id: d.headUserId },
        select: { isActive: true, name: true },
      });
      if (head?.isActive) {
        kept += 1;
        console.log(`KEEP  [${d.type}] ${d.name} → ${head.name} (기존 지정)`);
        continue;
      }
      console.log(`WARN  [${d.type}] ${d.name} → 지정된 부서장이 비활성 — 재선정 시도`);
    }

    let pickedId: string | null = null;
    let pickedName = '';
    if (d.type === 'team' || d.type === 'division') {
      const role = d.type === 'team' ? Role.team_lead : Role.division_head;
      const candidates = await prisma.user.findMany({
        where: { departmentId: d.id, isActive: true, role },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      });
      if (candidates.length === 0) {
        skippedNoCandidate.push(`[${d.type}] ${d.name}`);
        continue;
      }
      if (candidates.length > 1) {
        multiCandidate.push(
          `[${d.type}] ${d.name}: ${candidates.map((c) => c.name).join(', ')} → ${candidates[0].name} 선정`,
        );
      }
      pickedId = candidates[0].id;
      pickedName = candidates[0].name;
    } else if (d.type === 'group') {
      const candidates = await prisma.user.findMany({
        where: { departmentId: d.id, isActive: true, position: { in: GROUP_RANK } },
        select: { id: true, name: true, position: true },
      });
      if (candidates.length === 0) {
        skippedNoCandidate.push(`[group] ${d.name}`);
        continue;
      }
      candidates.sort((a, b) => {
        const ra = GROUP_RANK.indexOf(a.position);
        const rb = GROUP_RANK.indexOf(b.position);
        if (ra !== rb) return ra - rb;
        return a.id < b.id ? -1 : 1;
      });
      if (candidates.length > 1) {
        multiCandidate.push(
          `[group] ${d.name}: ${candidates.map((c) => `${c.name}(${c.position})`).join(', ')} → ${candidates[0].name} 선정`,
        );
      }
      pickedId = candidates[0].id;
      pickedName = candidates[0].name;
    }

    if (!pickedId) continue;
    console.log(`SET   [${d.type}] ${d.name} → ${pickedName}${DRY ? ' (dry-run)' : ''}`);
    if (!DRY) {
      await prisma.department.update({
        where: { id: d.id },
        data: { headUserId: pickedId },
      });
    }
    set += 1;
  }

  console.log('\n── 요약 ──');
  console.log(`지정 유지: ${kept} · 신규 지정: ${set}${DRY ? ' (dry-run, 미적용)' : ''}`);
  if (multiCandidate.length) {
    console.log(`후보 다수(확인 권장):\n  - ${multiCandidate.join('\n  - ')}`);
  }
  if (skippedNoCandidate.length) {
    console.log(
      `후보 없음(미지정 유지 — 해당 계층은 상위가 평가):\n  - ${skippedNoCandidate.join('\n  - ')}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
