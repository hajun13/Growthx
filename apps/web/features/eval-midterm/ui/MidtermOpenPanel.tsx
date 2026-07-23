'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { openMidtermReviews, reassignMidtermReviewers, type MidtermOpenResult } from '../api';

/**
 * HR 중간점검 개시·재배정 패널 — 사이클 전체 대상 일괄 작업.
 * 개시는 대상자 전원에게 리뷰 행을 만들고 1차 평가자에게 메일을 보내는 파괴적 작업이라
 * 미리보기(dryRun)로 대상·경고를 확인하기 전에는 실행할 수 없다(개시 버튼 게이트).
 */
export function MidtermOpenPanel({ cycleId }: { cycleId: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<MidtermOpenResult | null>(null);
  // 미리보기를 성공적으로 받아 개시 버튼을 열어줄 근거가 있는지 — preview 자체(null 가능)와 분리.
  const [previewChecked, setPreviewChecked] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 주기를 바꾸면 이전 주기의 미리보기 결과로 개시하지 않도록 초기화.
  useEffect(() => {
    setPreview(null);
    setPreviewChecked(false);
  }, [cycleId]);

  const busy = previewing || opening || reassigning;

  async function runPreview() {
    setPreviewing(true);
    try {
      const res = await openMidtermReviews(cycleId, true);
      if (res) {
        setPreview(res);
        setPreviewChecked(true);
      } else {
        // 성공(예외 없음)이지만 요약 정보가 없음 — 대상 수를 모르는 채로 개시를 열어줄 수 없다.
        setPreview(null);
        setPreviewChecked(false);
        toast.show({
          variant: 'info',
          message: '미리보기가 완료됐지만 요약 정보를 받지 못했어요. 다시 시도해 주세요.',
        });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '미리보기를 불러오지 못했어요.',
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function runOpen() {
    setOpening(true);
    try {
      const res = await openMidtermReviews(cycleId, false);
      toast.show({
        variant: res ? 'success' : 'info',
        message: res
          ? `중간점검 ${res.created}건을 개시했어요.`
          : '개시가 완료됐지만 요약 정보를 받지 못했어요.',
      });
      setConfirmOpen(false);
      setPreview(null);
      setPreviewChecked(false);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '개시에 실패했어요.',
      });
    } finally {
      setOpening(false);
    }
  }

  async function runReassign() {
    setReassigning(true);
    try {
      const res = await reassignMidtermReviewers(cycleId);
      toast.show({
        variant: res ? 'success' : 'info',
        message: res
          ? `${res.scanned}건을 확인해 ${res.changed}건의 평가자를 재배정했어요.`
          : '재배정이 완료됐지만 요약 정보를 받지 못했어요.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '재배정에 실패했어요.',
      });
    } finally {
      setReassigning(false);
    }
  }

  return (
    <Card>
      <h3 className="text-[14px] font-bold text-foreground">중간점검 개시</h3>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        확정 KPI가 있고 그룹대표가 배정된 임직원의 중간점검을 만들고, 1차 평가자에게 안내 메일을
        보내요.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          loading={previewing}
          disabled={busy}
          onClick={() => void runPreview()}
        >
          대상 미리보기
        </Button>
        <Button size="sm" disabled={busy || !previewChecked} onClick={() => setConfirmOpen(true)}>
          개시
        </Button>
        <Button
          variant="secondary"
          size="sm"
          loading={reassigning}
          disabled={busy}
          onClick={() => void runReassign()}
        >
          평가자 재배정
        </Button>
      </div>

      {preview && (
        <div className="mt-4 space-y-2">
          <p className="text-[12.5px] text-foreground">
            대상 <span className="font-bold tabular-nums">{preview.targets.length}</span>명
          </p>
          {preview.warnings.length > 0 && (
            <div className="rounded-md border border-warning-300 bg-warning-50 p-3">
              <p className="text-[12.5px] font-semibold text-warning-700">
                확인이 필요한 항목 {preview.warnings.length}건
              </p>
              <ul className="mt-1.5 space-y-1">
                {preview.warnings.map((w, i) => (
                  <li key={`${w.userId}-${i}`} className="text-[12px] text-warning-700">
                    {w.name} — {w.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="중간점검을 개시할까요?"
        primaryAction={{ label: '개시', onClick: () => void runOpen(), loading: opening }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmOpen(false) }}
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            대상 <span className="font-bold tabular-nums">{preview?.targets.length ?? 0}</span>명에게
            중간점검을 만들고 1차 평가자에게 안내 메일을 보내요.
          </p>
          {preview && preview.warnings.length > 0 && (
            <p className="text-[12.5px] text-warning-700">
              확인이 필요한 항목 {preview.warnings.length}건이 있어요 — 위 목록을 먼저 확인해 주세요.
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
}
