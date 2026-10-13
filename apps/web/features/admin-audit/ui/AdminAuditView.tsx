'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ExportButton } from '@/components/ExportButton';
import { Forbidden } from './Forbidden';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { FilterChipBar } from '@/components/FilterChipBar';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { isHrAdmin } from '@/lib/nav';
import { auditActionText, auditEntityText } from '@/lib/ui';
import type { AuditLog } from '@/lib/types';
import { useAuditLogsData } from '../hooks';
import { AuditDetailDialog } from './AuditDetailDialog';
import { AuditPagination } from './AuditPagination';
import { AuditTable } from './AuditTable';

const PAGE_SIZE = 50;

// 대상(entity) → 한글 라벨 필터 옵션
// 'user'(사용자 라이프사이클·연봉)·'PermissionConfig'(권한 설정)는 백엔드가 실기록하는 엔티티인데
// 필터에 빠져 있어 걸러 볼 수 없었다(2026-07-08 추가).
const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'user', label: '사용자' },
  { value: 'PermissionConfig', label: '권한 설정' },
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

// lib/ui auditEntityLabel 에 없는 엔티티의 한글 라벨 보강(소유 파일 범위 내 오버레이).
const LOCAL_ENTITY_LABEL: Record<string, string> = {
  user: '사용자',
  PermissionConfig: '권한 설정',
};
function entityText(entity: string): string {
  return LOCAL_ENTITY_LABEL[entity] ?? auditEntityText(entity);
}

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
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-80 w-full" />
    </PageContainer>
  );
}

export function AdminAuditView() {
  const { user } = useAuth();
  const { hasFeature, loading: permLoading } = usePermissions();
  const isAdminUser = !!user && isHrAdmin(user.role);
  const allowed = isAdminUser && hasFeature('감사로그');

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
        const hay = `${l.actorName ?? '시스템'} ${auditActionText(l.action)} ${entityText(l.entity)} ${l.entityId}`;
        return hay.includes(search);
      }),
    [logs, search],
  );

  const exportQuery = entity ? `?entity=${entity}` : '';

  // 권한 매트릭스 로딩 중에는 fail-closed(hasFeature=false)라 Forbidden 이 잠깐 번쩍임 —
  // HR 관리자는 로딩이 끝날 때까지 스켈레톤을 보여준다.
  if (isAdminUser && permLoading) return <AuditSkeleton />;

  if (!allowed) {
    return <Forbidden message="감사 로그 열람 권한이 없어요. HR 관리자에게 문의하세요." />;
  }

  if (loading && !data) return <AuditSkeleton />;

  const actorCount = new Set(logs.map((l) => l.actorName ?? '시스템')).size;
  const systemCount = logs.filter((l) => !l.actorName).length;
  const SEARCH_LABEL = '현재 페이지 내 검색 (행위자·액션·대상)';

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
            <ExportButton
              path={`/excel/export/audit${exportQuery}`}
              label="로그 내보내기"
              filename="audit-logs.xlsx"
            />
          </div>
        }
      />

      {/* 검색 + 필터 */}
      <div className="gx-toolbar">
        <InputGroup className="inline-flex h-9 w-auto min-w-60">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            role="searchbox"
            aria-label={SEARCH_LABEL}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={SEARCH_LABEL}
            className="h-full"
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                variant="secondary"
                size="icon-xs"
                aria-label="검색어 지우기"
                onClick={() => setSearch('')}
              >
                <X aria-hidden />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <FilterChipBar
          options={ENTITY_FILTERS}
          value={entity}
          onChange={(v) => { setEntity(v); setPage(1); }}
        />
        <span className="ml-auto text-12 font-semibold text-muted-foreground">
          {filtered.length.toLocaleString()}건
        </span>
      </div>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-4">
          <AuditTable
            logs={filtered}
            loading={loading}
            hasFilter={!!(search || entity)}
            entityText={entityText}
            timestamp={fmtAt}
            onSelect={setSelected}
            onResetFilter={() => { setSearch(''); setEntity(''); setPage(1); }}
          />

          {/* 페이지네이션 */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
              <span className="text-12 text-muted-foreground">
                전체 <b className="text-foreground">{total.toLocaleString()}</b>건 ·{' '}
                {page}/{totalPages} 페이지
              </span>
              <AuditPagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 변경 내역 모달 */}
      <AuditDetailDialog
        log={selected}
        onClose={() => setSelected(null)}
        entityText={entityText}
        timestamp={fmtAt}
      />
    </PageContainer>
  );
}
