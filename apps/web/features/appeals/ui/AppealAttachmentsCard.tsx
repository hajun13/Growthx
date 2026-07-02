'use client';

// 첨부파일 섹션 — 상세 카드 안에 임베드(2026-07-02 목업 정렬).
// 파일 타입별 컬러 아이콘 칩 + 다운로드/삭제 + [파일 추가]. (백엔드 AppealAttachment 실배선)
import { useRef } from 'react';
import { Download, File, FileImage, FileSpreadsheet, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/Button';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { useAppealAttachments, type AppealAttachment } from '../hooks';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// 확장자 → 아이콘·색 (xlsx 초록 / pdf 빨강 / 이미지 보라 / 기타 회색)
function fileIcon(filename: string): { Icon: typeof File; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return { Icon: FileSpreadsheet, color: '#0EA05E' };
  if (ext === 'pdf') return { Icon: FileText, color: '#EF4444' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { Icon: FileImage, color: '#7C3AED' };
  return { Icon: File, color: '#6B7280' };
}

interface Props {
  appealId: string;
  /** 업로드/삭제 허용 — 신청자 본인 또는 HR(행 수준 소유권은 백엔드가 재검증). */
  canUpload: boolean;
}

export function AppealAttachmentsCard({ appealId, canUpload }: Props) {
  const toast = useToast();
  const { items, loading, uploading, upload, download, remove } = useAppealAttachments(appealId, true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      await upload(file);
      toast.show({ variant: 'success', message: '첨부파일을 업로드했어요.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '업로드에 실패했어요. (10MB 이하만 가능)',
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDownload(att: AppealAttachment) {
    try {
      await download(att);
    } catch {
      toast.show({ variant: 'danger', message: '다운로드에 실패했어요.' });
    }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-foreground">
          첨부파일
          {items.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({items.length})</span>}
        </span>
        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="secondary"
              loading={uploading}
              leftIcon={<Upload size={12} aria-hidden />}
              onClick={() => fileRef.current?.click()}
            >
              파일 추가
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-[12px] text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          계약서·실적자료 등 증빙 자료를 첨부할 수 있어요. (파일당 10MB 이하)
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((att) => {
            const { Icon, color } = fileIcon(att.filename);
            return (
              <span
                key={att.id}
                className="inline-flex max-w-full items-center gap-2 rounded-[8px] border border-border bg-card py-2 pl-3 pr-1.5"
              >
                <Icon size={15} style={{ color }} className="shrink-0" aria-hidden />
                <span className="max-w-[180px] truncate text-[12.5px] font-medium text-foreground">{att.filename}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtSize(att.size)}</span>
                <button
                  type="button"
                  aria-label={`${att.filename} 다운로드`}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => void handleDownload(att)}
                >
                  <Download size={13} aria-hidden />
                </button>
                {canUpload && (
                  <button
                    type="button"
                    aria-label={`${att.filename} 삭제`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => void remove(att.id)}
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
