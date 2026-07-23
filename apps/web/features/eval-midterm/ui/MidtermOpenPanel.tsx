'use client';

import { useEffect, useRef, useState } from 'react';
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
 *
 * 이 패널은 CycleOpsView 안에서 cycleId prop 만 바뀌고 리마운트되지 않는다(같은 화면에 주기
 * 선택기가 있음). 그래서 "미리보기 → 확인 모달" 사이에 사용자가 주기를 바꿔도 모달이 살아남아
 * 엉뚱한 주기로 실행되지 않도록 세 겹으로 막는다: ①주기 전환 시 모달 자체를 닫는다 ②미리보기
 * 결과에 어느 주기에서 온 것인지 같이 저장해 모달의 실행 버튼을 "미리보기 주기 == 현재 주기"로
 * 게이트한다 ③await 이 끝났을 때 그 사이 주기가 또 바뀌었으면(레이스) 응답을 상태에 반영하지 않는다.
 */
export function MidtermOpenPanel({ cycleId, cycleName }: { cycleId: string; cycleName?: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<MidtermOpenResult | null>(null);
  // 미리보기를 성공적으로 받아 개시 버튼을 열어줄 근거가 있는지 — preview 자체(null 가능)와 분리.
  const [previewChecked, setPreviewChecked] = useState(false);
  // 이 미리보기가 어느 주기에 대한 것인지 — cycleId 가 바뀌면 즉시 무효화되도록 preview 와 짝지어 둔다.
  const [previewCycleId, setPreviewCycleId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false);
  // 재배정 확인이 어느 주기에 대한 것인지 — cycleId 가 바뀌면 즉시 무효화되도록.
  const [reassignConfirmCycleId, setReassignConfirmCycleId] = useState<string | null>(null);

  // 진행 중인 요청이 응답을 받았을 때 "그 사이 주기가 바뀌었는지" 판단하기 위한 최신 주기 참조.
  // 렌더마다 최신값으로 갱신 — effect 를 기다릴 필요 없이 항상 지금 화면의 cycleId 를 가리킨다.
  const latestCycleIdRef = useRef(cycleId);
  latestCycleIdRef.current = cycleId;

  // 주기를 바꾸면 이전 주기의 미리보기 결과로 개시하지 않도록 초기화 + 열려 있던 확인 모달도 닫는다
  // (모달이 살아남으면 "N명" 이라는 낡은 숫자를 보여준 채 새 주기로 실행 버튼을 누를 수 있어서).
  // 재배정 모달도 동일하게 닫아준다 — 이전 주기에 대한 확인을 새 주기로 실행할 수 없도록.
  useEffect(() => {
    setPreview(null);
    setPreviewChecked(false);
    setPreviewCycleId(null);
    setConfirmOpen(false);
    setReassignConfirmOpen(false);
    setReassignConfirmCycleId(null);
  }, [cycleId]);

  const busy = previewing || opening || reassigning;

  async function runPreview() {
    // 요청 시점의 주기를 고정 — await 도중 사용자가 주기를 바꿔도 이 값은 그대로라
    // 응답이 왔을 때 "지금도 여전히 같은 주기인지" 를 판단하는 기준이 된다.
    const requestedCycleId = cycleId;
    setPreviewing(true);
    try {
      const res = await openMidtermReviews(requestedCycleId, true);
      if (latestCycleIdRef.current !== requestedCycleId) {
        // 응답이 오는 사이 다른 주기로 전환됨 — 이 결과는 이제 화면 주기와 무관하니 반영하지 않는다.
        return;
      }
      if (res) {
        setPreview(res);
        setPreviewChecked(true);
        setPreviewCycleId(requestedCycleId);
      } else {
        // 성공(예외 없음)이지만 요약 정보가 없음 — 대상 수를 모르는 채로 개시를 열어줄 수 없다.
        setPreview(null);
        setPreviewChecked(false);
        setPreviewCycleId(null);
        toast.show({
          variant: 'info',
          message: '미리보기가 완료됐지만 요약 정보를 받지 못했어요. 다시 시도해 주세요.',
        });
      }
    } catch (err) {
      if (latestCycleIdRef.current !== requestedCycleId) return;
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '미리보기를 불러오지 못했어요.',
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function runOpen() {
    // 개시도 동일하게 요청 시점 주기를 고정 — 응답이 늦게 와서 그 사이 다른 주기로 넘어갔다면
    // (이론상 모달 게이트로 막혀 있지만) 그 주기의 미리보기 상태를 잘못 지우지 않기 위한 안전망.
    const requestedCycleId = cycleId;
    setOpening(true);
    try {
      const res = await openMidtermReviews(requestedCycleId, false);
      // 실제로 리뷰가 생성되고 메일이 나간 것은 사실이므로, 화면이 다른 주기로 넘어갔더라도
      // 결과 안내는 보여준다 — 다만 상태(미리보기/모달)는 지금 화면 주기가 일치할 때만 정리한다.
      toast.show({
        variant: res ? 'success' : 'info',
        message: res
          ? `중간점검 ${res.created}건을 개시했어요.`
          : '개시가 완료됐지만 요약 정보를 받지 못했어요.',
      });
      if (latestCycleIdRef.current === requestedCycleId) {
        setConfirmOpen(false);
        setPreview(null);
        setPreviewChecked(false);
        setPreviewCycleId(null);
      }
    } catch (err) {
      if (latestCycleIdRef.current !== requestedCycleId) return;
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '개시에 실패했어요.',
      });
    } finally {
      setOpening(false);
    }
  }

  async function runReassign() {
    // 요청 시점의 주기를 고정 — await 도중 사용자가 주기를 바꿔도 이 값은 그대로라
    // 응답이 왔을 때 "지금도 여전히 같은 주기인지" 를 판단하는 기준이 된다.
    const requestedCycleId = cycleId;
    setReassigning(true);
    try {
      const res = await reassignMidtermReviewers(requestedCycleId);
      // 실제로 재배정이 DB 에 반영된 것은 사실이므로, 화면이 다른 주기로 넘어갔더라도
      // 결과 안내는 보여준다 — 다만 모달 상태는 지금 화면 주기가 일치할 때만 정리한다.
      toast.show({
        variant: res ? 'success' : 'info',
        message: res
          ? `${res.scanned}건을 확인해 ${res.changed}건의 평가자를 재배정했어요.`
          : '재배정이 완료됐지만 요약 정보를 받지 못했어요.',
      });
      if (latestCycleIdRef.current === requestedCycleId) {
        setReassignConfirmOpen(false);
        setReassignConfirmCycleId(null);
      }
    } catch (err) {
      if (latestCycleIdRef.current !== requestedCycleId) return;
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
          onClick={() => {
            setReassignConfirmCycleId(cycleId);
            setReassignConfirmOpen(true);
          }}
        >
          평가자 재배정
        </Button>
      </div>

      {preview && (
        <div className="mt-4 space-y-2">
          {/* 대상 수만 보여 주면 재개시할 때 "87명에게 다시 메일이 나가나?" 를 알 수 없다.
              이미 개시된 건은 손대지 않으므로, 실제로 바뀌는 인원과 그대로 두는 인원을 나눠 적는다. */}
          <p className="text-[12.5px] text-foreground">
            대상 <span className="font-bold tabular-nums">{preview.targets.length}</span>명 · 새로
            개시 <span className="font-bold tabular-nums">{preview.created}</span>명
            {(preview.skipped ?? 0) > 0 && (
              <span className="text-muted-foreground">
                {' · 이미 개시돼 그대로 두는 건 '}
                <span className="font-semibold tabular-nums">{preview.skipped}</span>명
              </span>
            )}
          </p>
          {preview.created === 0 && (
            <p className="text-[12px] text-muted-foreground">
              지금 개시를 실행해도 새로 만들어지거나 초기화되는 건이 없어요. 이미 개시된 건의
              평가자·경과일·안내 메일은 그대로 유지돼요.
            </p>
          )}
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
        primaryAction={{
          label: '개시',
          onClick: () => void runOpen(),
          loading: opening,
          // 미리보기가 지금 주기 것이 아니면(주기 전환 중 모달이 살아남는 등) 절대 실행되지 않도록
          // — 주기 전환 effect 가 모달을 닫아주지만, 이 게이트가 마지막 방어선이다.
          disabled: !(previewChecked && previewCycleId === cycleId),
        }}
        secondaryAction={{ label: '취소', onClick: () => setConfirmOpen(false) }}
      >
        <div className="space-y-2">
          {previewChecked && previewCycleId === cycleId ? (
            <p className="text-sm text-foreground">
              대상 <span className="font-bold tabular-nums">{preview?.targets.length ?? 0}</span>명
              중 <span className="font-bold tabular-nums">{preview?.created ?? 0}</span>명에게
              중간점검을 만들고 그 건의 1차 평가자에게만 안내 메일을 보내요. 이미 개시된 건은
              그대로 둬요.
            </p>
          ) : (
            <p className="text-sm text-danger-700">
              선택된 주기가 바뀌어 미리보기 결과가 유효하지 않아요. 창을 닫고 다시 미리보기해
              주세요.
            </p>
          )}
          {preview && preview.warnings.length > 0 && previewCycleId === cycleId && (
            <p className="text-[12.5px] text-warning-700">
              확인이 필요한 항목 {preview.warnings.length}건이 있어요 — 위 목록을 먼저 확인해 주세요.
            </p>
          )}
        </div>
      </Modal>

      {/* 재배정은 미리보기 없이 사이클 전체 평가자를 즉시 재계산·덮어쓰는 일괄 작업이라
          별도 확인 없이는 실행할 수 없다. 개시 모달처럼 주기 변경 중 모달이 살아남는 것을
          방지하려고 세 겹으로 막는다. */}
      <Modal
        open={reassignConfirmOpen}
        onClose={() => setReassignConfirmOpen(false)}
        title="평가자를 재배정할까요?"
        primaryAction={{
          label: '재배정',
          onClick: () => void runReassign(),
          loading: reassigning,
          // 재배정 확인이 지금 주기 것이 아니면(주기 전환 중 모달이 살아남는 등) 절대 실행되지 않도록
          // — 주기 전환 effect 가 모달을 닫아주지만, 이 게이트가 마지막 방어선이다.
          disabled: reassignConfirmCycleId !== cycleId,
        }}
        secondaryAction={{ label: '취소', onClick: () => setReassignConfirmOpen(false) }}
      >
        <div className="space-y-2">
          {reassignConfirmCycleId === cycleId ? (
            <p className="text-sm text-foreground">
              <span className="font-semibold">{cycleName ?? '선택한 주기'}</span> 사이클 전체에서 진행 중인(마감되지
              않은) 중간점검의 평가자를 현재 조직 구조 기준으로 다시 계산해 덮어써요. 되돌릴 수 없으니
              조직 변경사항을 반영할 때만 실행해 주세요.
            </p>
          ) : (
            <p className="text-sm text-danger-700">
              선택된 주기가 바뀌어 재배정 요청이 유효하지 않아요. 창을 닫고 다시 시도해 주세요.
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
}
