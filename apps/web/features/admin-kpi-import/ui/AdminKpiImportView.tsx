'use client';

// 개인별 KPI 엑셀 일괄 임포트(관리자 전용) — admin-kpi-import 수직 슬라이스의 화면.
// 흐름(kpi-import-contract.md §5):
//   1) 다중 .xlsx 드래그&드롭 → 파일 목록(행).
//   2) 행마다: 파일명 / 대상자 선택(검색형 콤보) / 미리보기 / 상태.
//   3) 미리보기 = previewKpi(file) → 파싱 KPI 표 + 가중치합/오류.
//   4) 파일별 [적재] 또는 [전체 적재] = commitKpi(JSON) (draft 생성).
//   5) 결과 요약(파일별 imported/오류/경고) + 검토 경로 안내.
import { useEffect, useMemo, useState } from 'react';
import { UploadCloud, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { ApiError } from '@/lib/api';
import { InfoBanner } from '@/components/InfoBanner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { isHrAdmin } from '@/lib/nav';
import { cycleStatusText } from '@/lib/ui';
import type {
  User,
  KpiImportRow,
  KpiImportCommitRow,
  KpiCategory,
  KpiGroup,
} from '@/lib/types';
import { useKpiImport } from '../hooks';
import type { KpiImportPreview, KpiImportCommitRequest } from '../api';
import { Forbidden } from './StateBlocks';
import { FileEntryRow } from './FileEntryRow';
import { ImportStepper, SectionCard } from './ImportParts';
import { MAX_MB, entryNeedsReview, guessUserId, type FileEntry } from './importModel';

// ── 메인 뷰 ──────────────────────────────────────────────────────
export function AdminKpiImportView() {
  const { user } = useAuth();
  const { preview, commit, submit } = useKpiImport();
  const allowed = !!user && isHrAdmin(user.role);

  const { current, loading: cycleLoading } = useCurrentCycle();
  const cycleId = current?.id ?? null;

  const { data: usersData, loading: usersLoading } = useUsers({ pageSize: 500 }, { enabled: allowed });
  const users = useMemo<User[]>(() => (usersData?.data ?? []).filter((u) => u.isActive), [usersData]);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [reparseTarget, setReparseTarget] = useState<FileEntry | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: FileEntry[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        toast.error(`${file.name}: .xlsx 파일만 올릴 수 있어요.`, { duration: 8000 });
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name}: 최대 ${MAX_MB}MB까지 올릴 수 있어요.`, { duration: 8000 });
        continue;
      }
      // 동일 파일(이름+크기) 재추가 방지 — 목록·이번 선택 양쪽과 대조.
      const isDup =
        entries.some((e) => e.file.name === file.name && e.file.size === file.size) ||
        next.some((e) => e.file.name === file.name && e.file.size === file.size);
      if (isDup) {
        toast(`${file.name}: 이미 추가된 파일이에요.`);
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file, userId: guessUserId(file.name, users), suggestedId: guessUserId(file.name, users),
        status: 'idle', preview: null, editedRows: null, result: null, errorMessage: null,
      });
    }
    if (next.length > 0) setEntries((prev) => [...prev, ...next]);
  }

  function patchEntry(key: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function patchEditedRows(key: string, rows: KpiImportRow[]) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, editedRows: rows } : e)));
  }
  function removeEntry(key: string) { setEntries((prev) => prev.filter((e) => e.key !== key)); }

  // users 로딩 전에 추가된 파일은 자동 매칭이 비어 있음 — users 도착 시 미매칭 항목 재매칭.
  useEffect(() => {
    if (users.length === 0) return;
    setEntries((prev) => {
      let changed = false;
      const next = prev.map((e) => {
        if (e.userId || e.suggestedId) return e;
        const guess = guessUserId(e.file.name, users);
        if (!guess) return e;
        changed = true;
        return { ...e, userId: guess, suggestedId: guess };
      });
      return changed ? next : prev;
    });
  }, [users]);

  async function doPreview(entry: FileEntry): Promise<{ rows: KpiImportRow[]; preview: KpiImportPreview } | null> {
    patchEntry(entry.key, { status: 'previewing', errorMessage: null });
    try {
      const result = await preview(entry.file);
      const editedRows: KpiImportRow[] = result.rows.map((r) => ({
        category: r.category as KpiCategory, group: r.group as KpiGroup,
        csf: r.csf, title: r.title, targetText: r.targetText, measureMethod: r.measureMethod,
        weight: r.weight, isQualitative: r.isQualitative,
        gradingCriteria: r.gradingCriteria
          ? { S: r.gradingCriteria.S ?? null, A: r.gradingCriteria.A ?? null, B: r.gradingCriteria.B ?? null, C: r.gradingCriteria.C ?? null, D: r.gradingCriteria.D ?? null }
          : null,
        valid: r.valid, message: r.message, source: r.source,
      }));
      patchEntry(entry.key, { status: 'previewed', preview: result, editedRows });
      return { rows: editedRows, preview: result };
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '미리보기에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.error(msg, { duration: 8000 });
      return null;
    }
  }

  function toCommitRows(rows: KpiImportRow[]): KpiImportCommitRow[] {
    return rows.filter((r) => r.title.trim().length > 0).map((r) => ({
      category: r.category, group: r.group, csf: r.csf, title: r.title.trim(),
      targetText: r.targetText, measureMethod: r.measureMethod,
      weight: Math.max(0, Math.min(100, Math.trunc(r.weight ?? 0))),
      isQualitative: r.isQualitative, gradingCriteria: r.gradingCriteria,
    }));
  }

  async function doImport(entry: FileEntry): Promise<boolean> {
    if (!entry.userId) {
      toast.error(`${entry.file.name}: 대상자를 먼저 선택해 주세요.`, { duration: 8000 });
      return false;
    }
    let rows = entry.editedRows;
    if (!rows) {
      const previewed = await doPreview(entry);
      if (!previewed) return false;
      rows = previewed.rows;
    }
    const commitRows = toCommitRows(rows);
    if (commitRows.length === 0) {
      patchEntry(entry.key, { status: 'error', errorMessage: 'KPI 명이 채워진 행이 없어요.' });
      toast.error(`${entry.file.name}: 적재할 행이 없어요.`, { duration: 8000 });
      return false;
    }
    patchEntry(entry.key, { status: 'importing', errorMessage: null });
    try {
      const body: KpiImportCommitRequest = { userId: entry.userId, cycleId: cycleId ?? undefined, fileName: entry.file.name, rows: commitRows };
      const result = await commit(body);
      patchEntry(entry.key, { status: 'imported', result });
      return true;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '적재에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.error(msg, { duration: 8000 });
      return false;
    }
  }

  const [bulkBusy, setBulkBusy] = useState(false);
  async function importAll() {
    // 제출 완료/제출 중 파일은 재적재 대상에서 제외(제출된 KPI 를 draft 로 다시 덮지 않음).
    const targets = entries.filter(
      (e) => e.userId && e.status !== 'imported' && e.status !== 'importing' && e.status !== 'submitted' && e.status !== 'submitting',
    );
    if (targets.length === 0) {
      toast('적재할 파일이 없어요. 대상자를 선택했는지 확인해 주세요.');
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let skipped = 0;
    for (const e of targets) {
      // 미리보기가 없으면 먼저 파싱해 검토 신호를 확인한다.
      let rows = e.editedRows;
      let previewData = e.preview;
      if (!rows) {
        const previewed = await doPreview(e);
        if (!previewed) continue;
        rows = previewed.rows;
        previewData = previewed.preview;
      }
      // 무효 행·파싱 경고가 있는 파일은 무경고 자동 커밋하지 않는다 — '검토 필요'로 정지.
      if (entryNeedsReview({ preview: previewData, editedRows: rows })) {
        skipped += 1;
        patchEntry(e.key, { status: 'previewed', preview: previewData, editedRows: rows });
        continue;
      }
      const success = await doImport({ ...e, editedRows: rows, preview: previewData });
      if (success) ok += 1;
    }
    setBulkBusy(false);
    const skippedNote = skipped > 0 ? ` ${skipped}개 파일은 검토가 필요해 건너뛰었어요(내용 확인 후 파일별 적재).` : '';
    const summary = `${ok}/${targets.length}개 파일을 적재했어요.${skippedNote}`;
    if (ok === targets.length) toast.success(summary);
    else toast(summary);
  }

  async function doSubmit(entry: FileEntry) {
    if (!entry.userId) return;
    patchEntry(entry.key, { status: 'submitting', errorMessage: null });
    try {
      const res = await submit({ userId: entry.userId, cycleId: cycleId ?? undefined });
      patchEntry(entry.key, { status: 'submitted' });
      toast.success(`${res.submitted}개 KPI를 제출했어요.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '제출에 실패했어요.';
      patchEntry(entry.key, { status: 'error', errorMessage: msg });
      toast.error(msg, { duration: 8000 });
    }
  }

  if (!allowed) return <Forbidden message="KPI 일괄 등록은 HR만 접근할 수 있어요." />;
  if (cycleLoading) return <Skeleton className="h-64 w-full" />;

  const selectedCount = entries.filter((e) => e.userId).length;
  const importedCount = entries.filter((e) => e.status === 'imported' || e.status === 'submitted').length;
  // 같은 대상자가 2개 이상 파일에 매칭 — 나중 적재가 먼저 적재를 교체하므로 경고 배지.
  const dupUserIds = (() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.userId) counts.set(e.userId, (counts.get(e.userId) ?? 0) + 1);
    }
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([id]) => id));
  })();

  const importStep = (() => {
    if (importedCount > 0) return 3;
    if (entries.some((e) => e.status === 'previewed' || e.status === 'importing')) return 2;
    if (entries.length > 0) return 1;
    return 0;
  })();
  // 스피너는 실제 처리 중에만 — 사용자 입력 대기(active) 단계는 정적 아이콘.
  const stepProcessing =
    bulkBusy || entries.some((e) => e.status === 'previewing' || e.status === 'importing' || e.status === 'submitting');

  return (
    <PageContainer>
      <PageHeader
        title="KPI 일괄 등록"
        subtitle={`회사 표준 KPI 엑셀 양식(1인 1파일)을 올려 개인별 KPI를 한 번에 등록합니다.${current ? ` 적재 대상 주기: ${current.name}(${cycleStatusText(current.status)})` : ''}`}
      />

      {/* 활성 사이클 안내 */}
      {!current && (
        <InfoBanner tone="warning" title="활성 평가 주기가 없어요">
          평가 운영에서 평가 주기를 먼저 만들고 활성화한 뒤 KPI를 등록해 주세요.
        </InfoBanner>
      )}

      {/* 적재 규칙 안내 — 부제(1줄)에서 분리한 상세 가이드 */}
      <InfoBanner tone="info" title="적재 규칙">
        <ul className="list-disc space-y-0.5 pl-4">
          <li>시트에는 이름이 없으니 파일마다 대상자를 직접 선택해 주세요.</li>
          <li>미리보기에서 정성/정량과 내용을 검토·수정한 뒤 적재하세요. 빠진 항목은 직접 채우거나 행을 추가할 수 있어요.</li>
          <li>적재된 KPI는 draft(임시저장) 상태로 생성되며, 같은 대상자·주기로 다시 올리면 기존 draft·제출본을 교체해요(결재 진행·확정 KPI는 보존).</li>
          <li>적재 후 나타나는 [제출] 버튼으로 바로 제출할 수 있어요(가중치 합 100% 필요).</li>
        </ul>
      </InfoBanner>

      {/* 임포트 단계 진행 표시 */}
      <ImportStepper step={importStep} processing={stepProcessing} />

      {/* 드롭존(다중) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-lg py-10 px-5 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'}`}
      >
        <UploadCloud size={36} className={dragOver ? 'text-primary' : 'text-muted-foreground'} aria-hidden />
        <p className={`text-sm font-semibold ${dragOver ? 'text-primary' : 'text-muted-foreground'}`}>
          {dragOver ? '여기에 놓으세요!' : '여러 개의 .xlsx 파일을 끌어다 놓거나'}
        </p>
        <Button asChild variant="outline" size="sm">
          <label className="cursor-pointer">
            파일 선택
            {/* eslint-disable-next-line no-restricted-syntax -- 숨김 파일 선택 input: L1 에 file input 프리미티브가 없음(label 이 트리거) */}
            <input type="file" accept=".xlsx" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </Button>
        <p className="text-11h text-muted-foreground">.xlsx · 파일당 최대 {MAX_MB}MB · 다중 선택 가능</p>
      </div>

      {/* 파일 목록 */}
      {entries.length > 0 && (
        <SectionCard
          title={`파일 ${entries.length}개`}
          action={
            <div className="flex items-center gap-2.5">
              <span className="text-11h text-muted-foreground">대상자 선택 {selectedCount} · 적재 완료 {importedCount}</span>
              <Button
                size="sm"
                loading={bulkBusy}
                disabled={selectedCount === 0 || !!cycleLoading}
                onClick={() => void importAll()}
              >
                <Upload className="size-3.5" />
                {bulkBusy ? '적재 중…' : '전체 적재'}
              </Button>
            </div>
          }
        >
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <FileEntryRow
                key={entry.key}
                entry={entry}
                users={users}
                usersLoading={usersLoading}
                duplicateUser={!!entry.userId && dupUserIds.has(entry.userId)}
                onUserChange={(id) => patchEntry(entry.key, { userId: id })}
                onPreview={() => {
                  if (entry.editedRows) setReparseTarget(entry);
                  else void doPreview(entry);
                }}
                onImport={() => void doImport(entry)}
                onSubmit={() => void doSubmit(entry)}
                onRemove={() => removeEntry(entry.key)}
                onRowsChange={(rows) => patchEditedRows(entry.key, rows)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* 재파싱 손실 경고 */}
      <AlertDialog open={reparseTarget !== null} onOpenChange={(o) => { if (!o) setReparseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>파일에서 다시 불러올까요?</AlertDialogTitle>
            <AlertDialogDescription>
              엑셀에서 다시 불러오면 이 파일에 편집·적재한 내용이 사라지고 원본 값으로 돌아가요. 계속할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const t = reparseTarget;
                setReparseTarget(null);
                if (t) void doPreview(t);
              }}
            >
              다시 불러오기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
