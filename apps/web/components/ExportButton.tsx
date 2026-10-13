'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadExcel } from '@/lib/excel';
import { ApiError } from '@/lib/api';

export interface ExportButtonProps {
  // GET /excel/export/... 경로(쿼리 포함).
  path: string;
  label?: string;
  filename?: string;
  disabled?: boolean;
}

// 엑셀 내보내기 — 인증 헤더 포함 fetch → blob 다운로드. PageHeader.right 배치.
export function ExportButton({
  path,
  label = '엑셀 내보내기',
  filename = 'export.xlsx',
  disabled,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await downloadExcel(path, filename);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : '내보내기에 실패했어요.',
        { duration: 8000 },
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      loading={loading}
      disabled={disabled}
      onClick={() => void handle()}
    >
      <Download aria-hidden />
      {label}
    </Button>
  );
}
