'use client';

import { useMemo, useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { Modal } from '@/components/Modal';
import { DiffViewer } from '@/components/DiffViewer';
import { ExportButton } from '@/components/ExportButton';
import { Forbidden } from '@/components/States';
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

const PAGE_SIZE = 50;

// 대상(entity) → 한글 라벨 칩 색상.
const ENTITY_FILTERS: { value: string; label: string; color: string }[] = [
  { value: '', label: '전체', color: '#0054ca' },
  { value: 'RuleSet', label: '규칙 세트', color: '#b45309' },
  { value: 'EvaluationCycle', label: '평가 주기', color: '#0891b2' },
  { value: 'CycleSchedule', label: '평가 일정', color: '#0e9aa0' },
  { value: 'Kpi', label: 'KPI', color: '#0054ca' },
  { value: 'KpiCategoryPolicy', label: 'KPI 분류 정책', color: '#3f2c80' },
  { value: 'Evaluation', label: '평가', color: '#564599' },
  { value: 'GradePool', label: '등급 풀', color: '#0e9aa0' },
  { value: 'Appeal', label: '이의제기', color: '#ba1a1a' },
  { value: 'MonthlyPerformance', label: '월 실적', color: '#ca8a04' },
  { value: 'PositionDef', label: '직급', color: '#db2777' },
  { value: 'CompetencyQuestion', label: '역량 문항', color: '#7c3aed' },
];
const entityColor = (entity: string): string =>
  ENTITY_FILTERS.find((e) => e.value === entity)?.color ?? '#605d67';

function fmtAt(iso: string): { time: string; date: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { time: iso, date: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}

export default function AuditPage() {
  const { user } = useAuth();
  const { hasFeature } = usePermissions();
  // 권한 매트릭스 추가 차단(restrict-only) — '감사로그' false 면 접근 안내.
  const allowed = !!user && isHrAdmin(user.role) && hasFeature('감사로그');

  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, loading } = useAuditLogs(
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
        const hay = `${l.actorName ?? '시스템'} ${auditActionText(
          l.action,
        )} ${auditEntityText(l.entity)} ${l.entityId}`;
        return hay.includes(search);
      }),
    [logs, search],
  );

  const exportQuery = entity ? `?entity=${entity}` : '';

  if (!allowed) {
    return <Forbidden message="감사 로그 열람 권한이 없어요. HR 관리자에게 문의하세요." />;
  }

  const stats = [
    { label: '현재 페이지', value: logs.length, color: '#0054ca' },
    { label: '전체 로그', value: total, color: '#0e9aa0' },
    {
      label: '행위자',
      value: new Set(logs.map((l) => l.actorName ?? '시스템')).size,
      color: '#564599',
    },
    {
      label: '시스템 작업',
      value: logs.filter((l) => !l.actorName).length,
      color: '#605d67',
    },
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

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 bg-white px-4 py-3"
            style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center"
              style={{ background: s.color }}
            >
              <Shield size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11.5, color: '#605d67' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 + 대상 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 bg-white px-3 py-2"
          style={{ border: '1px solid rgba(202,196,210,0.4)', borderRadius: 10 }}
        >
          <Search size={13} color={'#797582'} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="행위자, 액션, 대상 검색..."
            className="outline-none"
            style={{ fontSize: 12, background: 'transparent', width: 200 }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_FILTERS.map((c) => {
            const active = entity === c.value;
            return (
              <button
                key={c.value || 'all'}
                onClick={() => {
                  setEntity(c.value);
                  setPage(1);
                }}
                className="border px-2.5 py-1 transition-colors"
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  background: active ? c.color : '#fff',
                  color: active ? '#fff' : '#605d67',
                  borderColor: active ? c.color : 'rgba(202,196,210,0.4)',
                  borderRadius: 999,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto" style={{ fontSize: 12, color: '#797582' }}>
          {filtered.length}건
        </span>
      </div>

      {/* 테이블 */}
      <div
        className="overflow-hidden bg-white"
        style={{ border: '1px solid rgba(202,196,210,0.5)', borderRadius: 12, boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
      >
        <div
          className="grid border-b px-5 py-2.5"
          style={{
            gridTemplateColumns: '150px 100px 1fr 1fr 90px',
            background: '#f2f3f7',
            borderColor: 'rgba(202,196,210,0.3)',
          }}
        >
          {['시각', '행위자', '액션', '대상', '상세'].map((h) => (
            <div
              key={h}
              style={{ fontSize: 11, fontWeight: 600, color: '#605d67' }}
            >
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div
            className="py-16 text-center"
            style={{ fontSize: 13, color: '#797582' }}
          >
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ fontSize: 13, color: '#797582' }}
          >
            해당 조건의 로그가 없어요.
          </div>
        ) : (
          filtered.map((log) => {
            const at = fmtAt(log.at);
            const ec = entityColor(log.entity);
            return (
              <div
                key={log.id}
                onClick={() => setSelected(log)}
                className="grid cursor-pointer items-center border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-[#f8f9fd]"
                style={{
                  gridTemplateColumns: '150px 100px 1fr 1fr 90px',
                  borderColor: 'rgba(202,196,210,0.2)',
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    color: '#605d67',
                    fontFamily: 'monospace',
                  }}
                >
                  {at.time}
                  <br />
                  <span style={{ fontSize: 10.5, color: '#797582' }}>
                    {at.date}
                  </span>
                </div>
                <div
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#191c1f' }}
                >
                  {log.actorName ?? '시스템'}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="px-1.5 py-0.5"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: ec,
                      color: '#fff',
                    }}
                  >
                    {auditEntityText(log.entity)}
                  </span>
                  <span style={{ fontSize: 12, color: '#191c1f' }}>
                    {auditActionText(log.action)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: '#605d67',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {auditEntityText(log.entity)} #{log.entityId.slice(0, 8)}
                </div>
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(log);
                    }}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#0054ca',
                    }}
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
            style={{ borderColor: 'rgba(202,196,210,0.4)' }}
          >
            <span style={{ fontSize: 12, color: '#605d67' }}>
              전체 {total}건 · {page}/{totalPages} 페이지
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border px-3 py-1.5 disabled:opacity-40"
                style={{
                  fontSize: 12,
                  background: '#fff',
                  color: '#484551',
                  borderColor: 'rgba(202,196,210,0.4)',
                  borderRadius: 8,
                }}
              >
                이전
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border px-3 py-1.5 disabled:opacity-40"
                style={{
                  fontSize: 12,
                  background: '#fff',
                  color: '#484551',
                  borderColor: 'rgba(202,196,210,0.4)',
                  borderRadius: 8,
                }}
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`변경 내역 — ${selected ? auditActionText(selected.action) : ''}`}
        size="lg"
        secondaryAction={{ label: '닫기', onClick: () => setSelected(null) }}
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <p style={{ fontSize: 11.5, color: '#797582' }}>
              {selected.actorName ?? '시스템'} · {fmtAt(selected.at).date}{' '}
              {fmtAt(selected.at).time} · {auditEntityText(selected.entity)} #
              {selected.entityId.slice(0, 8)}
            </p>
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
