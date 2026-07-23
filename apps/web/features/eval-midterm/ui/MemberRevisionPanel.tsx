'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ErrorState, Skeleton } from '@/components/States';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { useMidtermDetail, useMidtermProgress } from '../hooks';
import { submitMidtermRevision } from '../api';
import { MidtermTrailTimeline } from './MidtermTrailTimeline';
import type { MidtermRevisionItem } from '@/lib/types';

interface Draft {
  targetText: string;
  targetValue: string;
  weight: string;
}

/**
 * 임직원 수정 화면 — 1차 코멘트를 보고 KPI 목표·가중치를 조정해 제출.
 * 변경 0건이어도 회신 사유를 적으면 제출할 수 있다("코멘트를 읽었고 조정할 필요가 없었다"도
 * 정당한 결과).
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
  const [error, setError] = useState<string | null>(null);

  // 진척 조회 상태 — 실패·로딩을 빈 목록으로 렌더하면 "수정할 게 없다"로 읽히고,
  // changedItems 가 []가 되어 회신 사유만으로 "변경 0건" 제출이 그대로 성립한다.
  const progressLoading = progress.loading && !progress.data;
  const progressFailed = Boolean(progress.error);
  const progressReady = Boolean(progress.data) && !progressFailed;

  const allKpis = useMemo(() => progress.data?.kpis ?? [], [progress.data]);
  // 백엔드(KpiRevisionService)는 confirmed KPI 만 수정 대상으로 받고, 가중치 100% 검증도
  // confirmed 만 합산한다. 화면이 draft/submitted 까지 포함해 합산하면 대부분의 사용자가
  // 합계 ≠ 100 으로 막히고(현 주기: 확정 26 vs 제출 719), 미확정 행을 편집하면 400 이 난다.
  // → 편집·합계는 confirmed 만, 나머지는 읽기 전용으로 보여 준다(사라지면 더 혼란스럽다).
  const kpis = useMemo(() => allKpis.filter((k) => k.status === 'confirmed'), [allKpis]);
  const lockedKpis = useMemo(() => allKpis.filter((k) => k.status !== 'confirmed'), [allKpis]);

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const k of kpis) {
      next[k.kpiId] = {
        targetText: k.targetText ?? '',
        targetValue: k.targetValue === null || k.targetValue === undefined ? '' : String(k.targetValue),
        weight: String(k.weight),
      };
    }
    setDrafts(next);
  }, [kpis]);

  const commentByKpi = useMemo(() => {
    const map: Record<string, { note: string | null; decision: string | null }> = {};
    for (const c of detail.data?.kpiCheckIns ?? []) {
      map[c.kpiId] = { note: c.reviewerNote, decision: c.reviewerDecision };
    }
    return map;
  }, [detail.data]);

  // 실제 변경분(제출 페이로드와 동일한 단일 소스) — 미저장 가드·가중치 게이트·제출이 모두 이 값을 본다.
  const changedItems = useMemo<MidtermRevisionItem[]>(() => {
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
  }, [kpis, drafts]);

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

  // 잃을 게 있을 때만(변경된 KPI가 있거나 회신 사유를 입력했을 때만) 이탈 경고를 건다 —
  // 제출 게이트와 동일한 조건이라 서로 어긋나지 않는다.
  const hasUnsavedChanges = changedItems.length > 0 || note.trim().length > 0;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  async function submit() {
    if (!progressReady) {
      setError('KPI 진척을 불러온 뒤에 제출할 수 있어요.');
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

      {progressLoading && <Skeleton className="h-40 w-full" />}
      {progressFailed && (
        <ErrorState
          message="내 KPI 진척을 불러오지 못했어요. 다시 시도해 주세요."
          onRetry={progress.reload}
        />
      )}
      {progressReady && allKpis.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">이번 주기에 등록된 KPI가 없어요.</p>
        </Card>
      )}

      {progressReady &&
        kpis.map((k) => {
        const c = commentByKpi[k.kpiId];
        const needsAdjust = c?.decision === 'rebaseline';
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
              </label>
            </div>
          </Card>
          );
        })}

      {progressReady &&
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
          progressReady
            ? '제출하면 그룹대표의 최종 검토로 넘어가요.'
            : 'KPI 진척을 불러온 뒤에 제출할 수 있어요.'
        }
        actions={
          // 진척이 로딩 중/실패면 제출을 막는다 — 그 상태에서는 changedItems 가 항상 []라
          // 회신 사유만으로 "변경 0건" 제출이 성립하고, 본인은 그걸 정상 제출로 오해한다.
          <Button onClick={submit} disabled={saving || !progressReady}>
            {saving ? '제출 중…' : '수정 제출'}
          </Button>
        }
      />
    </div>
  );
}
