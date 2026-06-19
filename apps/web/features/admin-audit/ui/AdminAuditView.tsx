'use client';

import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Modal } from '@/components/Modal';
import { DiffViewer } from '@/components/DiffViewer';
import { ExportButton } from '@/components/ExportButton';
import { Forbidden, Skeleton } from '@/components/States';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { SearchInput } from '@/components/SearchInput';
import { FilterBar } from '@/components/FilterBar';
import { Pagination } from '@/components/Pagination';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/Button';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { isHrAdmin } from '@/lib/nav';
import {
  auditActionText,
  auditEntityText,
  auditFieldLabel,
  auditValueLabel,
} from '@/lib/ui';
import type { AuditLog } from '@/lib/types';
import { useAuditLogsData } from '../hooks';

const PAGE_SIZE = 50;

// 대상(entity) → 한글 라벨 필터 옵션
const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'RuleSet', label: '규칙 세트' },
  { value: 'EvaluationCycle', label: '평가 주기' },
  { value: 'CycleSchedule', label: '평가 일정' },
  { value: 'Kpi', label: 'KPI' },
  { value: 'KpiCategoryPolicy', label: 'KPI 분류 정책' },
  { value: 'Evaluation', label: '평가' },
  { value: 'GradePool', label: '등급 풀' },
  { value: 'Appeal', label: '이의제기' },
  { value: 'MonthlyPerformance', label: '월 실적' },
  { value: 'PositionDef', label: '직급' },
  { value: 'CompetencyQuestion', label: '역량 문항' },
];

function fmtAt(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { time: iso, date: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

// 로딩 스켈레톤
function AuditSkeleton() {
  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </PageContainer>
  );
}

export function AdminAuditView() {
  const { user } = useAuth();
  const { hasFeature } = usePermissions();
  const allowed = !!user && isHrAdmin(user.role) && hasFeature('감사로그');

  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, loading } = useAuditLogsData(
    { entity: entity || undefined, page, pageSize: PAGE_SIZE },
    { enabled: allowed },
  );
  const logs: AuditLog[] = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (!search) return true;
        const hay = `${l.actorName ?? '시스템'} ${auditActionText(l.action)} ${auditEntityText(l.entity)} ${l.entityId}`;
        return hay.includes(search);
      }),
    [logs, search],
  );

  const exportQuery = entity ? `?entity=${entity}` : '';
  const columns = useMemo<DataTableColumn<AuditLog>[]>(() => [
    {
      key: 'at',
      header: '시각',
      width: '150px',
      render: (log) => {
        const at = fmtAt(log.at);
        return (
          <div className="tabular-nums">
            <div className="text-[12px] font-semibold text-foreground">{at.time}</div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">{at.date}</div>
          </div>
        );
      },
    },
    {
      key: 'actorName',
      header: '행위자',
      width: '110px',
      render: (log) => (
        <span className="text-[12.5px] font-semibold text-foreground">
          {log.actorName ?? <span className="font-normal text-muted-foreground">시스템</span>}
        </span>
      ),
    },
    {
      key: 'action',
      header: '액션',
      render: (log) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
            {auditEntityText(log.entity)}
          </span>
          <span className="truncate text-[12px] text-foreground">{auditActionText(log.action)}</span>
        </div>
      ),
    },
    {
      key: 'entityId',
      header: '대상',
      render: (log) => (
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {auditEntityText(log.entity)} #{log.entityId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'detail',
      header: '상세',
      width: '90px',
      render: (log) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(log);
          }}
        >
          변경 보기
        </Button>
      ),
    },
  ], []);

  if (!allowed) {
    return <Forbidden message="감사 로그 열람 권한이 없어요. HR 관리자에게 문의하세요." />;
  }

  if (loading && !data) return <AuditSkeleton />;

  const actorCount = new Set(logs.map((l) => l.actorName ?? '시스템')).size;
  const systemCount = logs.filter((l) => !l.actorName).length;

  return (
    <PageContainer>
      <PageHeader
        title="감사 로그"
        subtitle="민감한 변경 이력을 조회하고 변경 내역을 비교합니다."
        right={
          <div className="flex items-center gap-2.5 flex-wrap">
            <HeaderMetrics
              items={[
                { label: '현재 페이지', value: logs.length.toLocaleString() },
                { label: '전체 로그', value: total.toLocaleString() },
                { label: '행위자', value: actorCount.toLocaleString() },
                { label: '시스템 작업', value: systemCount.toLocaleString() },
              ]}
            />
          </div>
        }
      />

      <FilterBar
        resultLabel={`${filtered.length.toLocaleString()}건`}
        onReset={search || entity ? () => { setSearch(''); setEntity(''); setPage(1); } : undefined}
        actions={
          <ExportButton
            path={`/excel/export/audit${exportQuery}`}
            label="로그 내보내기"
            filename="audit-logs.xlsx"
          />
        }
      >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="행위자, 액션, 대상 검색..."
            className="min-w-[240px]"
          />
          <select
            value={entity}
            onChange={(event) => { setEntity(event.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground"
            aria-label="대상 필터"
          >
            {ENTITY_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FilterBar>

      <DataTable
        title="변경 이력"
        description="행을 선택하면 변경 전후 값을 비교합니다."
        columns={columns}
        rows={filtered}
        rowKey={(log) => log.id}
        onRowClick={setSelected}
        loading={loading}
        loadingRows={7}
        stickyHeader
        emphasizeHeader
        wrapperClassName="overflow-hidden rounded-lg border border-border/80 bg-card"
        className="min-w-[760px]"
        empty={(
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Shield size={32} className="text-border" strokeWidth={1.5} aria-hidden />
            <p className="text-[13px] text-muted-foreground">
              {search || entity ? '해당 조건의 로그가 없어요.' : '아직 감사 로그가 없어요.'}
            </p>
            {(search || entity) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setSearch(''); setEntity(''); setPage(1); }}
              >
                필터 초기화
              </Button>
            )}
          </div>
        )}
        footer={total > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-muted-foreground">
              전체 <b className="text-foreground">{total.toLocaleString()}</b>건 · {page}/{totalPages} 페이지
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      />

      {/* 변경 내역 모달 */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`변경 내역 — ${selected ? auditActionText(selected.action) : ''}`}
        size="lg"
        secondaryAction={{ label: '닫기', onClick: () => setSelected(null) }}
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3">
              <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                {auditEntityText(selected.entity)}
              </span>
              <span className="text-[12px] font-semibold text-foreground">
                {selected.actorName ?? '시스템'}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {fmtAt(selected.at).date} {fmtAt(selected.at).time}
              </span>
              <span className="text-[11.5px] text-muted-foreground ml-auto">
                #{selected.entityId.slice(0, 8)}
              </span>
            </div>
            <DiffViewer
              before={selected.before}
              after={selected.after}
              fieldLabels={auditFieldLabel}
              valueLabels={auditValueLabel}
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
