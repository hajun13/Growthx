/**
 * 중간점검 수정안 폼의 순수 계산 — 화면(MemberRevisionPanel)에서 분리해 둔다.
 * 여기 있는 함수들은 React 에 의존하지 않으므로 "복원했더니 값이 어긋난다" 류의 판정을
 * 화면 조립 코드와 섞지 않고 한 곳에서 읽을 수 있다.
 */
import type { KpiProgress, MidtermRevisionItem } from '@/lib/types';

/** 입력칸 3종의 문자열 상태(숫자도 입력 중 상태를 보존하려고 문자열로 둔다). */
export interface Draft {
  targetText: string;
  targetValue: string;
  weight: string;
}

/** 서버에 보관된 임시저장본(백엔드 MidtermRevisionDraft 와 동일 형태). */
export interface SavedRevisionDraft {
  items?: MidtermRevisionItem[];
  memberNote?: string | null;
  savedAt?: string | null;
}

/** 진척 조회 값 그대로의 폼 초기값(= "아직 아무것도 바꾸지 않은 상태"). */
export function baselineDraft(k: KpiProgress): Draft {
  return {
    targetText: k.targetText ?? '',
    targetValue: k.targetValue === null || k.targetValue === undefined ? '' : String(k.targetValue),
    weight: String(k.weight),
  };
}

/**
 * "지금 화면의 내용"을 저장본과 비교하기 위한 결정적 문자열.
 * JSON.stringify 를 그대로 쓰면 안 된다 — 서버 JSONB 는 객체 키 순서를 보존하지 않아
 * 방금 저장한 내용을 다시 받아도 문자열이 달라지고, 미저장 경고가 계속 떠 있게 된다.
 */
export function snapshotKey(items: MidtermRevisionItem[], note: string): string {
  const rows = items
    .map((i) => [
      i.kpiId,
      i.targetText === undefined ? null : i.targetText,
      i.targetValue === undefined ? null : i.targetValue,
      i.weight === undefined ? null : i.weight,
      // 값이 null 인 것과 필드 자체가 없는 것("변경 없음")을 구분해야 한다.
      `${i.targetText !== undefined}|${i.targetValue !== undefined}|${i.weight !== undefined}`,
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([rows, note]);
}

/**
 * 현재 폼과 진척(기준값)의 차이 = 제출 페이로드.
 * 미저장 가드·가중치 게이트·제출·복원 직후의 저장 키가 모두 이 한 함수를 본다.
 */
export function computeChangedItems(
  kpis: KpiProgress[],
  drafts: Record<string, Draft>,
): MidtermRevisionItem[] {
  const items: MidtermRevisionItem[] = [];
  for (const k of kpis) {
    const d = drafts[k.kpiId];
    if (!d) continue;
    const item: MidtermRevisionItem = { kpiId: k.kpiId };
    let touched = false;
    if (d.targetText !== (k.targetText ?? '')) {
      item.targetText = d.targetText || null;
      touched = true;
    }
    const nextValue = d.targetValue === '' ? null : Number(d.targetValue);
    if (nextValue !== (k.targetValue ?? null)) {
      item.targetValue = nextValue;
      touched = true;
    }
    if (Number(d.weight) !== k.weight) {
      item.weight = Number(d.weight);
      touched = true;
    }
    if (touched) items.push(item);
  }
  return items;
}

/** 임시저장본에서 복원돼, 현재 KPI 값과 다른 입력칸의 키(`${kpiId}:${field}`). */
export type RestoredFieldKey = string;
export const restoredKey = (kpiId: string, field: keyof Draft): RestoredFieldKey =>
  `${kpiId}:${field}`;

export interface SeedResult {
  drafts: Record<string, Draft>;
  note: string;
  savedAt: string | null;
  /** 복원 직후의 "저장된 내용" 키. 임시저장본이 없으면 null. */
  savedKey: string | null;
  restored: Set<RestoredFieldKey>;
}

/**
 * 폼 초기값 계산 — 진척(기준값) 위에 임시저장본을 얹는다.
 *
 * 두 가지를 함께 해결한다.
 *  1) **기준값이 그 사이 바뀐 경우**: 임시저장본은 저장 당시의 기준값을 기준으로 쓴 값이라,
 *     그 뒤 재조정 승인이나 KPI 재확정으로 목표·가중치가 바뀌었어도 화면에는 옛 숫자가
 *     아무 표시 없이 되살아난다. 그래서 지금 기준값과 다른 입력칸을 restored 로 표시해
 *     화면이 "현재 값"을 함께 보여 주고 본인이 판단하게 한다.
 *  2) **유령 미저장 경고**: 저장한 값이 지금은 기준값과 같아졌다면 제출 페이로드에서
 *     빠지므로, 저장본 items 를 그대로 키로 삼으면 손대지 않은 폼에 "저장하지 않은 변경"이
 *     뜬다. 저장 키를 **복원 결과에서 다시 계산**해 두 값이 같은 기준으로 비교되게 한다.
 */
export function seedForm(kpis: KpiProgress[], saved: SavedRevisionDraft | null): SeedResult {
  const drafts: Record<string, Draft> = {};
  for (const k of kpis) drafts[k.kpiId] = baselineDraft(k);

  const restored = new Set<RestoredFieldKey>();
  if (!saved) {
    return { drafts, note: '', savedAt: null, savedKey: null, restored };
  }

  const byId = new Map(kpis.map((k) => [k.kpiId, k]));
  for (const item of saved.items ?? []) {
    const base = drafts[item.kpiId];
    // 그 사이 확정이 풀린 KPI 는 편집 대상이 아니다 → 복원하지 않는다(제출도 막힌다).
    if (!base || !byId.has(item.kpiId)) continue;
    const next: Draft = {
      targetText: item.targetText !== undefined ? (item.targetText ?? '') : base.targetText,
      targetValue:
        item.targetValue !== undefined
          ? item.targetValue === null
            ? ''
            : String(item.targetValue)
          : base.targetValue,
      weight: item.weight !== undefined ? String(item.weight) : base.weight,
    };
    drafts[item.kpiId] = next;
    // 기준값과 실제로 달라진 칸만 표시한다 — 같아진 칸은 알릴 것이 없다.
    (['targetText', 'targetValue', 'weight'] as (keyof Draft)[]).forEach((field) => {
      if (next[field] !== base[field]) restored.add(restoredKey(item.kpiId, field));
    });
  }

  const note = (saved.memberNote ?? '').trim();
  return {
    drafts,
    note: saved.memberNote ?? '',
    savedAt: saved.savedAt ?? null,
    savedKey: snapshotKey(computeChangedItems(kpis, drafts), note),
    restored,
  };
}
