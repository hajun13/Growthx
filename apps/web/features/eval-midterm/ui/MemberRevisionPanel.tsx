'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorState, Skeleton } from '@/components/States';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { useMidtermDetail, useMidtermProgress } from '../hooks';
import { saveMidtermRevisionDraft, submitMidtermRevision } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import {
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
 * 임직원 수정 화면 — 1차 코멘트를 보고 KPI 목표·가중치를 조정해 제출.
 * 변경 0건이어도 회신 사유를 적으면 제출할 수 있다("코멘트를 읽었고 조정할 필요가 없었다"도
 * 정당한 결과).
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
  // 백엔드(KpiRevisionService)는 confirmed KPI 만 수정 대상으로 받고, 가중치 100% 검증도
  // confirmed 만 합산한다. 화면이 draft/submitted 까지 포함해 합산하면 대부분의 사용자가
  // 합계 ≠ 100 으로 막히고(현 주기: 확정 26 vs 제출 719), 미확정 행을 편집하면 400 이 난다.
  // → 편집·합계는 confirmed 만, 나머지는 읽기 전용으로 보여 준다(사라지면 더 혼란스럽다).
  const kpis = useMemo(() => allKpis.filter((k) => k.status === 'confirmed'), [allKpis]);
  const lockedKpis = useMemo(() => allKpis.filter((k) => k.status !== 'confirmed'), [allKpis]);

  const savedDraft = detail.data?.revisionDraft ?? null;
  // 폼을 채우는 것은 리뷰 1건당 한 번뿐 — 이후의 재조회가 입력 중인 값을 되돌리지 않게 한다.
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (!formReady || seededRef.current === reviewId) return;
    // 저장본이 없는 리뷰로 바뀌었을 때도 note·savedAt·savedKey·복원 표시를 모두 초기화한다 —
    // 조건부로 두면 (리마운트 없이 reviewId 만 바뀔 때) 앞 리뷰의 값이 그대로 남는다.
    const seeded = seedForm(kpis, savedDraft);
    setDrafts(seeded.drafts);
    setNote(seeded.note);
    setSavedAt(seeded.savedAt);
    setSavedKey(seeded.savedKey);
    setRestored(seeded.restored);
    seededRef.current = reviewId;
  }, [formReady, kpis, savedDraft, reviewId]);

  // 진척을 다시 불러와 확정 KPI 가 늘어난 경우(예: 오류 후 재시도, 그 사이 KPI 확정),
  // 폼에 없는 항목만 기본값으로 채운다 — 비워 두면 입력칸이 빈 채로 보이고 가중치 합계에서도
  // 빠진다. 이미 있는 항목은 손대지 않아 작성 중인 값을 그대로 지킨다.
  useEffect(() => {
    if (!formReady) return;
    setDrafts((prev) => {
      let added = false;
      const next = { ...prev };
      for (const k of kpis) {
        if (next[k.kpiId]) continue;
        next[k.kpiId] = baselineDraft(k);
        added = true;
      }
      return added ? next : prev;
    });
  }, [formReady, kpis]);

  const commentByKpi = useMemo(() => {
    const map: Record<string, { note: string | null; decision: string | null }> = {};
    for (const c of detail.data?.kpiCheckIns ?? []) {
      map[c.kpiId] = { note: c.reviewerNote, decision: c.reviewerDecision };
    }
    return map;
  }, [detail.data]);

  // 실제 변경분(제출 페이로드와 동일한 단일 소스) — 미저장 가드·가중치 게이트·제출이 모두 이 값을 본다.
  // 복원 직후의 저장 키(seedForm)도 같은 함수로 계산해 두 값이 어긋나지 않게 한다.
  const changedItems = useMemo<MidtermRevisionItem[]>(
    () => computeChangedItems(kpis, drafts),
    [kpis, drafts],
  );

  // 가중치를 실제로 건드린 항목이 있을 때만 100% 규칙을 적용(건드리지 않았으면 경고로 읽히지 않게).
  const weightTouched = changedItems.some((i) => i.weight !== undefined);
  // 합계는 confirmed KPI 만 — 백엔드 검증 범위와 동일하게 맞춘다.
  const weightSum = kpis.reduce(
    (a, k) => a + (Number(drafts[k.kpiId]?.weight) || 0),
    0,
  );
  const weightOk = Math.round(weightSum) === 100;
  const weightBlocking = weightTouched && !weightOk;
  // 표시용 가중치 합계 — 소수 오차 회피(예: 99.89999999999999% → 99.90%).
  const displayWeightSum = Math.round(weightSum * 100) / 100;

  // 지금 화면의 내용 키. 임시저장 시점의 키와 같으면 "저장할 것이 없다".
  const currentKey = useMemo(() => snapshotKey(changedItems, note.trim()), [changedItems, note]);
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
   * 제출과 달리 가중치 100%·변경 0건 검사를 하지 않는다(작성 도중의 값도 보관해야 한다).
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
        items: changedItems,
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
      setError('수정할 내용이 없다면 회신 사유를 적어 주세요.');
      return;
    }
    if (weightBlocking) {
      setError(`가중치 합계가 100%가 되어야 해요. 현재 ${displayWeightSum}%예요.`);
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
      {/* 상세는 읽혔지만 저장본이 옛 기준값 위에서 쓰였을 수 있다. */}
      {formReady && restored.size > 0 && (
        <Card>
          <p className="text-sm text-foreground">
            임시저장한 수정안을 불러왔어요. 저장한 뒤에 목표·가중치가 조정됐을 수 있어서, 지금
            KPI에 저장된 값과 다른 칸에는 현재 값을 함께 표시했어요. 확인하고 제출해 주세요.
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

      {formReady &&
        kpis.map((k) => {
        const c = commentByKpi[k.kpiId];
        const needsAdjust = c?.decision === 'rebaseline';
        // 지금 KPI에 저장돼 있는 값(= 아무것도 바꾸지 않았을 때의 폼 값) — 복원 안내에 쓴다.
        const base = baselineDraft(k);
        return (
          <Card key={k.kpiId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">{k.title}</h4>
              {needsAdjust && (
                <span className="rounded-sm bg-warning-100 px-2 py-0.5 text-[11.5px] font-semibold text-warning-700">
                  조정 필요
                </span>
              )}
            </div>
            {c?.note && <p className="mt-1 text-sm text-muted-foreground">부서장: {c.note}</p>}
            {/* 정성 KPI는 목표(서술)와 가중치 2열, 정량은 목표·목표값·가중치 3열 */}
            <div className={`mt-3 grid gap-3 ${k.isQualitative ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">목표</span>
                <input
                  value={drafts[k.kpiId]?.targetText ?? ''}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], targetText: e.target.value } }))
                  }
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
                />
                {restored.has(restoredKey(k.kpiId, 'targetText')) && (
                  <RestoredHint current={base.targetText} />
                )}
              </label>
              {!k.isQualitative && (
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">목표값</span>
                  <input
                    type="number"
                    value={drafts[k.kpiId]?.targetValue ?? ''}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], targetValue: e.target.value } }))
                    }
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-foreground tabular-nums"
                  />
                  {restored.has(restoredKey(k.kpiId, 'targetValue')) && (
                    <RestoredHint current={base.targetValue} />
                  )}
                </label>
              )}
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">가중치(%)</span>
                <input
                  type="number"
                  value={drafts[k.kpiId]?.weight ?? ''}
                  onChange={(e) =>
                    setDrafts((p) => ({ ...p, [k.kpiId]: { ...p[k.kpiId], weight: e.target.value } }))
                  }
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-foreground tabular-nums"
                />
                {restored.has(restoredKey(k.kpiId, 'weight')) && (
                  <RestoredHint current={`${base.weight}%`} />
                )}
              </label>
            </div>
          </Card>
          );
        })}

      {formReady &&
        lockedKpis.map((k) => (
          <Card key={k.kpiId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">{k.title}</h4>
              <span className="rounded-sm bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                미확정
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              목표: {k.targetText ?? k.targetValue ?? '-'} · 가중치 {k.weight}%
            </p>
            {/* 확정 전 KPI는 중간점검 수정 대상이 아니다(백엔드도 거절) — 가중치 합계에도
                넣지 않는다. 숨기지 않고 읽기 전용으로 두어 "왜 안 보이지"를 없앤다. */}
            <p className="mt-2 text-[12px] text-muted-foreground">
              아직 확정되지 않은 KPI라 중간점검에서는 수정하거나 가중치 합계에 넣을 수 없어요.
              KPI 검토에서 확정된 뒤에 반영돼요.
            </p>
          </Card>
        ))}

      <Card>
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-foreground">가중치 합계 (확정 KPI 기준)</h4>
          <span
            className={`text-sm tabular-nums ${
              !weightTouched
                ? 'text-muted-foreground'
                : weightOk
                  ? 'text-success-600'
                  : 'text-destructive'
            }`}
          >
            {displayWeightSum}%
          </span>
        </div>
        {weightBlocking && (
          <p className="mt-1 text-[12px] text-destructive">
            가중치를 변경했다면 합계가 100%가 되어야 제출할 수 있어요.
          </p>
        )}
      </Card>

      <Card>
        <h4 className="mb-2 text-sm font-semibold text-foreground">회신 사유</h4>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="목표를 조정한 이유, 또는 조정이 필요 없다고 판단한 이유를 적어 주세요."
          className="w-full rounded-md border border-border bg-card p-2 text-sm text-foreground"
          rows={3}
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
            {/* 임시저장은 제출이 아니라 개인 작업본 보관 — 가중치 합계가 어긋나 있어도 저장된다. */}
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
