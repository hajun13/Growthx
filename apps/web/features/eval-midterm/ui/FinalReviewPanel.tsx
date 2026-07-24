'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { useMidtermDetail } from '../hooks';
import { approveMidterm, returnMidterm } from '../api';
import {
  MidtermTrailTimeline,
  MIDTERM_FIELD_LABEL,
  formatMidtermValue,
} from './MidtermTrailTimeline';

/**
 * 2차(최종) 검토 화면 — 1차 총평·본인 회신·KPI 변경 내역을 보고 승인 또는 반려.
 * 승인하면 closed 로 마감되고, 되돌리는 것은 인사 담당자만 할 수 있다(비가역) →
 * 승인은 확인 모달을 거친다. 반려는 사유 입력 자체가 의도적인 행위라 모달 없이 진행하되,
 * 사유가 비어 있으면 눈에 보이는 문구로 막는다.
 */
export function FinalReviewPanel({
  reviewId,
  onDone,
  onDirtyChange,
}: {
  reviewId: string;
  onDone: () => void;
  /** 미저장 검토 의견(comment) 존재 여부 통지 — 구성원 전환 가드용. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const detail = useMidtermDetail(reviewId);
  const [comment, setComment] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 미저장 입력 = 비어 있지 않은 검토 의견.
  useEffect(() => {
    onDirtyChange?.(comment.trim().length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment]);

  // 마지막 수정 제출 이력에서 변경 내역 + 구성원 조정 코멘트를 뽑는다(전/후 대조용).
  // kpiReviews 는 'revised' 엔트리에서 decision=null·note=구성원이 이 KPI를 왜 조정했는지의 코멘트.
  const lastRevision = [...(detail.data?.trail ?? [])]
    .reverse()
    .find((t) => t.action === 'revised');
  const kpiChanges = lastRevision?.kpiChanges ?? [];
  const kpiComments = lastRevision?.kpiReviews ?? [];

  // KPI별로 변경 내역 + 조정 코멘트를 한데 묶는다 — 그룹대표가 "무엇을·왜 조정했는지"를
  // KPI 단위로 한눈에 보게 한다(등장 순서: 변경 있는 KPI 먼저, 코멘트만 있는 KPI 는 뒤에).
  const kpiOrder: string[] = [];
  const changesByKpi = new Map<string, typeof kpiChanges>();
  for (const c of kpiChanges) {
    if (!changesByKpi.has(c.kpiId)) {
      changesByKpi.set(c.kpiId, []);
      kpiOrder.push(c.kpiId);
    }
    changesByKpi.get(c.kpiId)!.push(c);
  }
  const commentByKpi = new Map(kpiComments.map((r) => [r.kpiId, r]));
  for (const r of kpiComments) {
    if (!changesByKpi.has(r.kpiId)) {
      changesByKpi.set(r.kpiId, []);
      kpiOrder.push(r.kpiId);
    }
  }

  async function run(kind: 'approve' | 'return') {
    if (kind === 'return' && !comment.trim()) {
      setError('반려 사유를 적어 주세요. 대상자가 무엇을 고쳐야 할지 알 수 있어야 해요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // approveMidterm/returnMidterm 은 MidtermDetail | null 을 반환한다(orval 의 200|201(void)
      // 유니언 때문에 응답 바디가 없을 수 있음) — null 은 실패가 아니라 "처리는 됐지만 바디가
      // 없음"이다. 그래서 반환값을 판정에 쓰지 않고, 예외가 없으면 성공으로 본다.
      if (kind === 'approve') await approveMidterm(reviewId, comment.trim() || undefined);
      else await returnMidterm(reviewId, comment.trim());
      setConfirming(false);
      onDone();
    } catch (err) {
      // 실패해도 입력한 검토 의견은 그대로 둔다(재시도 시 재입력 방지).
      setError(err instanceof Error ? err.message : '처리하지 못했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {detail.data?.firstComment && (
        <Card>
          <h4 className="text-sm font-semibold text-foreground">1차 총평</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {detail.data.firstComment}
          </p>
        </Card>
      )}

      <Card>
        <h4 className="text-sm font-semibold text-foreground">본인 회신</h4>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
          {detail.data?.memberNote ?? '(작성 없음)'}
        </p>
        {kpiOrder.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {kpiOrder.map((kpiId) => {
              const changes = changesByKpi.get(kpiId) ?? [];
              const memberComment = commentByKpi.get(kpiId);
              const title = changes[0]?.kpiTitle ?? memberComment?.kpiTitle ?? kpiId;
              return (
                <li key={kpiId} className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  {changes.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {changes.map((c, i) => (
                        <li key={`${c.field}-${i}`} className="text-[12.5px] text-muted-foreground">
                          {MIDTERM_FIELD_LABEL[c.field] ?? c.field}{' '}
                          <span className="tabular-nums">{formatMidtermValue(c.field, c.before)}</span>
                          {' → '}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatMidtermValue(c.field, c.after)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {memberComment?.note && (
                    <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-foreground/90">
                      <span className="mr-1 font-semibold text-muted-foreground">조정 코멘트</span>
                      {memberComment.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">KPI 변경 없음</p>
        )}
      </Card>

      <Card>
        <h4 className="mb-2 text-sm font-semibold text-foreground">검토 의견</h4>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="반려할 경우 사유는 필수예요."
          className="w-full rounded-md border border-border bg-card p-2 text-sm text-foreground"
          rows={3}
        />
      </Card>

      {detail.data && <MidtermTrailTimeline entries={detail.data.trail} />}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <EvaluationActionPanel
        sticky
        // 스크롤 중 하단 고정 바에서 반려를 눌렀을 때도 에러(빈 반려 사유·API 실패)가
        // 화면 밖(본문 상단)에만 떠서 안 보이는 문제 방지 — 있을 땐 액션 바에도 노출.
        message={
          error ? (
            <span className="font-semibold text-destructive">{error}</span>
          ) : (
            '승인하면 이 구성원의 중간점검이 마감돼요. 되돌리는 것은 인사 담당자만 할 수 있어요.'
          )
        }
        summary={
          <p className="text-[12px] text-muted-foreground">
            수정된 지표 <span className="font-bold tabular-nums text-foreground">{kpiOrder.length}</span>건
          </p>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => run('return')} disabled={saving}>
              {saving ? '처리 중…' : '반려'}
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={saving}>
              승인하고 마감
            </Button>
          </>
        }
      />

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="승인하고 마감할까요?"
        primaryAction={{ label: '승인', onClick: () => run('approve'), loading: saving }}
        secondaryAction={{ label: '취소', onClick: () => setConfirming(false) }}
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            승인하면 이 구성원의 중간점검이 마감되고, 대상자는 더 이상 목표를 수정할 수 없어요.
            되돌리는 것은 인사 담당자만 할 수 있어요.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
