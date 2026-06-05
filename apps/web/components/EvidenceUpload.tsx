'use client';

import { useId, useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from './Button';

export interface EvidenceUploadProps {
  value?: { url: string; name: string } | null;
  onUpload?: (file: File) => void;
  onRemove?: () => void;
  maxSizeMB?: number;
  accept?: string;
  readOnly?: boolean;
}

export function EvidenceUpload({
  value,
  onUpload,
  onRemove,
  maxSizeMB = 10,
  accept = '.pdf,.png,.jpg,.xlsx,.docx',
  readOnly,
}: EvidenceUploadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`파일이 너무 커요. 최대 ${maxSizeMB}MB까지 첨부할 수 있어요.`);
      return;
    }
    setError(null);
    onUpload?.(file);
  }

  if (readOnly) {
    return value ? (
      <a
        href={value.url}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
        target="_blank"
        rel="noreferrer"
      >
        <FileText className="h-4 w-4" aria-hidden />
        {value.name}
      </a>
    ) : (
      <p className="text-sm text-muted-foreground">첨부된 증빙이 없어요.</p>
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between border bg-muted/40 px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{value.name}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          제거
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5 border border-dashed bg-muted/40 px-4 py-6 text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/40 focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Upload className="h-5 w-5" aria-hidden />
        <span>파일을 첨부해 주세요</span>
        <span className="text-xs text-muted-foreground/70">최대 {maxSizeMB}MB</span>
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
