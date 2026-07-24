'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorState, Skeleton } from '@/components/States';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { InfoBanner } from '@/components/InfoBanner';
import { useMidtermDetail, useMidtermProgress } from '../hooks';
import { saveMidtermRevisionDraft, submitMidtermRevision } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import {
  applyItemToDraft,
  baselineDraft,
  computeChangedItems,
  restoredKey,
  seedForm,
  snapshotKey,
  type Draft,
  type RestoredFieldKey,
} from '../revisionDraft';
import type { KpiProgress, MidtermRevisionItem } from '@/lib/types';

/** 임시저장본에서 복원됐고 지금 KPI 값과 다른 입력칸에 붙는 안내. */
function RestoredHint({ current }: { current: string }) {
  return (
    <p className="mt-1 text-[11.5px] text-warning-700">
      임시저장한 값이에요 · 현재 KPI 값 {current || '(비어 있음)'}
    </p>
  );
}

/**
 * 부서장 판정 배지 — 조정 필요(주황)/수락(녹색), 색은 1차 검토·재조정 검토와 통일. 미판정은 표시 없음.
 * `MidtermReadOnlyView`(내 중간 점검 읽기 전용 보기)도 같은 배지를 쓴다 — export.
 */
export function ReviewerDecisionBadge({ decision }: { decision: string | null | undefined }) {
  if (decision === 'rebaseline') {
    return (
      <span className="shrink-0 rounded-sm bg-warning-100 px-2 py-0.5 text-[11.5px] font-semibold text-warning-700">
        조정 필요
      </span>
    );
  }
  if (decision === 'accepted') {
    return (
      <span className="shrink-0 rounded-sm bg-success-50 px-2 py-0.5 text-[11.5px] font-semibold text-success-600">
        수락
      </span>
    );
  }
  return null;
}

/** 목록 번호 배지 — KPI 검토·1차 검토 표형 행과 같은 스타일(No.). `MidtermReadOnlyView`도 재사용 — export. */
export function KpiIndexBadge({ index }: { index: number }) {
  return (
    <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-sm bg-muted text-[12px] font-bold tabular-nums text-muted-foreground">
      {String(index).padStart(2, '0')}
    </span>
  );
}

/**
 * 임직원 수정 화면 — 1차 코멘트를 보고 KPI 목표를 조정해 제출.
 * 가중치는 편집하지 않는다(2026-07-24 — 사용자 결정: 중간점검은 목표만 조정). 변경 0건이어도
 * 회신 사유를 적으면 제출할 수 있다("코멘트를 읽었고 조정할 필요가 없었다"도 정당한 결과).
 *
 * 입력은 [임시저장]으로 서버에 보관할 수 있다(설계 §6). 자동 저장은 하지 않는다 —
 * 이 화면은 본인의 목표를 다시 협의하는 자리라 "내가 저장했다"는 시점이 분명해야 하고,
 * 다른 폼들과 마찬가지로 미저장 경고와 저장 시점이 어긋나지 않아야 한다.
 */
export function MemberRevisionPanel({
  reviewId,
  cycleId,
  userId,
  onDone,
}: {
  reviewId: string;
  cycleId: string;
  userId: string;
  onDone: () => void;
}) {
  const detail = useMidtermDetail(reviewId);
  // cycleId·userId 가 아직 없으면 조회하지 않음(불필요한 undefined 요청 방지).
  const progress = useMidtermProgress(
    { cycleId, userId },
    { enabled: Boolean(cycleId && userId) },
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 마지막 임시저장 시각(서버가 돌려준 값)과 그 시점의 내용 키 — 미저장 여부 판정 기준.
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  // 임시저장본에서 복원됐고 현재 KPI 값과 다른 입력칸 — 그 사이 목표가 조정됐을 수 있어
  // "옛 숫자를 그대로 다시 제출"하지 않도록 화면에 현재 값을 함께 보여 준다.
  const [restored, setRestored] = useState<Set<RestoredFieldKey>>(new Set());
  // 화면에 표시할 수 없어 그대로 보관 중인 임시저장 항목(확정이 풀린 KPI 등).
  // 다음 임시저장에 다시 실어 보내야 본인이 적어 둔 값이 조용히 사라지지 않는다.
  const [held, setHeld] = useState<MidtermRevisionItem[]>([]);

  // 진척 조회 상태 — 실패·로딩을 빈 목록으로 렌더하면 "수정할 게 없다"로 읽히고,
  // changedItems 가 []가 되어 회신 사유만으로 "변경 0건" 제출이 그대로 성립한다.
  const progressLoading = progress.loading && !progress.data;
  const progressFailed = Boolean(progress.error);
  const progressReady = Boolean(progress.data) && !progressFailed;
  // 임시저장본은 상세(detail)에 실려 온다. 아직 도착하지 않았는데 폼을 먼저 채우면
  // 사용자가 입력을 시작한 뒤에 복원이 들이닥쳐 방금 친 값을 덮어쓴다 → 둘 다 기다린다.
  const detailLoading = detail.loading && !detail.data;
  // 상세 조회가 실패해 데이터가 아예 없으면 폼을 열지 않는다. 열어 두면 임시저장본 없이
  // 씨앗이 심긴 폼이 그대로 [임시저장]으로 서버에 덮어써져, 이 기능이 지키려던 저장본이
  // 사라진다. 다시 시도로 복구할 길만 열어 둔다.
  const detailFailed = Boolean(detail.error) && !detail.data;
  const formReady = progressReady && !detailLoading && !detailFailed;

  const allKpis = useMemo(() => progress.data?.kpis ?? [], [progress.data]);
  // 백엔드(KpiRevisionService)는 confirmed KPI 만 수정 대상으로 받는다. 화면이 draft/submitted
  // 까지 편집 대상에 포함하면 미확정 행을 편집하는 요청이 400 이 난다.
  // → 편집은 confirmed 만, 나머지는 읽기 전용으로 보여 준다(사라지면 더 혼란스럽다).
  const kpis = useMemo(() => allKpis.filter((k) => k.status === 'confirmed'), [allKpis]);
  const lockedKpis = useMemo(() => allKpis.filter((k) => k.status !== 'confirmed'), [allKpis]);

  const savedDraft = detail.data?.revisionDraft ?? null;
  // KPI별 "이전에 제출한 조정 코멘트"(kpiCheckIns[].memberNote) — comment 필드의 baseline.
  // targetText/targetValue/weight 는 KPI 자체 값과 비교하지만 comment 는 KPI에 저장된 값이
  // 없어(조정 기록일 뿐) 이 맵이 baselineDraft·computeChangedItems·seedForm 의 기준값이 된다.
  // (아래 두 useEffect·changedItems 메모가 참조하므로 그것들보다 앞서 선언한다.)
  const memberNotesByKpi = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const c of detail.data?.kpiCheckIns ?? []) {
      map[c.kpiId] = c.memberNote;
    }
    return map;
  }, [detail.data]);
  // 폼을 채우는 것은 리뷰 1건당 한 번뿐 — 이후의 재조회가 입력 중인 값을 되돌리지 않게 한다.
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (!formReady || seededRef.current === reviewId) return;
    // 저장본이 없는 리뷰로 바뀌었을 때도 note·savedAt·savedKey·복원 표시를 모두 초기화한다 —
    // 조건부로 두면 (리마운트 없이 reviewId 만 바뀔 때) 앞 리뷰의 값이 그대로 남는다.
    const seeded = seedForm(kpis, savedDraft, memberNotesByKpi);
    setDrafts(seeded.drafts);
    setNote(seeded.note);
    setSavedAt(seeded.savedAt);
    setSavedKey(seeded.savedKey);
    setRestored(seeded.restored);
    setHeld(seeded.held);
    seededRef.current = reviewId;
  }, [formReady, kpis, savedDraft, reviewId, memberNotesByKpi]);

  // 진척을 다시 불러와 확정 KPI 가 늘어난 경우(예: 오류 후 재시도, 그 사이 KPI 재확정),
  // 폼에 없는 항목만 채운다 — 비워 두면 입력칸이 빈 채로 보인다.
  // 보관 중인 값(held)이 있으면 기본값 대신 그 값으로 되살린다 — 확정이 풀렸다 다시 붙은
  // KPI 라면 본인이 적어 둔 수정안이 그대로 돌아와야 한다.
  // 이미 있는 항목은 손대지 않아 작성 중인 값을 그대로 지킨다.
  useEffect(() => {
    if (!formReady) return;
    const heldById = new Map(held.map((h) => [h.kpiId, h]));
    setDrafts((prev) => {
      let added = false;
      const next = { ...prev };
      for (const k of kpis) {
        if (next[k.kpiId]) continue;
        const base = baselineDraft(k, memberNotesByKpi[k.kpiId] ?? null);
        const h = heldById.get(k.kpiId);
        next[k.kpiId] = h ? applyItemToDraft(base, h) : base;
        added = true;
      }
      return added ? next : prev;
    });
  }, [formReady, kpis, held, memberNotesByKpi]);

  // 편집 가능한(확정) KPI 목록에 다시 들어온 항목은 폼이 권위를 갖는다 → 보관분에서 뺀다.
  // 빼지 않으면 같은 kpiId 가 저장 페이로드에 두 번 실려 서버가 "같은 KPI가 중복" 으로 거절한다.
  const editableIds = useMemo(() => new Set(kpis.map((k) => k.kpiId)), [kpis]);
  const heldItems = useMemo(
    () => held.filter((h) => !editableIds.has(h.kpiId)),
    [held, editableIds],
  );

  const commentByKpi = useMemo(() => {
    const map: Record<string, { note: string | null; decision: string | null }> = {};
    for (const c of detail.data?.kpiCheckIns ?? []) {
      map[c.kpiId] = { note: c.reviewerNote, decision: c.reviewerDecision };
    }
    return map;
  }, [detail.data]);

  // 부서장이 '조정 필요'로 판정한 확정 KPI 수 — 편집칸을 여기에만 연다(그 외엔 읽기 전용).
  // 0건이면 회신 사유만으로 "검토했고 조정 불필요"를 제출할 수 있다(기존 변경 0건 제출 경로).
  const rebaselineCount = useMemo(
    () => kpis.filter((k) => commentByKpi[k.kpiId]?.decision === 'rebaseline').length,
    [kpis, commentByKpi],
  );

  // 실제 변경분(제출 페이로드와 동일한 단일 소스) — 미저장 가드·제출이 모두 이 값을 본다.
  // 복원 직후의 저장 키(seedForm)도 같은 함수로 계산해 두 값이 어긋나지 않게 한다.
  const changedItems = useMemo<MidtermRevisionItem[]>(
    () => computeChangedItems(kpis, drafts, memberNotesByKpi),
    [kpis, drafts, memberNotesByKpi],
  );

  // 저장 페이로드 = 화면의 변경분 + 표시할 수 없어 보관 중인 항목.
  // 보관분을 빼고 저장하면, 확정이 풀린 KPI 에 적어 둔 값이 아무 안내 없이 서버에서 사라진다.
  const draftPayloadItems = useMemo(
    () => [...changedItems, ...heldItems],
    [changedItems, heldItems],
  );
  // 지금 화면의 내용 키. 임시저장 시점의 키와 같으면 "저장할 것이 없다".
  const currentKey = useMemo(
    () => snapshotKey(draftPayloadItems, note.trim()),
    [draftPayloadItems, note],
  );
  const hasPendingWork = changedItems.length > 0 || note.trim().length > 0;
  // 잃을 게 있을 때만 이탈 경고를 건다. 임시저장에 성공하면 저장본과 내용이 같아지므로
  // 다시 입력하기 전까지는 경고하지 않는다.
  // 저장본이 이미 있다면 "되돌린 것"도 아직 반영되지 않은 변경이다 — 그대로 나가면
  // 서버에는 옛 초안이 남아 다음에 그게 복원된다.
  const hasUnsavedChanges = currentKey !== savedKey && (hasPendingWork || savedKey !== null);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  /**
   * 임시저장 — 제출이 아니다. 상태·KPI 는 그대로 두고 지금 화면의 내용만 서버에 보관한다.
   * 제출과 달리 변경 0건 검사를 하지 않는다(작성 도중의 값도 보관해야 한다).
   */
  async function saveDraft() {
    if (!formReady) {
      setError('KPI 진척을 불러온 뒤에 임시저장할 수 있어요.');
      return;
    }
    // 요청을 보낸 시점의 내용으로 저장 상태를 표시한다 — 저장이 오가는 동안 더 입력했다면
    // 그건 아직 저장되지 않은 것이 맞다.
    const keyAtRequest = currentKey;
    setSavingDraft(true);
    setError(null);
    try {
      const saved = await saveMidtermRevisionDraft(reviewId, {
        items: draftPayloadItems,
        memberNote: note.trim() || undefined,
      });
      setSavedKey(keyAtRequest);
      setSavedAt(saved.revisionDraft?.savedAt ?? new Date().toISOString());
    } catch (err) {
      // 실패해도 입력은 그대로 둔다(유실 방지) — 저장 표시만 갱신하지 않는다.
      setError(err instanceof Error ? err.message : '임시저장하지 못했어요.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit() {
    // 진척뿐 아니라 상세(임시저장본)까지 읽힌 뒤에만 제출한다 — 저장본을 못 읽은 채 제출하면
    // 화면에 없는 저장분이 반영되지 않은 상태로 서버에서 초안이 지워진다.
    if (!formReady) {
      setError('KPI 진척과 임시저장한 내용을 불러온 뒤에 제출할 수 있어요.');
      return;
    }
    if (!changedItems.length && !note.trim()) {
      setError('수정하거나 조정 코멘트를 남긴 내용이 없다면 아래 확인 코멘트를 적어 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // submitMidtermRevision 은 MidtermDetail | null 을 반환(orval 의 200|201(void) 유니언 때문에
      // 실제 페이로드가 없을 수 있음) — null 은 실패가 아니라 "제출은 됐지만 응답 바디가 없음".
      // 반환값을 쓰지 않고 성공 여부만으로 onDone 을 호출해 거짓 실패를 표면화하지 않는다.
      await submitMidtermRevision(reviewId, { items: changedItems, memberNote: note.trim() || undefined });
      // 제출되면 서버가 임시저장본을 비운다. 화면에도 "미저장 없음"으로 맞춰 두어야
      // 이 컴포넌트가 떠 있는 동안 이탈 경고가 잘못 뜨지 않는다.
      setSavedKey(currentKey);
      setSavedAt(null);
      onDone();
    } catch (err) {
      // 실패 시 drafts·note 는 그대로 둔다(입력 유실 방지) — catch 안에서 상태를 되돌리지 않음.
      setError(err instanceof Error ? err.message : '제출하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {detail.data?.firstComment && (
        <Card>
          <h4 className="text-sm font-semibold text-foreground">부서장 총평</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {detail.data.firstComment}
          </p>
        </Card>
      )}

      {/* 임시저장본을 못 읽었는데 조용히 빈 폼을 주면, 저장해 둔 내용이 없어진 것으로 보인다.
          게다가 그 상태로 [임시저장]을 누르면 서버의 저장본이 빈 내용으로 덮어써진다 →
          폼 자체를 열지 않고(formReady=false) 다시 시도만 안내한다. */}
      {detailFailed && (
        <Card>
          <p className="text-sm text-warning-700">
            임시저장한 내용을 불러오지 못했어요. 지금 저장하면 서버에 저장해 둔 내용이 지워질 수
            있어서, 불러오기에 성공할 때까지 작성·임시저장·제출을 잠시 막아 뒀어요.
          </p>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={detail.reload} disabled={detail.loading}>
              {detail.loading ? '다시 불러오는 중…' : '다시 시도'}
            </Button>
          </div>
        </Card>
      )}
      {/* 저장해 둔 KPI 의 확정이 그 뒤 풀리면 화면에 입력칸을 만들 수 없다. 조용히 버리면
          본인이 적어 둔 값이 사라진 줄도 모르므로, 보관 중이라는 사실과 조건을 알린다. */}
      {formReady && heldItems.length > 0 && (
        <Card>
          <p className="text-sm text-foreground">
            임시저장한 수정안 중{' '}
            <span className="font-semibold tabular-nums">{heldItems.length}</span>건은 KPI 확정이
            풀려 지금은 화면에 표시할 수 없어요. 값은 지우지 않고 그대로 보관하고 있어서, 해당
            KPI가 다시 확정되면 이 화면에 되살아나요.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            다만 지금 [수정 제출]을 하면 보관 중인 값은 반영되지 않고 임시저장본과 함께 정리돼요.
            먼저 KPI 검토에서 확정을 받은 뒤 제출해 주세요.
          </p>
        </Card>
      )}
      {/* 상세는 읽혔지만 저장본이 옛 기준값 위에서 쓰였을 수 있다. */}
      {formReady && restored.size > 0 && (
        <Card>
          <p className="text-sm text-foreground">
            임시저장한 수정안을 불러왔어요. 저장한 뒤에 목표가 조정됐을 수 있어서, 지금 KPI에
            저장된 값과 다른 칸에는 현재 값을 함께 표시했어요. 확인하고 제출해 주세요.
          </p>
        </Card>
      )}

      {(progressLoading || detailLoading) && <Skeleton className="h-40 w-full" />}
      {progressFailed && (
        <ErrorState
          message="내 KPI 진척을 불러오지 못했어요. 다시 시도해 주세요."
          onRetry={progress.reload}
        />
      )}
      {formReady && allKpis.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">이번 주기에 등록된 KPI가 없어요.</p>
        </Card>
      )}

      {/* 최종평가 연결 안내 — 여기서 저장·제출하는 목표·가중치는 실제 KPI(KpiRevisionService.apply)
          에 반영되어 최종평가에 그대로 쓰인다. "임시로 적어 보는 칸"이 아님을 분명히 한다. */}
      {formReady && kpis.length > 0 && (
        <InfoBanner tone="info">
          저장하면 이 목표가 KPI에 반영되어 최종평가에 사용돼요.
        </InfoBanner>
      )}

      {/* 조정 필요 항목이 없으면 편집칸 없이 전부 읽기 전용 — 회신 사유만 적고 제출(기존 "변경
          0건 + 회신 사유" 제출 경로 그대로). */}
      {formReady && kpis.length > 0 && rebaselineCount === 0 && (
        <p className="rounded-md border border-border bg-muted px-3 py-2.5 text-[12.5px] text-muted-foreground">
          부서장이 조정을 요청한 KPI가 없어요 — 검토했다면 아래 확인 코멘트만 남기고 제출할 수 있어요.
        </p>
      )}

      {/* KPI 목록 — 부서장이 '조정 필요'로 판정한 것만 편집 카드로(전→후 한눈에 비교 + 조정
          코멘트). '수락'·미판정 KPI 는 입력칸 없이 지금 값 + 부서장 코멘트만 보여준다(사용자
          피드백: 조정 필요 없는 KPI 까지 입력칸을 열어 둘 필요가 없다). 목표값 입력은 전 KPI가
          서술형(qualitative)이라 measureType 기준으로 사실상 항상 숨김 — 목표(서술)만 편집.
          가중치는 편집칸을 두지 않는다(2026-07-24 — 사용자 결정: 중간점검은 목표만 조정, 읽기
          전용/미확정 카드에는 정보로만 표시). ⚠ drafts 상태는 두 경우 모두 baseline 으로
          시드돼 있어(seedForm) — 읽기 전용 KPI 는 화면에서 손댈 수 없으니 그대로 baseline 을
          유지, computeChangedItems 에 잡히지 않는다(가중치도 편집 UI 가 없어 항상 baseline 유지
          → 변경분에서 자연히 제외). held/restored/saveDraft/submit 로직은 불변. */}
      {formReady &&
        kpis.map((k, i) => {
        const c = commentByKpi[k.kpiId];
        const decision = c?.decision ?? null;
        const needsAdjust = decision === 'rebaseline';
        const showTargetValue = k.measureType !== 'qualitative';
        // 지금 KPI에 저장돼 있는 값(= 아무것도 바꾸지 않았을 때의 폼 값) — 복원 안내·읽기 전용 표시에 쓴다.
        const base = baselineDraft(k, memberNotesByKpi[k.kpiId] ?? null);

        if (!needsAdjust) {
          // 읽기 전용 — 입력칸 없이 지금 목표·가중치 + 부서장 코멘트만.
          return (
            <div key={k.kpiId} className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-1">
              <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
                <KpiIndexBadge index={i + 1} />
                <h4 className="min-w-0 flex-1 break-keep text-[13.5px] font-bold leading-snug text-foreground">
                  {k.title}
                </h4>
                <ReviewerDecisionBadge decision={decision} />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground">
                <span>
                  목표{' '}
                  <b className="font-semibold text-foreground">
                    {base.targetText || (showTargetValue ? base.targetValue || '—' : '—')}
                  </b>
                </span>
                {showTargetValue && (
                  <span>
                    목표값 <b className="font-semibold tabular-nums text-foreground">{base.targetValue || '—'}</b>
                  </span>
                )}
                <span>
                  가중치 <b className="font-semibold tabular-nums text-foreground">{base.weight}%</b>
                </span>
              </div>
              {c?.note && (
                <p className="border-t border-border/60 bg-muted/30 px-4 py-2.5 text-[12.5px] text-foreground/90">
                  <span className="mr-1.5 font-semibold text-muted-foreground">부서장</span>
                  {c.note}
                </p>
              )}
            </div>
          );
        }

        // 조정 필요 — ①부서장 코멘트(왜) → ②현재 목표(전) → ③새 목표(후) → ④조정 코멘트
        // (무엇을·왜 조정했는지) 순서로 명료하게. 전→후는 좌우로 나란히. 가중치는 중간점검
        // 대상이 아니라(사용자 결정 — 목표만 조정) 입력칸을 두지 않는다.
        return (
          <div
            key={k.kpiId}
            className="overflow-hidden rounded-lg border border-l-2 border-border border-l-warning-500 bg-card shadow-elev-1"
          >
            <div className="flex flex-wrap items-center gap-2.5 px-4 pt-3.5 pb-2.5">
              <KpiIndexBadge index={i + 1} />
              <h4 className="min-w-0 flex-1 break-keep text-[13.5px] font-bold leading-snug text-foreground">
                {k.title}
              </h4>
              <ReviewerDecisionBadge decision={decision} />
            </div>
            {/* ① 부서장 코멘트 — 왜 조정이 필요한지 */}
            {c?.note && (
              <p className="border-b border-border/60 bg-warning-50/60 px-4 py-2.5 text-[12.5px] text-foreground">
                <span className="mr-1.5 font-semibold text-warning-700">부서장</span>
                {c.note}
              </p>
            )}

            {/* ②③ 현재 목표(전) → 새 목표(후) — 좌우 비교 */}
            <div className="grid gap-0 border-b border-border/60 md:grid-cols-2 md:divide-x md:divide-border/60">
              <div className="px-4 py-3">
                <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">현재 목표</p>
                <p className="break-keep text-[13px] text-foreground">{base.targetText || '—'}</p>
              </div>
              <div className="border-t border-border/60 px-4 py-3 md:border-t-0">
                <p className="mb-2 text-[11.5px] font-semibold text-primary">새 목표</p>
                <input
                  value={drafts[k.kpiId]?.targetText ?? ''}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], targetText: e.target.value } }))
                  }
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground"
                />
                {restored.has(restoredKey(k.kpiId, 'targetText')) && (
                  <RestoredHint current={base.targetText} />
                )}
                {showTargetValue && (
                  <>
                    <p className="mb-1 mt-3 text-[11.5px] font-semibold text-muted-foreground">목표값</p>
                    <input
                      type="number"
                      value={drafts[k.kpiId]?.targetValue ?? ''}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], targetValue: e.target.value } }))
                      }
                      className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground tabular-nums"
                    />
                    {restored.has(restoredKey(k.kpiId, 'targetValue')) && (
                      <RestoredHint current={base.targetValue} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ④ 조정 코멘트 — 이 KPI를 어떻게·왜 조정했는지(제출 시 item.comment 로 전송) */}
            <div className="bg-muted/30 px-4 py-3">
              <label className="block text-[12.5px]">
                <span className="mb-1 block font-semibold text-muted-foreground">
                  조정 코멘트 — 무엇을·왜 조정했는지
                </span>
                <textarea
                  value={drafts[k.kpiId]?.comment ?? ''}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], comment: e.target.value } }))
                  }
                  placeholder="예: 상반기 수주 지연을 반영해 목표를 낮췄어요."
                  className="w-full rounded-md border border-border bg-card p-2 text-[13px] text-foreground"
                  rows={2}
                />
                {restored.has(restoredKey(k.kpiId, 'comment')) && (
                  <RestoredHint current={base.comment} />
                )}
              </label>
            </div>
          </div>
        );
        })}

      {formReady &&
        lockedKpis.map((k) => {
          // 1차 평가자는 확정 여부와 무관하게 모든 KPI에 코멘트·판정을 남길 수 있다
          // (FirstReviewPanel 과 동일한 범위). 그 판단을 여기서 감추면 알림의
          // "조정 검토 요청 KPI N건"과 화면에 보이는 건수가 어긋나고, 부서장이 적어 준
          // 코멘트가 대상자에게 영영 전달되지 않는다 → 수정만 막고 내용은 그대로 보여 준다.
          const c = commentByKpi[k.kpiId];
          const needsAdjust = c?.decision === 'rebaseline';
          return (
            <Card key={k.kpiId}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{k.title}</h4>
                <div className="flex items-center gap-1.5">
                  {needsAdjust && (
                    <span className="rounded-sm bg-warning-100 px-2 py-0.5 text-[11.5px] font-semibold text-warning-700">
                      조정 필요
                    </span>
                  )}
                  <span className="rounded-sm bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                    미확정
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                목표: {k.targetText ?? k.targetValue ?? '-'} · 가중치 {k.weight}%
              </p>
              {c?.note && <p className="mt-1 text-sm text-muted-foreground">부서장: {c.note}</p>}
              {/* 확정 전 KPI는 중간점검 수정 대상이 아니다(백엔드도 거절) — 가중치 합계에도
                  넣지 않는다. 숨기지 않고 읽기 전용으로 두어 "왜 안 보이지"를 없앤다. */}
              <p className="mt-2 text-[12px] text-muted-foreground">
                아직 확정되지 않은 KPI라 중간점검에서는 수정하거나 가중치 합계에 넣을 수 없어요.
                {needsAdjust || c?.note
                  ? ' 부서장 의견은 KPI 검토에서 목표를 고쳐 다시 결재를 받아 반영해 주세요.'
                  : ' KPI 검토에서 확정된 뒤에 반영돼요.'}
              </p>
            </Card>
          );
        })}

      {/* 전체 note — KPI별 조정 코멘트가 주된 통로가 된 뒤로는 보조 역할.
          조정 필요 KPI가 없을 때(모두 수락)만 "검토 확인" 코멘트로 의미가 커진다. */}
      <Card padding="sm">
        <h4 className="text-[13px] font-semibold text-foreground">
          {rebaselineCount > 0 ? '종합 코멘트 (선택)' : '검토 확인 코멘트'}
        </h4>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {rebaselineCount > 0
            ? '위 KPI별 조정 코멘트가 우선이에요. 전체적으로 덧붙일 말이 있으면 적어 주세요.'
            : '조정을 요청받은 KPI가 없어요. 검토했다는 확인이나 종합 의견을 적어 주세요.'}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            rebaselineCount > 0
              ? '전체적으로 덧붙일 말이 있으면 적어 주세요. (선택)'
              : '검토했고 조정이 필요 없다고 판단한 이유를 적어 주세요.'
          }
          className="mt-2 w-full rounded-md border border-border bg-card p-2 text-sm text-foreground"
          rows={rebaselineCount > 0 ? 2 : 3}
        />
      </Card>

      {detail.data && <MidtermTrailTimeline entries={detail.data.trail} />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <EvaluationActionPanel
        sticky
        message={
          formReady
            ? '임시저장해 두면 나중에 이어서 작성할 수 있어요. 제출하면 그룹대표의 최종 검토로 넘어가요.'
            : detailFailed
              ? '임시저장한 내용을 불러오지 못했어요. 위 [다시 시도]로 불러온 뒤에 작성할 수 있어요.'
              : 'KPI 진척을 불러온 뒤에 작성할 수 있어요.'
        }
        summary={
          <p className="text-[12.5px] text-muted-foreground">
            {hasUnsavedChanges
              ? '저장하지 않은 변경이 있어요.'
              : savedAt
                ? '변경사항이 모두 임시저장됐어요.'
                : '아직 임시저장한 내용이 없어요.'}
            {savedAt && (
              <span className="ml-1 tabular-nums">
                (마지막 임시저장 {new Date(savedAt).toLocaleString('ko-KR')})
              </span>
            )}
          </p>
        }
        actions={
          <>
            {/* 임시저장은 제출이 아니라 개인 작업본 보관 — 작성 중(미완성)이어도 저장된다. */}
            <Button
              variant="secondary"
              onClick={saveDraft}
              disabled={savingDraft || saving || !formReady}
            >
              {savingDraft ? '임시저장 중…' : '임시저장'}
            </Button>
            {/* 진척·상세가 로딩 중/실패면 제출을 막는다 — 그 상태에서는 changedItems 가 항상 []라
                회신 사유만으로 "변경 0건" 제출이 성립하고, 본인은 그걸 정상 제출로 오해한다. */}
            <Button onClick={submit} disabled={saving || savingDraft || !formReady}>
              {saving ? '제출 중…' : '수정 제출'}
            </Button>
          </>
        }
      />
    </div>
  );
}
