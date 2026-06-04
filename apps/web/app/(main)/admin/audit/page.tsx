'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useUsers } from '@/hooks/useUsers';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import {
  AuditFilterBar,
  type AuditFilterValue,
} from '@/components/AuditFilterBar';
import { ResultTable } from '@/components/ResultTable';
import { Modal } from '@/components/Modal';
import { DiffViewer } from '@/components/DiffViewer';
import { Button } from '@/components/Button';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { auditActionText, auditEntityText } from '@/lib/ui';
import type { AuditLog } from '@/lib/types';

const PAGE_SIZE = 50;

function fmtAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditPage() {
  const { user } = useAuth();
  const allowed = !!user && isHrAdmin(user.role);

  // 적용 버튼 누른 필터(쿼리에 반영) vs 편집 중 필터(드래프트) 분리.
  const [draft, setDraft] = useState<AuditFilterValue>({});
  const [applied, setApplied] = useState<AuditFilterValue>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data: usersData } = useUsers({}, { enabled: allowed });
  const actors = useMemo(
    () => (usersData?.data ?? []).map((u) => ({ id: u.id, name: u.name })),
    [usersData],
  );

  const { data, loading, error, reload } = useAuditLogs(
    { ...applied, page, pageSize: PAGE_SIZE },
    { enabled: allowed },
  );
  const logs: AuditLog[] = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 적용된 필터(actorId·action·entity·from·to)를 export/audit 쿼리로 직렬화.
  // (페이지네이션 없이 매칭 전건을 .xlsx 로 받음.)
  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.actorId) params.set('actorId', applied.actorId);
    if (applied.action) params.set('action', applied.action);
    if (applied.entity) params.set('entity', applied.entity);
    if (applied.from) params.set('from', applied.from);
    if (applied.to) params.set('to', applied.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [applied]);

  if (!allowed) {
    return <Forbidden message="감사 로그는 HR만 접근할 수 있어요." />;
  }

  const logById = useMemo(
    () => new Map(logs.map((l) => [l.id, l])),
    [logs],
  );
  const rows = logs.map((log) => ({
    _key: log.id,
    at: fmtAt(log.at),
    actor: log.actorName ?? '시스템',
    action: auditActionText(log.action),
    entity: `${auditEntityText(log.entity)} #${log.entityId.slice(0, 8)}`,
    detail: (
      <Button variant="ghost" size="sm" onClick={() => setSelected(log)}>
        변경 보기
      </Button>
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="감사 로그"
        subtitle="민감한 변경 이력을 조회하고 변경 내역을 비교하세요."
        right={
          <ExportButton
            path={`/excel/export/audit${exportQuery}`}
            label="감사 로그 내보내기"
            filename="audit-logs.xlsx"
          />
        }
      />

      <AuditFilterBar
        value={draft}
        actors={actors}
        onChange={setDraft}
        onApply={() => {
          setPage(1);
          setApplied(draft);
        }}
        onReset={() => {
          setDraft({});
          setApplied({});
          setPage(1);
        }}
      />

      <Card title="변경 이력">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : logs.length === 0 ? (
          <EmptyState title="해당 조건의 로그가 없어요." />
        ) : (
          <>
            <ResultTable
              columns={[
                { key: 'at', label: '시각' },
                { key: 'actor', label: '행위자' },
                { key: 'action', label: '액션' },
                { key: 'entity', label: '대상' },
                { key: 'detail', label: '상세', align: 'right' },
              ]}
              rows={rows}
              onRowClick={(row) => {
                const key = (row as { _key?: string })._key;
                const log = key ? logById.get(key) : undefined;
                if (log) setSelected(log);
              }}
            />
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                전체 {total}건 · {page}/{totalPages} 페이지
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  다음
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`변경 내역 — ${selected ? auditActionText(selected.action) : ''}`}
        size="lg"
        secondaryAction={{ label: '닫기', onClick: () => setSelected(null) }}
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {selected.actorName ?? '시스템'} · {fmtAt(selected.at)} ·{' '}
              {auditEntityText(selected.entity)} #{selected.entityId.slice(0, 8)}
            </p>
            <DiffViewer before={selected.before} after={selected.after} />
          </div>
        )}
      </Modal>
    </div>
  );
}
