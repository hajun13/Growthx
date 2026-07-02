'use client';

// 이의제기 신청/답변/결정 커맨드 — AppealsView 에서 분리(파일당 ~200줄 상한).
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import type { DecideAppealBody } from '../hooks';
import type { useAppealsData } from '../hooks';

export function useAppealActions(
  data: ReturnType<typeof useAppealsData>,
  resultId: string | null,
) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});

  function validateReason(): boolean {
    if (!reason.trim()) {
      setReasonError('이의제기 사유를 입력해 주세요.');
      return false;
    }
    if (reason.trim().length < 10) {
      setReasonError('최소 10자 이상 입력해 주세요.');
      return false;
    }
    setReasonError('');
    return true;
  }

  async function submitAppeal() {
    if (!resultId) return;
    if (!validateReason()) return;
    setBusy(true);
    try {
      await data.create({ resultId, reason: reason.trim() });
      toast.show({ variant: 'success', message: '이의제기를 신청했어요.' });
      setReason('');
      setReasonError('');
      data.reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'APPEAL_WINDOW_CLOSED'
          ? '신청 기간(7일)이 지났어요.'
          : err instanceof ApiError
            ? err.message
            : '신청에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string) {
    const text = (responseDraft[id] ?? '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await data.respond(id, text);
      toast.show({ variant: 'success', message: '답변을 등록했어요.' });
      setResponseDraft((p) => ({ ...p, [id]: '' }));
      data.reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '답변에 실패했어요.' });
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, body: DecideAppealBody) {
    setBusy(true);
    try {
      await data.decide(id, body);
      toast.show({ variant: 'success', message: '최종 결정을 등록했어요.' });
      data.reload();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'VALIDATION_ERROR'
          ? '점수·등급 수정은 최종 단계(조정/마감) 사이클에서만 가능해요.'
          : err instanceof ApiError
            ? err.message
            : '결정에 실패했어요.';
      toast.show({ variant: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  return {
    reason, setReason: (v: string) => { setReason(v); if (reasonError) setReasonError(''); },
    reasonError, busy, responseDraft, setResponseDraft,
    submitAppeal, respond, decide,
  };
}
