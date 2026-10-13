'use client';

/**
 * EvidenceSection — KPI 문항별 증빙 첨부 (목록 + 업로드 + 삭제).
 * readOnly(제출 후)면 보기·다운로드만 허용.
 */
import { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { evidenceCommands, openEvidence } from '@/hooks/useEvaluations';
import { EvidencePreview, isEvidencePreviewable } from '@/components/EvidencePreview';
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
    const files = Array.from(fileList);
    let okCount = 0;
    let firstError: unknown = null;
    try {
      // 파일별 개별 처리 — 중간 실패해도 성공분은 목록에 반영한다.
      for (const f of files) {
        try {
          await evidenceCommands.upload(evaluationId, kpiId, f);
          okCount += 1;
          onChanged();
        } catch (err) {
          if (firstError === null) firstError = err;
        }
      }
      if (firstError === null) {
        toast.success('증빙 자료를 첨부했어요.');
      } else {
        toast.error(
          okCount > 0
            ? `${files.length}개 중 ${okCount}개만 첨부됐어요. ${errInfo(firstError).message ?? '나머지는 다시 시도해 주세요.'}`
            : errInfo(firstError).message ?? '첨부에 실패했어요.',
          { duration: 8000 },
        );
      }
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
      toast.error(errInfo(err).message ?? '파일을 열지 못했어요.', { duration: 8000 });
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
      toast.error(errInfo(err).message ?? '삭제에 실패했어요.', { duration: 8000 });
    } finally {
      setRemovingId(null);
    }
  }

  if (readOnly && files.length === 0) return null;

  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5 text-11h font-semibold text-muted-foreground mb-1.5">
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
              className="flex items-center gap-1 rounded-md border border-border bg-muted p-1"
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={() => openFile(f)}
                disabled={downloadingId === f.id}
                title={isEvidencePreviewable(f.mimeType) ? '사이트에서 바로 보기' : '다운로드'}
                className="min-w-0 flex-1 justify-start"
                aria-label={f.filename}
              >
                {downloadingId === f.id ? (
                  <Spinner aria-hidden role="presentation" aria-label={undefined} />
                ) : isEvidencePreviewable(f.mimeType) ? (
                  <Eye className="text-primary" aria-hidden />
                ) : (
                  <Download className="text-primary" aria-hidden />
                )}
                <span className="truncate text-12 text-foreground">{f.filename}</span>
                <span className="tabular-nums text-10h text-muted-foreground shrink-0">
                  {fmtBytes(f.size)}
                </span>
              </Button>
              {!readOnly && (
                <Button
                  variant="ghost-muted"
                  size="icon-xs"
                  onClick={() => void handleRemove(f)}
                  disabled={removingId === f.id}
                  title="삭제"
                  aria-label={`${f.filename} 삭제`}
                >
                  {removingId === f.id ? (
                    <Spinner aria-hidden role="presentation" aria-label={undefined} />
                  ) : (
                    <Trash2 className="text-destructive" aria-hidden />
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <>
          <Input
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
          >
            {!uploading && <Paperclip aria-hidden />}
            {uploading ? '업로드 중…' : '파일 첨부'}
          </Button>
          <p className="text-10h text-muted-foreground mt-1">
            문서·이미지·압축 파일, 1개당 10MB 이하
          </p>
        </>
      )}

      <EvidencePreview evaluationId={evaluationId} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
