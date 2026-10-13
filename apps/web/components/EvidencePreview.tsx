'use client';

import { useEffect, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { apiDownloadBlob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
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

  const isPdf = file?.mimeType === 'application/pdf';
  const isImage = !!file?.mimeType.startsWith('image/');
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

  // Dialog(Radix) 가 body 포털·Esc·오버레이 클릭 닫기·스택킹을 처리한다.
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="2xl"
        layout="viewer"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {file && (
          <>
            {/* 헤더 */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <DialogTitle className="flex-1 truncate text-13 font-semibold text-neutral-950">
                {file.filename}
              </DialogTitle>
              <Button variant="outline" size="sm" onClick={download} disabled={!url}>
                <Download /> 다운로드
              </Button>
              <Button variant="ghost-muted" size="icon-xs" onClick={onClose} aria-label="닫기">
                <X />
              </Button>
            </div>

            {/* 본문 */}
            <div className="flex min-h-0 items-center justify-center bg-muted text-neutral-400">
              {loading ? (
                <Spinner className="size-7" />
              ) : error ? (
                <p className="text-13 text-neutral-500">파일을 불러오지 못했어요.</p>
              ) : !previewable ? (
                <div className="px-6 text-center">
                  <FileText className="mx-auto mb-2.5 size-9 text-neutral-300" aria-hidden />
                  <p className="mb-3 text-13 text-muted-foreground">
                    이 형식은 사이트에서 바로 볼 수 없어요. 다운로드해 확인해 주세요.
                  </p>
                  <Button onClick={download} disabled={!url}>
                    <Download /> 다운로드
                  </Button>
                </div>
              ) : isPdf && url ? (
                <iframe src={url} title={file.filename} className="size-full border-0" />
              ) : isImage && url ? (
                <div className="flex size-full items-center justify-center overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={file.filename}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
