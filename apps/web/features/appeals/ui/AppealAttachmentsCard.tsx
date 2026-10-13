'use client';

// 첨부파일 섹션 — 상세 카드 안에 임베드(2026-07-02 목업 정렬).
// 파일 타입별 컬러 아이콘 칩 + 다운로드/삭제 + [파일 추가]. (백엔드 AppealAttachment 실배선)
import { useRef, useState } from 'react';
import { Download, File, FileImage, FileSpreadsheet, FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { useAppealAttachments, type AppealAttachment } from '../hooks';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// 확장자 → 아이콘·색 (xlsx 초록 / pdf 빨강 / 이미지 보라 / 기타 회색) — 정적 클래스(등급 토큰과 동일 값).
function fileIcon(filename: string): { Icon: typeof File; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return { Icon: FileSpreadsheet, color: 'text-grade-a' };
  if (ext === 'pdf') return { Icon: FileText, color: 'text-grade-d' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { Icon: FileImage, color: 'text-grade-s' };
  return { Icon: File, color: 'text-neutral-500' };
}

interface Props {
  appealId: string;
  /** 업로드/삭제 허용 — 신청자 본인 또는 HR(행 수준 소유권은 백엔드가 재검증). */
  canUpload: boolean;
}

export function AppealAttachmentsCard({ appealId, canUpload }: Props) {
  const { items, loading, uploading, upload, download, remove } = useAppealAttachments(appealId, true);
  const fileRef = useRef<HTMLInputElement>(null);
  // 삭제 확인 모달 대상 — X 클릭 즉시 삭제 방지.
  const [deleteTarget, setDeleteTarget] = useState<AppealAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success(`첨부파일 "${deleteTarget.filename}"을 삭제했어요.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '첨부파일 삭제에 실패했어요.', { duration: 8000 });
    } finally {
      setDeleting(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      await upload(file);
      toast.success('첨부파일을 업로드했어요.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '업로드에 실패했어요. (10MB 이하만 가능)', {
        duration: 8000,
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDownload(att: AppealAttachment) {
    try {
      await download(att);
    } catch {
      toast.error('다운로드에 실패했어요.', { duration: 8000 });
    }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-13 font-bold text-foreground">
          첨부파일
          {items.length > 0 && <span className="ml-1 font-normal text-muted-foreground">({items.length})</span>}
        </span>
        {canUpload && (
          <>
            {/* eslint-disable-next-line no-restricted-syntax -- 숨김 파일 선택 input(L1 에 file-picker 없음) */}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              {!uploading && <Upload size={12} aria-hidden />}
              파일 추가
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-12 text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-12 text-muted-foreground">
          계약서·실적자료 등 증빙 자료를 첨부할 수 있어요. (파일당 10MB 이하)
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((att) => {
            const { Icon, color } = fileIcon(att.filename);
            return (
              <span
                key={att.id}
                className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-card py-2 pl-3 pr-1.5"
              >
                <Icon size={15} className={`shrink-0 ${color}`} aria-hidden />
                <span className="max-w-45 truncate text-12h font-medium text-foreground">{att.filename}</span>
                <span className="shrink-0 text-11 tabular-nums text-muted-foreground">{fmtSize(att.size)}</span>
                <Button
                  variant="ghost-muted"
                  size="icon-2xs"
                  aria-label={`${att.filename} 다운로드`}
                  onClick={() => void handleDownload(att)}
                >
                  <Download size={13} aria-hidden />
                </Button>
                {canUpload && (
                  <Button
                    variant="ghost-muted"
                    size="icon-2xs"
                    aria-label={`${att.filename} 삭제`}
                    onClick={() => setDeleteTarget(att)}
                  >
                    <Trash2 size={13} aria-hidden />
                  </Button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent size="sm" layout="scroll-footer">
          <DialogHeader>
            <DialogTitle>첨부파일을 삭제할까요?</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto text-sm text-foreground">
            &ldquo;{deleteTarget?.filename}&rdquo; 파일을 삭제해요. 이 작업은 되돌릴 수 없어요.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" loading={deleting} disabled={deleting} onClick={() => void confirmDelete()}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
