'use client';

/**
 * EvidenceSection — KPI 문항별 증빙 첨부 (목록 + 업로드 + 삭제).
 * readOnly(제출 후)면 보기·다운로드만 허용.
 */
import { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/Button';
import { evidenceCommands, openEvidence } from '@/hooks/useEvaluations';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
import { useToast } from '@/components/Toast';
import type { EvaluationEvidence } from '@/lib/types';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function errInfo(err: unknown): { message?: string } {
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown };
    return { message: typeof e.message === 'string' ? e.message : undefined };
  }
  return {};
}

interface Props {
  evaluationId: string;
  kpiId: string;
  files: EvaluationEvidence[];
  readOnly: boolean;
  onChanged: () => void;
}

export function EvidenceSection({ evaluationId, kpiId, files, readOnly, onChanged }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EvaluationEvidence | null>(null);

  function openFile(f: EvaluationEvidence) {
    if (isEvidencePreviewable(f.mimeType)) setPreview(f);
    else void handleDownload(f);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        await evidenceCommands.upload(evaluationId, kpiId, f);
      }
      toast.show({ variant: 'success', message: '증빙 자료를 첨부했어요.' });
      onChanged();
    } catch (err) {
      toast.show({ variant: 'danger', message: errInfo(err).message ?? '첨부에 실패했어요.' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(e: EvaluationEvidence) {
    setDownloadingId(e.id);
    try {
      await openEvidence(evaluationId, e.id);
    } catch (err) {
      toast.show({ variant: 'danger', message: errInfo(err).message ?? '파일을 열지 못했어요.' });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleRemove(e: EvaluationEvidence) {
    setRemovingId(e.id);
    try {
      await evidenceCommands.remove(evaluationId, e.id);
      onChanged();
    } catch (err) {
      toast.show({ variant: 'danger', message: errInfo(err).message ?? '삭제에 실패했어요.' });
    } finally {
      setRemovingId(null);
    }
  }

  if (readOnly && files.length === 0) return null;

  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground mb-1.5">
        <Paperclip size={12} aria-hidden />
        증빙 자료
        {files.length > 0 && (
          <span className="font-normal text-muted-foreground">{files.length}개</span>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-1 mb-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-none border border-border bg-muted"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openFile(f)}
                disabled={downloadingId === f.id}
                title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                className="flex items-center gap-1.5 flex-1 min-w-0 justify-start h-auto p-0"
                aria-label={f.filename}
              >
                {downloadingId === f.id ? (
                  <Loader2 size={13} className="animate-spin text-muted-foreground" aria-hidden />
                ) : isEvidencePreviewable(f.mimeType) ? (
                  <Eye size={13} className="text-primary shrink-0" aria-hidden />
                ) : (
                  <Download size={13} className="text-primary shrink-0" aria-hidden />
                )}
                <span className="truncate text-[12px] text-foreground">{f.filename}</span>
                <span className="tabular-nums text-[10.5px] text-muted-foreground shrink-0">
                  {fmtBytes(f.size)}
                </span>
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemove(f)}
                  disabled={removingId === f.id}
                  title="삭제"
                  aria-label={`${f.filename} 삭제`}
                  className="h-auto shrink-0 p-0 text-destructive"
                >
                  {removingId === f.id ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <Trash2 size={13} aria-hidden />
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            aria-hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            loading={uploading}
            leftIcon={<Paperclip size={13} aria-hidden />}
          >
            {uploading ? '업로드 중…' : '파일 첨부'}
          </Button>
          <p className="text-[10.5px] text-muted-foreground mt-1">
            문서·이미지·압축 파일, 1개당 10MB 이하
          </p>
        </>
      )}

      <EvidencePreview evaluationId={evaluationId} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
