'use client';

// 파일 목록의 한 행 — 파일명·대상자·미리보기/적재/제출 액션·상태·경고·편집 그리드·결과.
import { AlertTriangle, Eye, Send, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesignLabel } from '@/components/DesignLabel';
import { UserCombobox } from '@/components/UserCombobox';
import type { User, KpiImportRow } from '@/lib/types';
import { EditableGrid } from './EditableGrid';
import { ImportStatusBadge, ResultCard } from './ImportParts';
import { entryNeedsReview, type FileEntry } from './importModel';

export function FileEntryRow({
  entry,
  users,
  usersLoading,
  duplicateUser,
  onUserChange,
  onPreview,
  onImport,
  onSubmit,
  onRemove,
  onRowsChange,
}: {
  entry: FileEntry;
  users: User[];
  usersLoading: boolean;
  duplicateUser: boolean;
  onUserChange: (id: string | null) => void;
  onPreview: () => void;
  onImport: () => void;
  onSubmit: () => void;
  onRemove: () => void;
  onRowsChange: (rows: KpiImportRow[]) => void;
}) {
  const warnCount = entry.preview ? (entry.preview.warnings?.length ?? 0) + entry.preview.errors.length : 0;
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      {/* 행 헤더 */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span
          className="text-12h font-semibold text-foreground flex-1 min-w-0 truncate"
          title={entry.file.name}
        >
          {entry.file.name}
        </span>

        <UserCombobox
          users={users}
          value={entry.userId}
          suggestedId={entry.suggestedId}
          disabled={usersLoading || entry.status === 'importing'}
          onChange={onUserChange}
        />

        {entry.userId && duplicateUser && (
          <DesignLabel tone="amber" className="gap-1" title="같은 대상자에게 파일이 2개 이상 매칭됐어요.">
            <AlertTriangle size={12} aria-hidden />
            대상자 중복 — 나중 적재가 먼저 적재를 교체해요
          </DesignLabel>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={entry.status === 'previewing' || entry.status === 'importing' || entry.status === 'submitting'}
          onClick={onPreview}
        >
          <Eye className="size-3.5" />
          {entry.editedRows ? '다시 불러오기' : '미리보기'}
        </Button>

        <Button size="sm" disabled={!entry.userId || entry.status === 'importing'} onClick={onImport}>
          <Upload className="size-3.5" />
          적재
        </Button>

        {entry.status === 'imported' && (
          <Button size="sm" onClick={onSubmit}>
            <Send className="size-3.5" />
            제출
          </Button>
        )}

        <ImportStatusBadge status={entry.status} needsReview={entryNeedsReview(entry)} />

        <Button
          variant="tab"
          size="icon-xs"
          onClick={onRemove}
          disabled={entry.status === 'importing'}
          aria-label="파일 제거"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      {entry.errorMessage && (
        <p className="text-11h text-danger-700 mt-1.5">{entry.errorMessage}</p>
      )}

      {/* 파싱 경고·오류(미리보기 응답) — 자동 분류·두 번째 표 미수집·해당 없음 행 제외 등 고지.
          적재/제출 후에도 유실하지 않고 접힘(details) 형태로 유지한다. */}
      {entry.preview && warnCount > 0 && (
        <details
          className="mt-2 border border-warning-500/40 bg-warning-50 rounded-md px-3.5 py-2"
          open={entry.status !== 'imported' && entry.status !== 'submitted'}
        >
          <summary className="cursor-pointer text-11h font-semibold text-warning-700">
            파싱 경고·오류 {warnCount}건
          </summary>
          <ul className="mt-1 pl-4 list-disc">
            {(entry.preview.warnings ?? []).map((w, i) => (
              <li key={`w-${i}`} className="text-11h text-warning-700">{w}</li>
            ))}
            {entry.preview.errors.map((e, i) => (
              <li key={`e-${i}`} className="text-11h text-danger-700">{e.row}행: {e.message}</li>
            ))}
          </ul>
        </details>
      )}

      {/* 편집 가능한 미리보기 그리드 */}
      {entry.editedRows && entry.status !== 'imported' && entry.status !== 'submitting' && entry.status !== 'submitted' && (
        <EditableGrid
          rows={entry.editedRows}
          onChange={onRowsChange}
          readOnly={entry.status === 'importing'}
        />
      )}

      <ResultCard entry={entry} />
    </div>
  );
}
