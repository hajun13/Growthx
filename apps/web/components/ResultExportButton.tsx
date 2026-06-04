'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadExcel, fetchBlob } from '@/lib/excel';
import { ApiError } from '@/lib/api';
import { useToast } from './Toast';

export interface ResultExportButtonProps {
  userId: string;
  cycleId: string | null;
  label?: string;
}

// M3 Item 9: 평가 결과 PDF/Excel 다운로드.
// PDF: 인증 fetch → blob → 새 탭(브라우저 인쇄). Excel: blob 다운로드.
export function ResultExportButton({
  userId,
  cycleId,
  label = '결과 다운로드',
}: ResultExportButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function exportPath(format: 'pdf' | 'excel'): string {
    const qs = new URLSearchParams();
    if (cycleId) qs.set('cycleId', cycleId);
    qs.set('format', format);
    return `/results/${userId}/export?${qs.toString()}`;
  }

  async function handlePdf() {
    setBusy(true);
    try {
      // 인증 헤더 포함 fetch → blob → 새 탭에서 열기(인쇄).
      const blob = await fetchBlob(exportPath('pdf'));
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // 탭이 blob 을 읽을 시간을 준 뒤 해제.
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : 'PDF 생성에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExcel() {
    setBusy(true);
    try {
      await downloadExcel(exportPath('excel'), `result-${userId}.xlsx`);
    } catch (err) {
      toast.show({
        variant: 'danger',
        message:
          err instanceof ApiError ? err.message : 'Excel 내보내기에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            leftIcon={<Download className="h-4 w-4" aria-hidden />}
          >
            {label}
            <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handlePdf()}>
          <FileText className="h-4 w-4" aria-hidden />
          PDF로 인쇄
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleExcel()}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel 다운로드
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
