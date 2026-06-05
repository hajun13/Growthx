'use client';

import { useMemo, useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { Modal } from '@/components/Modal';
import { DiffViewer } from '@/components/DiffViewer';
import { ExportButton } from '@/components/ExportButton';
import { Forbidden } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import { auditActionText, auditEntityText } from '@/lib/ui';
import { T } from '@/lib/toss';
import type { AuditLog } from '@/lib/types';

const PAGE_SIZE = 50;

// 대상(entity) → 한글 라벨 칩 색상.
const ENTITY_FILTERS: { value: string; label: string; color: string }[] = [
  { value: '', label: '전체', color: T.blue500 },
  { value: 'RuleSet', label: '규칙', color: T.orange500 },
  { value: 'EvaluationCycle', label: '평가 주기', color: '#0891b2' },
  { value: 'Kpi', label: 'KPI', color: T.blue500 },
  { value: 'Evaluation', label: '평가', color: '#9333ea' },
  { value: 'GradePool', label: '등급 풀', color: T.green500 },
  { value: 'Appeal', label: '이의제기', color: T.red500 },
];
const entityColor = (entity: string): string =>
  ENTITY_FILTERS.find((e) => e.value === entity)?.color ?? T.grey600;

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
  const allowed = !!user && isHrAdmin(user.role);

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
    return <Forbidden message="감사 로그는 HR만 접근할 수 있어요." />;
  }

  const stats = [
    { label: '현재 페이지', value: logs.length, color: T.blue500 },
    { label: '전체 로그', value: total, color: T.green500 },
    {
      label: '행위자',
      value: new Set(logs.map((l) => l.actorName ?? '시스템')).size,
      color: '#9333ea',
    },
    {
      label: '시스템 작업',
      value: logs.filter((l) => !l.actorName).length,
      color: T.grey600,
    },
  ];

  return (
    <div className="space-y-5" style={{ fontFamily: 'Pretendard, sans-serif' }}>
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.grey900 }}>
            감사 로그
          </h1>
          <p style={{ fontSize: 13, color: T.grey600, marginTop: 2 }}>
            민감한 변경 이력을 조회하고 변경 내역을 비교합니다.
          </p>
        </div>
        <ExportButton
          path={`/excel/export/audit${exportQuery}`}
          label="로그 내보내기"
          filename="audit-logs.xlsx"
        />
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 bg-white px-4 py-3"
            style={{ border: `1px solid ${T.grey200}` }}
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
              <div style={{ fontSize: 11.5, color: T.grey600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 + 대상 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-2 bg-white px-3 py-2"
          style={{ border: `1px solid ${T.grey200}` }}
        >
          <Search size={13} color={T.grey500} />
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
                  color: active ? '#fff' : T.grey600,
                  borderColor: active ? c.color : T.grey200,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto" style={{ fontSize: 12, color: T.grey500 }}>
          {filtered.length}건
        </span>
      </div>

      {/* 테이블 */}
      <div
        className="overflow-hidden bg-white"
        style={{ border: `1px solid ${T.grey200}` }}
      >
        <div
          className="grid border-b px-5 py-2.5"
          style={{
            gridTemplateColumns: '150px 100px 1fr 1fr 90px',
            background: T.grey50,
            borderColor: T.grey200,
          }}
        >
          {['시각', '행위자', '액션', '대상', '상세'].map((h) => (
            <div
              key={h}
              style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}
            >
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div
            className="py-16 text-center"
            style={{ fontSize: 13, color: T.grey500 }}
          >
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="py-16 text-center"
            style={{ fontSize: 13, color: T.grey500 }}
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
                className="grid cursor-pointer items-center border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-[#f9fafb]"
                style={{
                  gridTemplateColumns: '150px 100px 1fr 1fr 90px',
                  borderColor: T.grey200,
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    color: T.grey600,
                    fontFamily: 'monospace',
                  }}
                >
                  {at.time}
                  <br />
                  <span style={{ fontSize: 10.5, color: T.grey500 }}>
                    {at.date}
                  </span>
                </div>
                <div
                  style={{ fontSize: 12.5, fontWeight: 600, color: T.grey900 }}
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
                  <span style={{ fontSize: 12, color: T.grey900 }}>
                    {auditActionText(log.action)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: T.grey600,
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
                      color: T.blue700,
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
            style={{ borderColor: T.grey200 }}
          >
            <span style={{ fontSize: 12, color: T.grey600 }}>
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
                  color: T.grey700,
                  borderColor: T.grey200,
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
                  color: T.grey700,
                  borderColor: T.grey200,
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
            <p style={{ fontSize: 11.5, color: T.grey500 }}>
              {selected.actorName ?? '시스템'} · {fmtAt(selected.at).date}{' '}
              {fmtAt(selected.at).time} · {auditEntityText(selected.entity)} #
              {selected.entityId.slice(0, 8)}
            </p>
            <DiffViewer before={selected.before} after={selected.after} />
          </div>
        )}
      </Modal>
    </div>
  );
}
