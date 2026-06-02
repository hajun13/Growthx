'use client';

import { useId, useRef, useState } from 'react';
import { cx } from '@/lib/ui';
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
        className="text-sm text-primary-700 underline"
        target="_blank"
        rel="noreferrer"
      >
        {value.name}
      </a>
    ) : (
      <p className="text-sm text-neutral-400">첨부된 증빙이 없어요.</p>
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <span className="truncate text-sm text-neutral-700">{value.name}</span>
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
        className={cx(
          'flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-500 outline-none transition-colors duration-fast hover:border-primary-300 focus-visible:shadow-focus',
        )}
      >
        <span>파일을 첨부해 주세요</span>
        <span className="text-xs text-neutral-400">최대 {maxSizeMB}MB</span>
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
        <p id={`${id}-err`} className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
