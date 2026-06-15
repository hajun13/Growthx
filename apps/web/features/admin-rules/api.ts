/**
 * admin-rules feature — 데이터 계층(평가 규칙 RuleSet).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 비고: 생성 DTO(RuleSetDto)의 gradeScale·weightPolicy 등은 OpenAPI 상 느슨한 JSON
 * ({ [key: string]: unknown }) 으로 발행된다. 런타임 shape 은 백엔드가 직렬화하는
 * 도메인 RuleSet 과 동일하므로, 컴포넌트엔 풍부한 도메인 타입(@/lib/types RuleSet)으로
 * 좁혀서 넘긴다(편집 모델 toDraft/toPatchBody 가 이 타입에 의존).
 */
import {
  ruleSetsControllerList,
  ruleSetsControllerGet,
  ruleSetsControllerCreate,
  ruleSetsControllerUpdate,
} from '@growthx/contracts';
import type { RuleSet } from '@/lib/types';

/** 전체 RuleSet 목록. */
export async function fetchRuleSets(): Promise<RuleSet[]> {
  const res = await ruleSetsControllerList();
  return (res.data.data ?? []) as unknown as RuleSet[];
}

/** 단일 RuleSet 조회. */
export async function fetchRuleSet(id: string): Promise<RuleSet> {
  const res = await ruleSetsControllerGet(id);
  return res.data.data as unknown as RuleSet;
}

/** RuleSet 생성(현재 화면 미사용 — 슬라이스 표준 4함수 노출). */
export async function createRuleSet(body: Partial<RuleSet>): Promise<RuleSet> {
  // 생성 DTO 는 느슨한 JSON 5필드 — 도메인 부분 객체를 그대로 직렬화한다.
  // 응답 봉투(200 {data}) 또는 void(201) 유니온 — 봉투에서 unwrap.
  const res = await ruleSetsControllerCreate(body as never);
  const envelope = res.data as { data?: RuleSet } | void;
  return (envelope?.data ?? null) as unknown as RuleSet;
}

/** RuleSet 부분 수정(PATCH). 인상률·그룹실적 보너스·가중치 정책 등 저장. */
export async function updateRuleSet(
  id: string,
  body: Partial<RuleSet>,
): Promise<RuleSet> {
  const res = await ruleSetsControllerUpdate(id, body as never);
  return res.data.data as unknown as RuleSet;
}
