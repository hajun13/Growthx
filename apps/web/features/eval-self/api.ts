/**
 * eval-self feature — 데이터 계층(본인평가).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 생성 DTO 는 일부 JSON 필드(weightPolicy·gradingScales·grading·gradingCriteria)를 loose 한
 * { [key:string]: unknown } 로 내보내므로, 화면·헬퍼 컴포넌트가 쓰는 정밀 lib/types 도메인 타입으로
 * 한 번 좁혀서 넘긴다(런타임 JSON 동일 — 정적 타입만 정밀화, 동작 보존).
 */
import {
  evaluationsControllerList,
  evaluationsControllerGet,
  evaluationsControllerCreate,
  evaluationsControllerPatch,
  evaluationsControllerSubmit,
  evaluationsControllerListEvidence,
  kpisControllerList,
  ruleSetsControllerGet,
} from '@growthx/contracts';
import type {
  Evaluation,
  EvaluationDetail,
  EvaluationEvidence,
  Kpi,
  RuleSet,
  PatchEvaluationRequest,
} from '@/lib/types';

/** 본인평가 목록(현재 주기·본인) — type='self' 필터는 클라이언트에서(계약 list params 미지원). */
export async function fetchSelfEvaluations(
  cycleId: string,
  evaluateeId: string,
): Promise<Evaluation[]> {
  const res = await evaluationsControllerList({ cycleId, evaluateeId });
  const list = (res.data.data ?? []) as unknown as Evaluation[];
  return list.filter((e) => e.type === 'self');
}

/** 본인평가 상세(kpiScores·comments 포함). */
export async function fetchEvaluationDetail(
  id: string,
): Promise<EvaluationDetail> {
  const res = await evaluationsControllerGet(id);
  return res.data.data as unknown as EvaluationDetail;
}

/** 평가 문항별 증빙 첨부 목록(메타데이터) — kpiId 별로 한 번에 묶어 쓴다. */
export async function fetchEvaluationEvidence(
  id: string,
): Promise<EvaluationEvidence[]> {
  // 생성 클라이언트는 kpiId 필수 시그니처지만, 백엔드는 미지정 시 평가 전체 증빙을 반환한다.
  // 화면은 평가 단위로 한 번 불러와 kpiId 로 묶으므로 빈 문자열을 넘겨 전체를 받는다.
  const res = await evaluationsControllerListEvidence(id, { kpiId: '' });
  return (res.data.data ?? []) as unknown as EvaluationEvidence[];
}

/** 본인 확정 KPI 목록(현재 주기·본인). */
export async function fetchMyKpis(
  cycleId: string,
  userId: string,
): Promise<Kpi[]> {
  const res = await kpisControllerList({ cycleId, userId });
  return (res.data.data ?? []) as unknown as Kpi[];
}

/** 등급표(RuleSet) — amount/rate 자동 산정·절대금액 기준 표시용. */
export async function fetchRuleSet(id: string): Promise<RuleSet> {
  const res = await ruleSetsControllerGet(id);
  return res.data.data as unknown as RuleSet;
}

// ── 명령(쓰기) — 생성 클라이언트 호출(반환값 미사용, 호출 후 reload) ──

export async function createSelfEvaluation(
  cycleId: string,
  evaluateeId: string,
): Promise<void> {
  await evaluationsControllerCreate({
    cycleId,
    evaluateeId,
    // 계약 type enum 은 loose({[key:string]:unknown}) — 런타임은 'self' 문자열.
    type: 'self' as never,
  });
}

export async function patchEvaluation(
  id: string,
  body: PatchEvaluationRequest,
): Promise<void> {
  await evaluationsControllerPatch(id, body as never);
}

export async function submitEvaluation(id: string): Promise<void> {
  await evaluationsControllerSubmit(id);
}
