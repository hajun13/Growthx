/**
 * 결함 #7 백필 — EvaluationResult 조직 id 스냅샷.
 *
 * 기존 결과 행들은 이름 스냅샷(group/division/teamSnapshot)만 보유한다.
 * 조직개편으로 부서명이 바뀐 과거 데이터의 동명 부서 매칭이 어긋날 수 있어,
 * 부서 id 스냅샷(group/division/teamIdSnapshot)을 채운다.
 *
 * 매칭 우선순위:
 *   1) result.user.departmentId 가 있으면 → 그 부서 조상에서 group/division/team id(가장 정확).
 *   2) departmentId 가 없으면(퇴사자 등) → 이름 스냅샷(부모경로 포함)으로 부서 유일 식별.
 *      동명이 여럿이면 부모경로로 좁히고, 그래도 모호하면 미매칭으로 둔다.
 *   - 이미 id 스냅샷이 채워진 행은 skip.
 *
 * 실행: npx ts-node prisma/backfill-eval-result-dept-ids.ts
 *       (또는 npm run backfill:eval-dept-ids)
 * seed.ts 와 동일한 standalone ts-node 스타일.
 */
import { PrismaClient } from '@prisma/client';
import {
  deptSnapshotFromTree,
  deptSnapshotFromNames,
  DeptTreeNode,
} from '../src/common/access/access.util';

const prisma = new PrismaClient();

async function main() {
  // 부서 트리 1회 적재(메모리 매칭).
  const deptTree: DeptTreeNode[] = await prisma.department.findMany({
    select: { id: true, name: true, type: true, parentId: true },
  });

  const results = await prisma.evaluationResult.findMany({
    select: {
      id: true,
      groupSnapshot: true,
      divisionSnapshot: true,
      teamSnapshot: true,
      groupIdSnapshot: true,
      divisionIdSnapshot: true,
      teamIdSnapshot: true,
      user: { select: { departmentId: true } },
    },
  });

  let filled = 0;
  let unmatched = 0;
  let skipped = 0;

  for (const r of results) {
    // 이미 id 스냅샷 보유(어느 레벨이든 채워짐) → skip.
    if (r.groupIdSnapshot || r.divisionIdSnapshot || r.teamIdSnapshot) {
      skipped += 1;
      continue;
    }

    // 1) departmentId 우선(가장 정확).
    const deptId = r.user?.departmentId ?? null;
    let snap = deptId
      ? deptSnapshotFromTree(deptTree, deptId)
      : deptSnapshotFromNames(
          deptTree,
          r.groupSnapshot,
          r.divisionSnapshot,
          r.teamSnapshot,
        );

    // departmentId 가 있었지만 트리에서 못 찾은 경우(미존재 부서) → 이름 폴백.
    if (deptId && !snap.groupId && !snap.divisionId && !snap.teamId) {
      snap = deptSnapshotFromNames(
        deptTree,
        r.groupSnapshot,
        r.divisionSnapshot,
        r.teamSnapshot,
      );
    }

    if (!snap.groupId && !snap.divisionId && !snap.teamId) {
      unmatched += 1;
      continue; // 매칭 실패 → id 스냅샷 null 유지.
    }

    await prisma.evaluationResult.update({
      where: { id: r.id },
      data: {
        groupIdSnapshot: snap.groupId,
        divisionIdSnapshot: snap.divisionId,
        teamIdSnapshot: snap.teamId,
      },
    });
    filled += 1;
  }

  console.log(
    `[backfill:eval-dept-ids] 채움 ${filled}건 / 미매칭 ${unmatched}건 / skip ${skipped}건 (전체 ${results.length}건)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
