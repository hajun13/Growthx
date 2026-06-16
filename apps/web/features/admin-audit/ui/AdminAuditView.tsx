'use client';

import { useMemo, useState } from 'react';
import { Shield, Search, X, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Modal } from '@/components/Modal';
import { DiffViewer } from '@/components/DiffViewer';
import { ExportButton } from '@/components/ExportButton';
import { Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import {
  auditActionText,
  auditEntityText,
  auditFieldLabel,
  auditValueLabel,
} from '@/lib/ui';
import type { AuditLog } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useAuditLogsData } from '../hooks';

const K = {
  primary:   '#7a37d8',
  secondary: '#7A37D8',
  tertiary:  '#2563eb',
  surface:   '#f7f7f9',
} as const;

const T = {
  grey900: '#18181c',
  grey800: '#18181c',
  grey600: '#565660',
  grey500: '#74747f',
  grey400: '#a0a0ac',
  grey200: '#e3e3e8',
  grey100: '#efeff2',
  grey50:  '#f7f7f9',
  red500:  '#E5484D',
} as const;

const PAGE_SIZE = 50;

// 대상(entity) → 한글 라벨 칩 색상.
const ENTITY_FILTERS: { value: string; label: string; color: string }[] = [
  { value: '', label: '전체', color: K.secondary },
  { value: 'RuleSet', label: '규칙 세트', color: '#9a6103' },
  { value: 'EvaluationCycle', label: '평가 주기', color: '#2563eb' },
  { value: 'CycleSchedule', label: '평가 일정', color: K.tertiary },
  { value: 'Kpi', label: 'KPI', color: K.secondary },
  { value: 'KpiCategoryPolicy', label: 'KPI 분류 정책', color: K.primary },
  { value: 'Evaluation', label: '평가', color: '#6a2dc0' },
  { value: 'GradePool', label: '등급 풀', color: K.tertiary },
  { value: 'Appeal', label: '이의제기', color: '#e5484d' },
  { value: 'MonthlyPerformance', label: '월 실적', color: '#c97e04' },
  { value: 'PositionDef', label: '직급', color: '#7a37d8' },
  { value: 'CompetencyQuestion', label: '역량 문항', color: '#7a37d8' },
];
const entityColor = (entity: string): string =>
  ENTITY_FILTERS.find((e) => e.value === entity)?.color ?? '#565660';

function fmtAt(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { time: iso, date: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

// 통계 카드 — §3-1 패턴
function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-[#ccccd4]/50 flex items-center gap-3 px-5 py-4 transition-transform hover:scale-[1.02] cursor-default"
      style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
    >
      {/* 아이콘 타일 */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}18` }}
      >
        <Icon size={18} color={color} strokeWidth={2} />
      </div>
      <div>
        <div
          className="tabular-nums font-extrabold leading-[1.2] tracking-[-0.02em]"
          style={{ fontSize: 28, color }}
        >
          {value.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.grey500, marginTop: 1 }}>
          {label}
        </div>
      </div>
    </div>
  );
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
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-4 gap-5">
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
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

  // 클라이언트 검색(현재 페이지 내 — 행위자·액션·대상 키워드).
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

  if (!allowed) {
    return <Forbidden message="감사 로그 열람 권한이 없어요. HR 관리자에게 문의하세요." />;
  }

  if (loading && !data) return <AuditSkeleton />;

  const stats = [
    { label: '현재 페이지', value: logs.length, color: K.secondary, icon: Shield },
    { label: '전체 로그',   value: total,        color: K.tertiary,  icon: Shield },
    { label: '행위자',      value: new Set(logs.map((l) => l.actorName ?? '시스템')).size, color: K.primary, icon: Shield },
    { label: '시스템 작업', value: logs.filter((l) => !l.actorName).length, color: '#565660', icon: Shield },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="감사 로그"
        subtitle="민감한 변경 이력을 조회하고 변경 내역을 비교합니다."
        right={
          <ExportButton
            path={`/excel/export/audit${exportQuery}`}
            label="로그 내보내기"
            filename="audit-logs.xlsx"
          />
        }
      />

      {/* 요약 통계 — §3-1 패턴 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} icon={s.icon} />
        ))}
      </div>

      {/* 검색 + 대상 필터 */}
      <div className="flex flex-col gap-3">
        {/* 검색 + 적용 필터 칩 행 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 검색 — Pill 모양 */}
          <div
            className="flex items-center gap-2 bg-white px-3.5 py-2.5"
            style={{
              border: '1px solid rgba(204,204,212,0.5)',
              borderRadius: 999,
              minWidth: 240,
              boxShadow: '0 2px 6px rgba(86,69,153,0.04)',
            }}
          >
            <Search size={14} color={T.grey500} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="행위자, 액션, 대상 검색..."
              className="outline-none flex-1 bg-transparent"
              style={{ fontSize: 12.5, color: T.grey900 }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="검색 초기화">
                <X size={13} color={T.grey400} />
              </button>
            )}
          </div>

          {/* 결과 수 */}
          <span style={{ fontSize: 12, color: T.grey500, marginLeft: 'auto' }}>
            {filtered.length.toLocaleString()}건
          </span>
        </div>

        {/* 엔티티 필터 칩 */}
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_FILTERS.map((c) => {
            const active = entity === c.value;
            return (
              <button
                key={c.value || 'all'}
                type="button"
                onClick={() => { setEntity(c.value); setPage(1); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  padding: active ? '3px 10px 3px 8px' : '3px 10px',
                  background: active ? c.color : '#fff',
                  color: active ? '#fff' : T.grey500,
                  border: `1px solid ${active ? c.color : 'rgba(204,204,212,0.5)'}`,
                  borderRadius: 999,
                  transition: 'all .12s',
                  cursor: 'pointer',
                }}
              >
                {active && <X size={10} />}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 테이블 */}
      <div
        className="overflow-hidden bg-white"
        style={{
          border: '1px solid rgba(204,204,212,0.5)',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
        }}
      >
        {/* sticky 헤더 */}
        <div
          className="grid px-5 py-2.5 sticky top-0 z-10 border-b"
          style={{
            gridTemplateColumns: '150px 110px 1fr 1fr 90px',
            background: '#efeff2',
            borderColor: 'rgba(204,204,212,0.3)',
          }}
        >
          {['시각', '행위자', '액션', '대상', '상세'].map((h) => (
            <div
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: T.grey500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-0">
            {[1,2,3,4,5,6,7].map((i) => (
              <div key={i} className="grid px-5 py-3 border-b border-[#e3e3e8]/50" style={{ gridTemplateColumns: '150px 110px 1fr 1fr 90px' }}>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: T.grey400 }}>
            <Shield size={32} color={T.grey200} strokeWidth={1.5} />
            <p style={{ fontSize: 13, marginTop: 10, color: T.grey500 }}>
              {search || entity ? '해당 조건의 로그가 없어요.' : '아직 감사 로그가 없어요.'}
            </p>
            {(search || entity) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setEntity(''); setPage(1); }}
                style={{
                  marginTop: 12, fontSize: 12.5, fontWeight: 600, color: K.secondary,
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          filtered.map((log) => {
            const at = fmtAt(log.at);
            const ec = entityColor(log.entity);
            return (
              <div
                key={log.id}
                onClick={() => setSelected(log)}
                className="grid cursor-pointer items-center border-b px-5 py-3 transition-colors last:border-b-0"
                style={{
                  gridTemplateColumns: '150px 110px 1fr 1fr 90px',
                  borderColor: 'rgba(204,204,212,0.2)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f7f7f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                {/* 시각 */}
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.grey900 }}>
                    {at.time}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.grey500, marginTop: 1 }}>
                    {at.date}
                  </div>
                </div>
                {/* 행위자 */}
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}>
                  {log.actorName ?? (
                    <span style={{ color: T.grey500, fontWeight: 500 }}>시스템</span>
                  )}
                </div>
                {/* 액션 */}
                <div className="flex items-center gap-1.5">
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: ec,
                      color: '#fff',
                      padding: '2px 7px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {auditEntityText(log.entity)}
                  </span>
                  <span style={{ fontSize: 12, color: T.grey900 }}>
                    {auditActionText(log.action)}
                  </span>
                </div>
                {/* 대상 ID */}
                <div
                  style={{
                    fontSize: 11.5,
                    color: T.grey500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {auditEntityText(log.entity)} #{log.entityId.slice(0, 8)}
                </div>
                {/* 상세 */}
                <div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(log); }}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: K.secondary,
                      background: 'rgba(122,55,216,0.07)',
                      border: '1px solid rgba(122,55,216,0.2)',
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(122,55,216,0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(122,55,216,0.07)')}
                  >
                    변경 보기
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* 페이지네이션 */}
        {!loading && total > 0 && (
          <div
            className="flex items-center justify-between border-t px-5 py-3"
            style={{ borderColor: 'rgba(204,204,212,0.4)' }}
          >
            <span style={{ fontSize: 12, color: T.grey500 }}>
              전체 <b style={{ color: T.grey900 }}>{total.toLocaleString()}</b>건 ·{' '}
              {page}/{totalPages} 페이지
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 border px-3 py-1.5 disabled:opacity-40 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#fff',
                  color: T.grey600,
                  borderColor: 'rgba(204,204,212,0.5)',
                  borderRadius: 8,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (page > 1) e.currentTarget.style.background = '#efeff2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
              >
                <ChevronLeft size={13} /> 이전
              </button>
              {/* 페이지 번호 칩 */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  background: K.secondary,
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {page}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 border px-3 py-1.5 disabled:opacity-40 transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#fff',
                  color: T.grey600,
                  borderColor: 'rgba(204,204,212,0.5)',
                  borderRadius: 8,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (page < totalPages) e.currentTarget.style.background = '#efeff2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
              >
                다음 <ChevronRightIcon size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

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
            {/* 메타 정보 */}
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: '#efeff2', border: '1px solid rgba(204,204,212,0.5)' }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: entityColor(selected.entity),
                  color: '#fff',
                  padding: '2px 7px',
                  borderRadius: 4,
                }}
              >
                {auditEntityText(selected.entity)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.grey900 }}>
                {selected.actorName ?? '시스템'}
              </span>
              <span style={{ fontSize: 11.5, color: T.grey500 }}>
                {fmtAt(selected.at).date} {fmtAt(selected.at).time}
              </span>
              <span style={{ fontSize: 11.5, color: T.grey500, marginLeft: 'auto' }}>
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
