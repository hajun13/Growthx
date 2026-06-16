'use client';

// 본인 재조정 제안 섹션 — /eval/midterm EmployeeMidterm 에 통합.
// 흐름: 확정 KPI 로드 → RebaselineTable(편집) + 사유 + WeightSummaryBar → 제출.
// 반려 시: 반려 코멘트 표시 + 수정·재제출 가능.
// 승인 시: 읽기전용 결과 표시.
// 미결 1건 제약 안내(중복 submit 400 시 안내 토스트).
//
// 재사용 컴포넌트:
//  - RebaselineTable (편집 모드)
//  - WeightSummaryBar
//  - RebaselineStatusBadge
//  - RebaselineHistory (이력 패널)
//
// 계약: contract-midterm.md §7. 상태값: submitted | approved | rejected.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useRebaselineRequests,
  useRebaselineRequestDetail,
  rebaselineRequestCommands,
  useRebaselineHistory,
} from '@/hooks/useMidterm';
import { useKpis } from '@/hooks/useKpis';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { InfoBanner } from '@/components/InfoBanner';
import { Modal } from '@/components/Modal';
import { EmptyState, Skeleton } from '@/components/States';
import { RebaselineTable, isRowChanged, type RebaselineRow } from '@/components/RebaselineTable';
import { WeightSummaryBar } from '@/components/WeightSummaryBar';
import { RebaselineStatusBadge } from '@/components/RebaselineStatusBadge';
import { RebaselineHistory } from '@/components/RebaselineHistory';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { T } from '@/lib/toss';
import type { Kpi, RebaselineRequestDetail } from '@/lib/types';

interface Props {
  cycleId: string;
  userId: string;
  readOnly: boolean; // mid_review 아닌 단계 → 읽기전용
}

// 확정 KPI → 편집 행 변환.
function kpiToRow(k: Kpi): RebaselineRow {
  return {
    kpiId: k.id,
    title: k.title,
    group: k.group,
    measureType: k.measureType,
    isQualitative: k.isQualitative,
    currentTargetValue: k.targetValue,
    currentTargetText: k.targetText,
    currentWeight: k.weight,
    nextTargetValue: k.targetValue,
    nextTargetText: k.targetText,
    nextWeight: k.weight,
  };
}

// ── 메인 컴포넌트 ──
export function RebaselineRequestSection({ cycleId, userId, readOnly }: Props) {
  const toast = useToast();

  // 본인의 미결·최신 요청(cycleId + evaluateeId=userId).
  const {
    data: reqList,
    loading: reqListLoading,
    reload: reloadList,
  } = useRebaselineRequests(
    { cycleId, evaluateeId: userId },
    { enabled: !!cycleId },
  );

  // 가장 최신 요청(status: submitted/approved/rejected 중 하나. 없으면 null).
  const latestReq = useMemo(() => {
    const list = reqList?.data ?? [];
    // submitted 우선(미결), 없으면 최신
    return (
      list.find((r) => r.status === 'submitted') ??
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
      null
    );
  }, [reqList]);

  // 상세(proposedChanges·currentKpis·weightValid 포함).
  const {
    data: detail,
    loading: detailLoading,
    reload: reloadDetail,
  } = useRebaselineRequestDetail(latestReq?.id ?? null, { enabled: !!latestReq?.id });

  const [historyNonce, setHistoryNonce] = useState(0);
  const reloadAll = useCallback(() => {
    reloadList();
    reloadDetail();
    setHistoryNonce((n) => n + 1);
  }, [reloadList, reloadDetail]);

  // 신규 제안 폼 표시 여부.
  // - approved/없음: 새 제안 가능.
  // - rejected: 수정 재제출 가능.
  // - submitted: 편집 가능(검토 전 수정).
  const showForm = !readOnly && (
    !latestReq || latestReq.status === 'rejected' || latestReq.status === 'approved'
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null=신규, id=수정

  if (reqListLoading) {
    return (
      <Card title="목표 재조정 요청">
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="목표 재조정 요청"
        action={
          <div className="flex items-center gap-2">
            {latestReq && <RebaselineStatusBadge status={latestReq.status} />}
            {!readOnly && (
              <>
                {/* 검토 전(submitted) — 수정 가능 */}
                {latestReq?.status === 'submitted' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(latestReq.id);
                      setFormOpen(true);
                    }}
                  >
                    수정
                  </Button>
                )}
                {/* 반려 — 수정·재제출 */}
                {latestReq?.status === 'rejected' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingId(latestReq.id);
                      setFormOpen(true);
                    }}
                  >
                    수정·재제출
                  </Button>
                )}
                {/* 없음 또는 승인 완료 — 새 제안 */}
                {(!latestReq || latestReq.status === 'approved') && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingId(null);
                      setFormOpen(true);
                    }}
                  >
                    목표 재조정 요청
                  </Button>
                )}
              </>
            )}
          </div>
        }
      >
        {readOnly && !latestReq ? (
          <p className="text-[12.5px] text-muted-foreground">
            중간평가(mid_review) 단계에서만 목표 재조정을 요청할 수 있어요.
          </p>
        ) : !latestReq ? (
          <EmptyState
            title="아직 목표 재조정 요청이 없어요."
            description="'목표 재조정 요청' 버튼을 눌러 확정 KPI의 목표·가중치 변경을 제안해 보세요."
            action={
              !readOnly ? (
                <Button
                  size="sm"
                  onClick={() => { setEditingId(null); setFormOpen(true); }}
                >
                  목표 재조정 요청
                </Button>
              ) : undefined
            }
          />
        ) : (
          <RequestStatusPanel
            detail={detail ?? null}
            loading={detailLoading}
            onReload={reloadAll}
          />
        )}
      </Card>

      {/* 변경 이력(승인 반영분) */}
      <RebaselineHistory
        key={`hist-${userId}-${historyNonce}`}
        cycleId={cycleId}
        userId={userId}
      />

      {/* 제안/수정 폼 모달 */}
      {formOpen && (
        <RebaselineFormModal
          cycleId={cycleId}
          userId={userId}
          editingId={editingId}
          existingDetail={editingId && detail ? detail : null}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            reloadAll();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── 상태 패널(기존 요청 표시) ──
function RequestStatusPanel({
  detail,
  loading,
  onReload,
}: {
  detail: RebaselineRequestDetail | null;
  loading: boolean;
  onReload: () => void;
}) {
  // 재로딩 중엔 기존 detail 유지(스크롤 보존) — 첫 로딩에만 스켈레톤.
  if (loading && !detail) return <Skeleton className="h-48 w-full" />;
  if (!detail) return null;

  const isRejected = detail.status === 'rejected';
  const isApproved = detail.status === 'approved';
  const isSubmitted = detail.status === 'submitted';
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '';

  return (
    <div className="flex flex-col gap-3">
      {/* 상태 안내 배너 */}
      {isSubmitted && (
        <InfoBanner tone="tip" title="부서장 검토를 기다리고 있어요.">
          검토 전에는 수정할 수 있어요. 가중치 합 {detail.projectedWeightSum}%
          {!detail.weightValid && (
            <span className="ml-1 font-bold text-danger-700">
              — 합이 100%여야 승인될 수 있어요.
            </span>
          )}
        </InfoBanner>
      )}

      {/* 반려 배너 */}
      {isRejected && (
        <div className="flex items-start gap-3 rounded-lg border border-danger-100 bg-danger-50 p-3.5">
          <AlertTriangle
            size={15}
            className="mt-0.5 shrink-0 text-danger-500"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-danger-700 leading-snug">
              반려됐어요
              {detail.reviewerName ? ` · ${detail.reviewerName}` : ''}
              {detail.reviewedAt ? ` · ${fmtDate(detail.reviewedAt)}` : ''}
            </p>
            {detail.reviewComment && (
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-danger-700/80">
                {detail.reviewComment}
              </p>
            )}
            <p className="mt-1.5 text-[11.5px] text-danger-600">
              '수정·재제출' 버튼으로 내용을 수정해 다시 제출할 수 있어요.
            </p>
          </div>
        </div>
      )}

      {/* 승인 배너 */}
      {isApproved && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success-100 bg-success-50 p-3.5">
          <CheckCircle2
            size={15}
            className="shrink-0 text-success-700"
            aria-hidden
          />
          <p className="text-[13px] font-semibold text-success-700">
            승인·반영됐어요
            {detail.reviewerName && (
              <span className="ml-1.5 text-[12px] font-normal text-success-600">
                ({detail.reviewerName}
                {detail.reviewedAt ? ` · ${fmtDate(detail.reviewedAt)}` : ''})
              </span>
            )}
          </p>
        </div>
      )}

      {/* 재조정 사유 */}
      <div className="rounded-md bg-muted px-3.5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          재조정 사유
        </span>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
          {detail.reason}
        </p>
      </div>

      {/* 가중치 검증 */}
      <WeightSummaryBar
        totalWeight={detail.projectedWeightSum}
        qualitativeWeight={
          detail.currentKpis
            .filter((k) => k.isQualitative)
            .reduce((s, k) => {
              const item = detail.items.find((i) => i.kpiId === k.id);
              return s + (item?.weight ?? k.weight);
            }, 0)
        }
        compact
      />

      {/* 제안 vs 현재 diff 표(읽기전용) */}
      {detail.proposedChanges.length > 0 ? (
        <ProposedChangesTable
          changes={detail.proposedChanges}
          currentKpis={detail.currentKpis}
          items={detail.items}
        />
      ) : (
        <p className="text-[12px] text-muted-foreground">변경 내용이 없어요.</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={11} aria-hidden /> 새로고침
        </button>
      </div>
    </div>
  );
}

// ── 제안 vs 현재 diff 표 (읽기전용 RebaselineTable 변형) ──
function ProposedChangesTable({
  changes,
  currentKpis,
  items,
}: {
  changes: RebaselineRequestDetail['proposedChanges'];
  currentKpis: RebaselineRequestDetail['currentKpis'];
  items: RebaselineRequestDetail['items'];
}) {
  // RebaselineTable 의 readOnly=true 변형으로 표시 — rows를 계약 응답에서 조립.
  const rows: RebaselineRow[] = currentKpis.map((k) => {
    const item = items.find((i) => i.kpiId === k.id);
    return {
      kpiId: k.id,
      title: k.title,
      group: k.group as RebaselineRow['group'],
      measureType: k.measureType as RebaselineRow['measureType'],
      isQualitative: k.isQualitative,
      currentTargetValue: k.targetValue,
      currentTargetText: k.targetText,
      currentWeight: k.weight,
      nextTargetValue: item?.targetValue !== undefined ? (item.targetValue ?? k.targetValue) : k.targetValue,
      nextTargetText: item?.targetText !== undefined ? (item.targetText ?? k.targetText) : k.targetText,
      nextWeight: item?.weight !== undefined ? item.weight : k.weight,
    };
  });

  return (
    <RebaselineTable
      rows={rows}
      onChange={() => {}} // readOnly
      readOnly
    />
  );
}

// ── 제안/수정 폼 모달 ──
function RebaselineFormModal({
  cycleId,
  userId,
  editingId,
  existingDetail,
  onClose,
  onSaved,
  toast,
}: {
  cycleId: string;
  userId: string;
  editingId: string | null; // null=신규
  existingDetail: RebaselineRequestDetail | null;
  onClose: () => void;
  onSaved: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  // 확정 KPI 목록(신규 제안 시 서버 조회, 수정 시 existingDetail.currentKpis 재사용).
  const { data: kpiData, loading: kpiLoading } = useKpis(
    { cycleId, userId, status: 'confirmed' },
    { enabled: !existingDetail }, // 신규일 때만 조회
  );

  const [rows, setRows] = useState<RebaselineRow[]>([]);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 초기값 세팅.
  useEffect(() => {
    if (existingDetail) {
      // 수정 모드: 현재 KPI를 기반으로 기존 제안값 복원.
      setRows(
        existingDetail.currentKpis.map((k): RebaselineRow => {
          const item = existingDetail.items.find((i) => i.kpiId === k.id);
          return {
            kpiId: k.id,
            title: k.title,
            group: k.group as RebaselineRow['group'],
            measureType: k.measureType as RebaselineRow['measureType'],
            isQualitative: k.isQualitative,
            currentTargetValue: k.targetValue,
            currentTargetText: k.targetText,
            currentWeight: k.weight,
            nextTargetValue: item?.targetValue !== undefined ? (item.targetValue ?? k.targetValue) : k.targetValue,
            nextTargetText: item?.targetText !== undefined ? (item.targetText ?? k.targetText) : k.targetText,
            nextWeight: item?.weight !== undefined ? item.weight : k.weight,
          };
        }),
      );
      setReason(existingDetail.reason);
    } else {
      // 신규 모드: KPI 조회 결과로 초기화.
      const kpis = kpiData?.data ?? [];
      setRows(kpis.map(kpiToRow));
    }
  }, [existingDetail, kpiData]);

  function patchRow(kpiId: string, patch: Partial<RebaselineRow>) {
    setRows((prev) =>
      prev.map((r) => (r.kpiId === kpiId ? { ...r, ...patch } : r)),
    );
  }

  const changedRows = useMemo(() => rows.filter(isRowChanged), [rows]);
  const totalWeight = useMemo(
    () => rows.reduce((s, r) => s + (Number.isFinite(r.nextWeight) ? r.nextWeight : 0), 0),
    [rows],
  );
  const qualWeight = useMemo(
    () =>
      rows
        .filter((r) => r.isQualitative || r.measureType === 'qualitative')
        .reduce((s, r) => s + r.nextWeight, 0),
    [rows],
  );

  const sumOk = totalWeight === 100;
  const reasonOk = reason.trim().length > 0;
  const hasChange = changedRows.length > 0;
  const negativeTarget = rows.some(
    (r) =>
      !(r.isQualitative || r.measureType === 'qualitative') &&
      r.nextTargetValue !== null &&
      r.nextTargetValue < 0,
  );
  const canSubmit = sumOk && reasonOk && hasChange && !negativeTarget;

  async function handleSubmit() {
    const items = changedRows.map((r) => {
      const qual = r.isQualitative || r.measureType === 'qualitative';
      const item: { kpiId: string; weight?: number; targetValue?: number | null; targetText?: string | null } = { kpiId: r.kpiId };
      if (r.nextWeight !== r.currentWeight) item.weight = r.nextWeight;
      if (qual) {
        if (r.nextTargetText !== r.currentTargetText) item.targetText = r.nextTargetText;
      } else {
        if (r.nextTargetValue !== r.currentTargetValue) item.targetValue = r.nextTargetValue;
      }
      return item;
    });

    setSubmitting(true);
    try {
      if (editingId) {
        await rebaselineRequestCommands.update(editingId, { reason: reason.trim(), items });
        toast.show({ variant: 'success', message: '재조정 요청을 수정·재제출했어요.' });
      } else {
        await rebaselineRequestCommands.create({ cycleId, reason: reason.trim(), items });
        toast.show({ variant: 'success', message: '재조정 요청을 제출했어요. 부서장이 검토할 거예요.' });
      }
      setConfirmOpen(false);
      onSaved();
    } catch (err) {
      setConfirmOpen(false);
      const msg =
        err instanceof ApiError
          ? err.message
          : '제출에 실패했어요.';
      // 중복 미결 요청(400) 안내
      if (err instanceof ApiError && err.message.includes('미결')) {
        toast.show({ variant: 'danger', message: '이미 검토 중인 재조정 요청이 있어요. 기존 요청을 수정·재제출해 주세요.' });
      } else {
        toast.show({ variant: 'danger', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isLoading = !existingDetail && kpiLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={editingId ? '재조정 요청 수정' : '목표 재조정 요청'}
        size="xl"
        primaryAction={{
          label: editingId ? '수정·재제출' : '제출',
          onClick: () => {
            if (canSubmit) setConfirmOpen(true);
          },
          disabled: !canSubmit || submitting,
        }}
        secondaryAction={{ label: '취소', onClick: onClose }}
      >
        <div className="flex flex-col gap-4">
          <InfoBanner tone="tip">
            확정된 KPI의 목표·가중치를 변경하고 사유를 작성해 주세요. 부서장이 승인하면 실제로 반영돼요.
            한 주기에 미결 요청은 1건만 가능해요.
          </InfoBanner>

          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : isEmpty ? (
            <EmptyState title="확정된 KPI가 없어요." description="KPI가 확정(confirmed) 상태여야 재조정을 요청할 수 있어요." />
          ) : (
            <>
              <WeightSummaryBar
                totalWeight={totalWeight}
                qualitativeWeight={qualWeight}
              />
              <RebaselineTable rows={rows} onChange={patchRow} />
            </>
          )}

          {!isEmpty && !isLoading && (
            <TextField
              label="재조정 사유"
              multiline
              rows={3}
              required
              value={reason}
              onChange={(v) => {
                setReason(v);
                if (!reasonTouched) setReasonTouched(true);
              }}
              placeholder="예: 상반기 시장 위축으로 매출 목표 하향, 수주 비중 상향"
              hint="감사 로그·이력에 기록돼요. (필수, 1~1000자)"
              error={
                reasonTouched && !reasonOk
                  ? '재조정 사유를 입력해 주세요.'
                  : undefined
              }
            />
          )}
        </div>
      </Modal>

      {/* 제출 확인 다이얼로그 */}
      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={editingId ? '수정·재제출할까요?' : '제출할까요?'}
        size="sm"
        primaryAction={{
          label: editingId ? '수정·재제출' : '제출',
          onClick: () => void handleSubmit(),
          loading: submitting,
          disabled: submitting,
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmOpen(false) }}
      >
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">
            변경 {changedRows.length}개 KPI · 가중치 합 {totalWeight}%
          </p>
          <p className="text-[12.5px] text-muted-foreground/70">
            제출 후 부서장이 검토해요. 승인 전에는 수정할 수 있어요.
          </p>
        </div>
      </Modal>
    </>
  );
}
