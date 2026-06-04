'use client';

import { useRef, useState } from 'react';
import { Download, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { InfoBanner } from './InfoBanner';
import { ResultTable } from './ResultTable';
import { Spinner } from './States';
import { downloadExcel } from '@/lib/excel';
import { ApiError } from '@/lib/api';
import { useToast } from './Toast';
import type { ImportResult } from '@/lib/types';

export interface FileDropzoneProps {
  accept?: string;
  maxSizeMB?: number;
  uploading?: boolean;
  result?: ImportResult | null;
  onSelect: (file: File) => void;
  onCommit?: () => void;
  onClear?: () => void;
  // 커밋 버튼 라벨/표시 여부(설정 임포트는 즉시 반영형이라 커밋 불필요할 수 있음).
  showCommit?: boolean;
  // 빈 양식(.xlsx) 다운로드 경로(`/api/v1` prefix 제외, 예: `/excel/template/templates`).
  // 인증 헤더가 필요한 스트림이라 단순 링크가 아닌 blob 다운로드로 받아요.
  templateHref?: string;
  // 양식 받기 버튼 라벨(기본: "양식 받기").
  templateLabel?: string;
}

// 엑셀 업로드 드롭존 — idle/drag-over/uploading/validated/error.
export function FileDropzone({
  accept = '.xlsx',
  maxSizeMB = 5,
  uploading,
  result,
  onSelect,
  onCommit,
  onClear,
  showCommit = true,
  templateHref,
  templateLabel = '양식 받기',
}: FileDropzoneProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  async function downloadTemplate() {
    if (!templateHref) return;
    setTemplateLoading(true);
    try {
      const name = templateHref.split('/').pop() ?? 'template';
      await downloadExcel(templateHref, `template-${name}.xlsx`);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : '양식을 받지 못했어요.',
      });
    } finally {
      setTemplateLoading(false);
    }
  }

  function pick(file: File | undefined) {
    if (!file) return;
    setSizeError(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setSizeError(`파일이 너무 커요. 최대 ${maxSizeMB}MB까지 올릴 수 있어요.`);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setSizeError('.xlsx 파일만 올릴 수 있어요.');
      return;
    }
    onClear?.();
    onSelect(file);
  }

  return (
    <div className="flex flex-col gap-4">
      {templateHref && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            양식이 필요하면 먼저 빈 .xlsx 양식을 내려받아 채워 주세요.
          </p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="h-4 w-4" aria-hidden />}
            loading={templateLoading}
            onClick={() => void downloadTemplate()}
          >
            {templateLabel}
          </Button>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver
            ? 'border-primary bg-primary/[0.04]'
            : 'border-border bg-muted/30',
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-foreground">
          여기로 .xlsx 파일을 끌어다 놓거나
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          파일 선택
        </Button>
        <p className="text-xs text-muted-foreground">
          .xlsx · 최대 {maxSizeMB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          aria-label="엑셀 파일 선택"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {sizeError && (
        <InfoBanner tone="warning" title="파일을 확인해 주세요">
          {sizeError}
        </InfoBanner>
      )}

      {uploading && <Spinner label="검증 중이에요" />}

      <div aria-live="polite">
        {result && !uploading && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-success-700">
                유효 {result.validCount}행
              </span>
              <span
                className={cn(
                  'font-medium',
                  result.errorCount > 0
                    ? 'text-danger-600'
                    : 'text-muted-foreground',
                )}
              >
                오류 {result.errorCount}행
              </span>
              {result.ok ? (
                <span className="text-success-700">전건 반영됐어요.</span>
              ) : (
                <span className="text-muted-foreground">
                  오류를 고친 뒤 다시 올려 주세요.
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <ResultTable
                columns={[
                  { key: 'row', label: '행', align: 'right' },
                  { key: 'message', label: '오류 메시지' },
                ]}
                rows={result.errors.map((e, i) => ({
                  _key: `${e.row}-${i}`,
                  row: e.row,
                  message: e.message,
                }))}
              />
            )}

            {showCommit && onCommit && (
              <div className="flex justify-end gap-2">
                <Button
                  onClick={onCommit}
                  disabled={result.validCount === 0 || !result.ok}
                >
                  유효한 {result.validCount}행 등록
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
