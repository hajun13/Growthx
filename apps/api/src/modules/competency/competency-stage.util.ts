import { EvaluationType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 역량평가 단계 — 엑셀 역량평가서의 열(본인/1차/2차/최종)에 대응.
 * round1~3 은 다단계 부서장(downward) 평가 배정과 동일 체인(1차 팀장→2차 본부장→최종 그룹대표,
 * 부그룹장 압축 포함)을 그대로 따른다.
 */
export type CompetencyStage = 'self' | 'round1' | 'round2' | 'round3';

export const COMPETENCY_EVALUATOR_STAGES = ['round1', 'round2', 'round3'] as const;

export const COMPETENCY_STAGE_LABELS: Record<CompetencyStage, string> = {
  self: '본인평가',
  round1: '1차평가자',
  round2: '2차평가자',
  round3: '최종평가자',
};

/**
 * 역량평가 문항 대상군(manager/non_manager) 판정 — **한 사람은 항상 정확히 하나**.
 * role=hr_admin 은 권한 레벨일 뿐 실제 직책과 무관하다([[dept-head-by-role]]와 동일 원칙 —
 * hr_admin 중에도 position=ceo(그룹대표) 부터 position=pro(개인 기여자)까지 전부 있다).
 * 그래서 role 만으로 분기하면 hr_admin 은 "둘 다"로 새어나가 문항 32개가 한 시트에
 * 뒤섞여 카테고리 rowSpan 이 깨진다 — **PositionDef.isManagement 를 1차 판정 기준**으로 쓰고,
 * position 이 레지스트리에 없을 때만 role(team_lead/division_head→manager)로 폴백한다.
 */
export async function resolveCompetencyTargetGroup(
  prisma: PrismaService,
  user: { role: Role; position?: string | null },
): Promise<'manager' | 'non_manager'> {
  if (user.position) {
    const def = await prisma.positionDef.findUnique({
      where: { code: user.position },
      select: { isManagement: true },
    });
    if (def) return def.isManagement ? 'manager' : 'non_manager';
  }
  return user.role === Role.team_lead || user.role === Role.division_head ? 'manager' : 'non_manager';
}

/**
 * writer 가 target 의 역량평가서에서 쓸 수 있는 열(단계)을 판정.
 *  - 본인이면 'self'.
 *  - 그 외에는 해당 주기의 하향(downward) 평가 배정(Evaluation 행)이 권위 —
 *    KPI 다단계 평가와 동일한 평가선이 역량평가서의 1차/2차/최종 열이 된다.
 *  - 배정이 없으면 null(쓰기 불가).
 */
export async function resolveWriterStage(
  prisma: PrismaService,
  cycleId: string,
  writerId: string,
  targetUserId: string,
): Promise<CompetencyStage | null> {
  if (writerId === targetUserId) return 'self';
  const assignment = await prisma.evaluation.findFirst({
    where: {
      cycleId,
      evaluatorId: writerId,
      evaluateeId: targetUserId,
      type: EvaluationType.downward,
    },
    orderBy: { round: 'desc' },
    select: { round: true },
  });
  if (!assignment?.round || assignment.round < 1 || assignment.round > 3) return null;
  return `round${assignment.round}` as CompetencyStage;
}
