'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useKpis, kpiCommands } from '@/hooks/useKpis';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InfoBanner } from '@/components/InfoBanner';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { KpiCard } from '@/components/KpiCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { cx, measureTypeUnit } from '@/lib/ui';
import { canReview } from '@/lib/nav';
import type { Kpi } from '@/lib/types';

export default function KpiReviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const allowed = !!user && canReview(user.role);

  const { data, loading, error, reload } = useKpis(
    { cycleId },
    { enabled: !!cycleId && allowed },
  );

  const kpis = data?.data ?? [];
  const submitted = kpis.filter((k) => k.status === 'submitted');

  const byUser = useMemo(() => {
    const map = new Map<string, Kpi[]>();
    for (const k of kpis) {
      const arr = map.get(k.userId) ?? [];
      arr.push(k);
      map.set(k.userId, arr);
    }
    return map;
  }, [kpis]);

  const userIds = Array.from(byUser.keys());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const activeUser = selectedUser ?? userIds[0] ?? null;
  const activeKpis = activeUser ? (byUser.get(activeUser) ?? []) : [];

  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState<'reject' | 'revision' | null>(
    null,
  );

  const activeSubmitted = activeKpis.filter((k) => k.status === 'submitted');
  const weightTotal = activeKpis.reduce((acc, k) => acc + k.weight, 0);
  const qualitativeTotal = activeKpis
    .filter((k) => k.isQualitative)
    .reduce((acc, k) => acc + k.weight, 0);
  const hasCore = activeKpis.some((k) => k.group === 'performance_core');
  const hasGrowth = activeKpis.some((k) => k.group === 'collaboration_growth');

  const commentRequired = comment.trim().length === 0;

  async function approveAll() {
    if (commentRequired) return;
    setBusy(true);
    try {
      for (const k of activeSubmitted) {
        await kpiCommands.approve(k.id, comment.trim());
      }
      toast.show({ variant: 'success', message: '승인했어요.' });
      setComment('');
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '승인에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    if (commentRequired || !rejectMode) return;
    setBusy(true);
    try {
      const reason =
        rejectMode === 'revision' ? `[수정요청] ${comment.trim()}` : comment.trim();
      for (const k of activeSubmitted) {
        // 계약 §8 reject: { reason(필수), comment? }. 검토 코멘트를 reason+comment 로 전송.
        await kpiCommands.reject(k.id, reason, comment.trim());
      }
      toast.show({
        variant: 'success',
        message: rejectMode === 'reject' ? '반려했어요.' : '수정요청했어요.',
      });
      setComment('');
      setRejectMode(null);
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '처리에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <Forbidden message="KPI 검토는 팀장 이상만 접근할 수 있어요." />;
  }
  if (cyclesLoading || loading) return <ReviewSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="KPI 검토" subtitle={`검토 대기 ${submitted.length}건`} />

      <InfoBanner tone="info" title="KPI 검토 안내">
        팀원이 제출한 과제를 검토하고 승인하거나 수정 요청을 보낼 수 있어요.
        가중치 합과 정성 KPI 비중을 함께 확인하세요.
      </InfoBanner>

      {userIds.length === 0 ? (
        <EmptyState title="검토할 KPI가 없어요." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <Card title="팀원 목록">
            <ul className="flex flex-col gap-1">
              {userIds.map((uid) => {
                const list = byUser.get(uid) ?? [];
                const head = list[0];
                return (
                  <li key={uid}>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(uid)}
                      className={cx(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-base outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        uid === activeUser
                          ? 'bg-secondary font-semibold text-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span>{uid.slice(0, 8)}</span>
                      {head && <StatusBadge status={head.status} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="검토 상세">
            {activeKpis.length === 0 ? (
              <EmptyState title="선택한 팀원의 KPI가 없어요." />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  {activeKpis.map((k) => (
                    <KpiCard
                      key={k.id}
                      mode="review"
                      data={{
                        id: k.id,
                        category: k.category,
                        group: k.group,
                        measureType: k.measureType,
                        coreStrategy: k.coreStrategy ?? '',
                        title: k.title,
                        csf: k.csf ?? undefined,
                        measureMethod: k.measureMethod ?? undefined,
                        targetValue: k.targetValue ?? undefined,
                        unit: measureTypeUnit[k.measureType],
                        weight: k.weight,
                        isQualitative: k.isQualitative,
                        status: k.status,
                      }}
                    />
                  ))}
                </div>

                <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span className={weightTotal === 100 ? 'text-success-600' : undefined}>
                    가중치 합 {weightTotal}%{weightTotal === 100 ? ' 충족' : ''}
                  </span>
                  <span className={qualitativeTotal <= 30 ? 'text-success-600' : undefined}>
                    정성 {qualitativeTotal}%{qualitativeTotal <= 30 ? ' 충족' : ''}
                  </span>
                  <span className={hasCore ? 'text-success-600' : undefined}>
                    성과중심 {hasCore ? '충족' : '미충족'}
                  </span>
                  <span className={hasGrowth ? 'text-success-600' : undefined}>
                    협업·성장 {hasGrowth ? '충족' : '미충족'}
                  </span>
                </p>

                <TextField
                  label="검토 코멘트 (필수)"
                  multiline
                  rows={3}
                  value={comment}
                  onChange={setComment}
                  placeholder="승인·반려·수정요청 사유를 작성해 주세요."
                  required
                  error={
                    commentRequired
                      ? '코멘트를 작성해야 처리할 수 있어요.'
                      : undefined
                  }
                />

                {activeSubmitted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    검토 대기(제출 상태) 과제가 없어요.
                  </p>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="danger"
                      disabled={commentRequired || busy}
                      onClick={() => setRejectMode('reject')}
                    >
                      반려
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={commentRequired || busy}
                      onClick={() => setRejectMode('revision')}
                    >
                      수정요청
                    </Button>
                    <Button
                      disabled={commentRequired}
                      loading={busy}
                      onClick={() => void approveAll()}
                    >
                      승인
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={rejectMode !== null}
        onClose={() => setRejectMode(null)}
        title={rejectMode === 'reject' ? '반려할까요?' : '수정요청할까요?'}
        primaryAction={{
          label: rejectMode === 'reject' ? '반려' : '수정요청',
          variant: 'danger',
          loading: busy,
          onClick: () => void confirmReject(),
        }}
        secondaryAction={{ label: '취소', onClick: () => setRejectMode(null) }}
      >
        작성된 코멘트와 함께 작성자에게 전달되고, 과제는 작성중으로 돌아가요.
      </Modal>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
