'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import { apiDownloadBlob } from '@/lib/api';
import { T } from '@/lib/palette';
import type { EvaluationEvidence } from '@/lib/types';

// 사이트 안에서 바로 보는 증빙 미리보기 — PDF·이미지는 인라인 렌더, 그 외는 다운로드 안내.
// Bearer 토큰 인증이라 단순 src 링크로는 불가 → Blob 으로 받아 objectURL 로 표시.
export function isEvidencePreviewable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

export function EvidencePreview({
  evaluationId,
  file,
  onClose,
}: {
  evaluationId: string;
  file: EvaluationEvidence | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;
    setLoading(true);
    setError(false);
    setUrl(null);
    apiDownloadBlob(`/evaluations/${evaluationId}/evidence/${file.id}/download`)
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file?.id, evaluationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc 로 닫기.
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;
  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType.startsWith('image/');
  const previewable = isPdf || isImage;

  function download() {
    if (!url || !file) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // body 포털로 렌더 — 페이지 stacking context에 갇혀 상단바·사이드바가 디밍 위로 떠 보이는 문제 방지.
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="flex flex-col"
        style={{ background: '#fff', width: 'min(960px, 94vw)', height: 'min(88vh, 900px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${T.grey200}`, flexShrink: 0 }}
        >
          <FileText size={15} color={T.grey600} style={{ flexShrink: 0 }} />
          <span className="truncate flex-1" style={{ fontSize: 13, fontWeight: 600, color: T.grey900 }}>
            {file.filename}
          </span>
          <button
            type="button"
            onClick={download}
            disabled={!url}
            className="flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50"
            style={{ fontSize: 12, fontWeight: 600, color: T.grey700, border: `1px solid ${T.grey200}`, background: '#fff' }}
          >
            <Download size={13} /> 다운로드
          </button>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ color: T.grey500, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: T.grey100 }}>
          {loading ? (
            <Loader2 size={28} className="animate-spin" color={T.grey400} />
          ) : error ? (
            <p style={{ fontSize: 13, color: T.grey500 }}>파일을 불러오지 못했어요.</p>
          ) : !previewable ? (
            <div className="text-center px-6">
              <FileText size={36} color={T.grey300} style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: T.grey600, marginBottom: 12 }}>
                이 형식은 사이트에서 바로 볼 수 없어요. 다운로드해 확인해 주세요.
              </p>
              <button
                type="button"
                onClick={download}
                disabled={!url}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50"
                style={{ fontSize: 13, fontWeight: 600, background: T.blue500 }}
              >
                <Download size={14} /> 다운로드
              </button>
            </div>
          ) : isPdf && url ? (
            <iframe src={url} title={file.filename} style={{ width: '100%', height: '100%', border: 0 }} />
          ) : isImage && url ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={file.filename}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
