'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAppeals,
  createAppeal,
  respondAppeal,
  decideAppeal,
  fetchAttachments,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
  type Appeal,
  type AppealAttachment,
  type DecideAppealBody,
} from './api';

export type { Appeal, AppealStatus, AppealDecisionType, AppealAttachment, DecideAppealBody } from './api';

/**
 * 이의제기 목록 로드 + 신청/답변/결정 커맨드.
 * Phase 3B-3: decideAppeal이 5지 결정 body를 받도록 변경됨.
 */
export function useAppealsData(enabled: boolean) {
  const [items, setItems] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAppeals());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    loading,
    error,
    reload,
    create: createAppeal,
    respond: respondAppeal,
    /** 5지 결정 — decisionType + reason 필수, newScore/newGrade 조건부 */
    decide: (id: string, body: DecideAppealBody) => decideAppeal(id, body),
  };
}

/**
 * 단일 이의제기의 첨부파일 목록 + 업로드/다운로드/삭제.
 */
export function useAppealAttachments(appealId: string | null, enabled: boolean) {
  const [items, setItems] = useState<AppealAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!appealId || !enabled) return;
    setLoading(true);
    try {
      setItems(await fetchAttachments(appealId));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appealId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function upload(file: File): Promise<void> {
    if (!appealId) return;
    setUploading(true);
    try {
      await uploadAttachment(appealId, file);
      await reload();
    } finally {
      setUploading(false);
    }
  }

  async function download(attachment: AppealAttachment): Promise<void> {
    if (!appealId) return;
    const blob = await downloadAttachment(appealId, attachment.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function remove(attachmentId: string): Promise<void> {
    if (!appealId) return;
    await deleteAttachment(appealId, attachmentId);
    await reload();
  }

  return { items, loading, uploading, reload, upload, download, remove };
}
